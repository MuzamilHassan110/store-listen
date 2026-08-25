-- Multi-store, devices, assignments, activity feed, and realtime.
-- Do not reuse 007 — that file already ships language/offline columns.

alter table public.stores
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists phone text,
  add column if not exists manager_id uuid references public.profiles(id) on delete set null,
  add column if not exists is_active boolean not null default true,
  add column if not exists opening_time time,
  add column if not exists closing_time time,
  add column if not exists timezone text not null default 'Asia/Karachi';

create table if not exists public.store_assignments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  device_name text,
  device_id text not null unique,
  app_version text,
  os_version text,
  last_sync_at timestamptz,
  is_online boolean not null default false,
  storage_used_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.salesmen
  add column if not exists store_id uuid references public.stores(id) on delete set null;

alter table public.follow_ups
  add column if not exists store_id uuid references public.stores(id) on delete set null;

alter table public.reports
  add column if not exists store_id uuid references public.stores(id) on delete set null;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  activity_type text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists store_assignments_store_id_idx on public.store_assignments (store_id);
create index if not exists store_assignments_user_id_idx on public.store_assignments (user_id);
create index if not exists devices_organization_id_idx on public.devices (organization_id);
create index if not exists devices_store_id_idx on public.devices (store_id);
create index if not exists devices_device_id_idx on public.devices (device_id);
create index if not exists follow_ups_store_id_idx on public.follow_ups (store_id);
create index if not exists reports_store_id_idx on public.reports (store_id);
create index if not exists activity_logs_org_created_idx on public.activity_logs (organization_id, created_at desc);

drop trigger if exists devices_set_updated_at on public.devices;
create trigger devices_set_updated_at
  before update on public.devices
  for each row execute procedure public.set_updated_at();

alter table public.store_assignments enable row level security;
alter table public.devices enable row level security;
alter table public.activity_logs enable row level security;

create policy "members can view store assignments in their organization"
  on public.store_assignments for select to authenticated
  using (
    store_id in (
      select id from public.stores
      where organization_id in (select public.user_organization_ids())
    )
  );

create policy "members can view devices in their organization"
  on public.devices for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "members can view activity in their organization"
  on public.activity_logs for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

do $$
declare
  tbl text;
begin
  foreach tbl in array array['conversations', 'notifications', 'devices', 'salesmen', 'activity_logs']
  loop
    if not exists (
      select 1
      from pg_publication_rel prel
      join pg_publication pub on pub.oid = prel.prpubid
      join pg_class c on c.oid = prel.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where pub.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
