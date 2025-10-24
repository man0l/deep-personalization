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
  on leads(campaign_id, email) where email is not null;
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

-- Public wrappers for pgmq to use via PostgREST
create or replace function public.enqueue_lead_enrichment(lid uuid)
returns bigint
language sql
as $$
  select pgmq.send('lead_enrichment', json_build_object('leadId', lid)::jsonb);
$$;

create or replace function public.dequeue_lead_enrichment(cnt int default 10, vt_seconds int default 60)
returns table(msg_id bigint, message jsonb)
language sql
as $$
  select msg_id, message from pgmq.read('lead_enrichment', cnt, vt_seconds);
$$;

create or replace function public.ack_lead_enrichment(mid bigint)
returns void
language sql
as $$
  select pgmq.ack('lead_enrichment', mid);
$$;


