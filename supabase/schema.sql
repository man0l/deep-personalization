-- Schema for campaigns, leads, enrichment_jobs
create extension if not exists pgcrypto;
create extension if not exists pg_net; -- HTTP jobs
create extension if not exists pg_cron; -- cron scheduler
create extension if not exists vault; -- Supabase Vault for secrets
-- Allow PostgREST roles to use http functions (safe: only used by our wrappers)
grant usage on schema net to service_role, authenticated, anon;
grant execute on all functions in schema net to service_role, authenticated, anon;

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
  -- Email verification fields
  verification_status text default 'unverified',
  verification_checked_at timestamptz,
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
create index if not exists leads_verification_status_idx on leads(verification_status);

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

-- Email verification bulk file tracking
create table if not exists email_verification_files (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  source text not null, -- 'selected' | 'filtered'
  file_id text not null, -- EmailListVerify file id
  filename text not null,
  lines int,
  filter_query jsonb,
  emails jsonb,
  status text,
  lines_processed int,
  link1 text,
  link2 text,
  checked_at timestamptz,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists evf_campaign_idx on email_verification_files(campaign_id, created_at desc);

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



-- Cron dispatcher: invokes the enrichment worker via HTTP N times
-- Requires database parameters:
--   alter database postgres set app.settings.functions_url = 'https://<PROJECT>.supabase.co';
--   alter database postgres set app.settings.anon_key = '<ANON_JWT>';
create or replace function public.invoke_enrichment_worker(n int default 1)
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  base_url text := current_setting('app.settings.functions_url', true);
  anon_key text := current_setting('app.settings.anon_key', true);
  i int;
  target_url text;
begin
  if coalesce(base_url,'') = '' or coalesce(anon_key,'') = '' then
    raise notice 'invoke_enrichment_worker: missing app.settings.* (functions_url or anon_key)';
    return;
  end if;
  target_url := base_url || '/functions/v1/enrichment-worker';
  for i in 1..greatest(1,n) loop
    perform net.http_post(
      url => target_url,
      headers => jsonb_build_object('Authorization', 'Bearer ' || anon_key)
    );
  end loop;
end;
$$;

-- Create three per-minute schedules (idempotent unschedule, then schedule)
do $$ begin perform cron.unschedule('enrichment_worker_a'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('enrichment_worker_b'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('enrichment_worker_c'); exception when others then null; end $$;

select cron.schedule('enrichment_worker_a', '*/1 * * * *', $$select public.invoke_enrichment_worker(1);$$);
select cron.schedule('enrichment_worker_b', '*/1 * * * *', $$select public.invoke_enrichment_worker(1);$$);
select cron.schedule('enrichment_worker_c', '*/1 * * * *', $$select public.invoke_enrichment_worker(1);$$);

-- Vault-based dispatcher (preferred): reads URL and key from Supabase Vault
-- Requires two named secrets in Vault:
--   name='functions_url' with value like 'https://<project>.supabase.co'
--   name='anon_key' with your project's anon JWT
create or replace function public.invoke_enrichment_worker_vault(n int default 1)
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  base_url text;
  functions_url text;
  anon_key text;
  i int;
  target_url text;
begin
  -- Prefer an explicit FUNCTIONS_URL secret (full function base URL),
  -- fallback to SUPABASE_URL if present.
  select decrypted_secret into functions_url from vault.decrypted_secrets where name = 'FUNCTIONS_URL' limit 1;
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into anon_key from vault.decrypted_secrets where name = 'SUPABASE_ANON_KEY' limit 1;

  if coalesce(anon_key,'') = '' then
    raise notice 'invoke_enrichment_worker_vault: missing Vault secret SUPABASE_ANON_KEY';
    return;
  end if;

  if coalesce(functions_url,'') <> '' then
    -- functions_url expected like: https://<project>.functions.supabase.co
    target_url := rtrim(functions_url, '/') || '/enrichment-worker';
  elsif coalesce(base_url,'') <> '' then
    -- fallback: project base + /functions/v1 path
    target_url := rtrim(base_url, '/') || '/functions/v1/enrichment-worker';
  else
    raise notice 'invoke_enrichment_worker_vault: missing Vault URL secrets (FUNCTIONS_URL or SUPABASE_URL)';
    return;
  end if;

  for i in 1..greatest(1,n) loop
    perform net.http_post(
      url => target_url,
      headers => jsonb_build_object('Authorization', 'Bearer ' || anon_key)
    );
  end loop;
end;
$$;

-- Switch cron schedules to the Vault-based dispatcher
do $$ begin perform cron.unschedule('enrichment_worker_a'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('enrichment_worker_b'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('enrichment_worker_c'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('enrichment_worker_d'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('enrichment_worker_e'); exception when others then null; end $$;


select cron.schedule('enrichment_worker_a', '*/1 * * * *', $$select public.invoke_enrichment_worker_vault(1);$$);
select cron.schedule('enrichment_worker_b', '*/1 * * * *', $$select public.invoke_enrichment_worker_vault(1);$$);
select cron.schedule('enrichment_worker_c', '*/1 * * * *', $$select public.invoke_enrichment_worker_vault(1);$$);
select cron.schedule('enrichment_worker_d', '*/1 * * * *', $$select public.invoke_enrichment_worker_vault(1);$$);
select cron.schedule('enrichment_worker_e', '*/1 * * * *', $$select public.invoke_enrichment_worker_vault(1);$$);

-- Cleanup: drop deprecated inline dispatcher if it exists
do $$
begin
  perform 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'invoke_enrichment_worker_inline';
  if found then
    execute 'drop function if exists public.invoke_enrichment_worker_inline(int)';
  end if;
exception when others then
  -- ignore
  null;
end $$;


-- Verification worker dispatcher using Vault (calls the verification-worker edge function)
create or replace function public.invoke_verification_worker_vault(n int default 1)
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  base_url text;
  functions_url text;
  anon_key text;
  i int;
  target_url text;
begin
  select decrypted_secret into functions_url from vault.decrypted_secrets where name = 'FUNCTIONS_URL' limit 1;
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into anon_key from vault.decrypted_secrets where name = 'SUPABASE_ANON_KEY' limit 1;

  if coalesce(anon_key,'') = '' then
    raise notice 'invoke_verification_worker_vault: missing Vault secret SUPABASE_ANON_KEY';
    return;
  end if;

  if coalesce(functions_url,'') <> '' then
    target_url := rtrim(functions_url, '/') || '/verification-worker';
  elsif coalesce(base_url,'') <> '' then
    target_url := rtrim(base_url, '/') || '/functions/v1/verification-worker';
  else
    raise notice 'invoke_verification_worker_vault: missing Vault URL secrets (FUNCTIONS_URL or SUPABASE_URL)';
    return;
  end if;

  for i in 1..greatest(1,n) loop
    perform net.http_post(
      url => target_url,
      headers => jsonb_build_object('Authorization', 'Bearer ' || anon_key)
    );
  end loop;
end;
$$;

-- Schedule the verification worker every minute (idempotent)
do $$ begin perform cron.unschedule('verification_worker_a'); exception when others then null; end $$;
select cron.schedule('verification_worker_a', '*/1 * * * *', $$select public.invoke_verification_worker_vault(1);$$);

