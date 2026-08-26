create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  license_key text unique not null,
  plan_type text not null default 'trial',
  max_stores integer not null default 1,
  max_users integer not null default 3,
  max_devices integer not null default 1,
  expires_at timestamptz,
  is_active boolean not null default true,
  last_device_id text,
  activated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists licenses_organization_id_idx on public.licenses (organization_id);
create index if not exists licenses_expires_at_idx on public.licenses (expires_at);

alter table public.licenses enable row level security;

create policy "members can view licenses for their organization"
  on public.licenses for select to authenticated
  using (
    organization_id is null
    or organization_id in (select public.user_organization_ids())
  );
