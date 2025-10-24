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

create unique index if not exists leads_unique_per_campaign_email
  on leads(campaign_id, lower(coalesce(email,''))) where email is not null;
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


