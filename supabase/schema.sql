-- Schema for campaigns, leads, enrichment_jobs
create extension if not exists pgcrypto;

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service_line text not null,
  summarize_prompt text not null,
  icebreaker_prompt text not null,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  first_name text,
  last_name text,
  full_name text,
  company_name text,
  company_website text,
  email text,
  personal_email text,
  linkedin text,
  title text,
  industry text,
  city text,
  state text,
  country text,
  ice_breaker text,
  ice_status text not null default 'none',
  enriched_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);

-- Simple unique index for upsert compatibility
create unique index if not exists leads_unique_per_campaign_email_plain
  on leads(campaign_id, email);
create index if not exists leads_campaign_idx on leads(campaign_id);
create index if not exists leads_email_idx on leads(lower(coalesce(email,'')));
create index if not exists leads_company_site_idx on leads(lower(coalesce(company_website,'')));
create index if not exists leads_ice_status_idx on leads(ice_status);

create table if not exists enrichment_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lead_id)
);

-- Queue (pgmq) for lead enrichment
create extension if not exists pgmq;
select pgmq.create('lead_enrichment');

-- Permissions for pgmq so RPCs can call its functions
grant usage on schema pgmq to service_role, authenticated, anon;
grant execute on all functions in schema pgmq to service_role, authenticated, anon;

-- Public wrappers for pgmq to use via PostgREST
create or replace function public.enqueue_lead_enrichment(lid uuid)
returns bigint
language sql
security definer
set search_path = public, pgmq
as $$
  select pgmq.send('lead_enrichment', jsonb_build_object('leadId', lid));
$$;

create or replace function public.dequeue_lead_enrichment(cnt int default 10, vt_seconds int default 60)
returns table(msg_id bigint, message jsonb)
language sql
security definer
set search_path = public, pgmq
as $$
  select r.msg_id, r.message from pgmq.read('lead_enrichment', vt_seconds, cnt) as r;
$$;

create or replace function public.ack_lead_enrichment(mid bigint)
returns boolean
language sql
security definer
set search_path = public, pgmq
as $$
  select pgmq.archive('lead_enrichment', mid);
$$;

-- Dequeue up to cnt messages and atomically claim leads (set processing).
-- If a lead cannot be claimed (already processing/done), archive the message immediately.
create or replace function public.dequeue_and_claim_lead_enrichment(
  cnt int default 10,
  vt_seconds int default 120
)
returns table(msg_id bigint, lead_id uuid)
language plpgsql
security definer
set search_path = public, pgmq
as $$
declare
  r record;
  lid uuid;
  claimed boolean;
begin
  for r in select * from pgmq.read('lead_enrichment', vt_seconds, cnt)
  loop
    begin
      lid := (r.message->>'leadId')::uuid;
    exception when others then
      -- malformed payload; archive and continue
      perform pgmq.archive('lead_enrichment', r.msg_id);
      continue;
    end;

    with c as (
      update leads
         set ice_status = 'processing', enriched_at = null
       where id = lid
         and ice_status <> 'processing'
         and ice_status <> 'done'
       returning id
    )
    select exists(select 1 from c) into claimed;

    if claimed then
      msg_id := r.msg_id;
      lead_id := lid;
      return next;
    else
      -- duplicate or completed; archive now to avoid churn
      perform pgmq.archive('lead_enrichment', r.msg_id);
    end if;
  end loop;
end;
$$;

-- Purge all messages from the lead_enrichment queue (best-effort)
create or replace function public.purge_lead_enrichment()
returns void
language plpgsql
security definer
set search_path = public, pgmq
as $$
begin
  perform pgmq.purge('lead_enrichment');
exception when others then
  -- swallow errors so API can still reset lead statuses
  raise notice 'purge_lead_enrichment error: %', sqlerrm;
end;
$$;


