-- Prerequisite tables for conversations/transcripts FKs and RLS.
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.salesmen (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create index if not exists stores_organization_id_idx on public.stores (organization_id);
create index if not exists salesmen_organization_id_idx on public.salesmen (organization_id);
create index if not exists organization_members_org_idx on public.organization_members (organization_id);

alter table public.organizations enable row level security;
alter table public.stores enable row level security;
alter table public.salesmen enable row level security;
alter table public.organization_members enable row level security;

create or replace function public.user_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid();
$$;

create policy "members can view their organizations"
  on public.organizations for select to authenticated
  using (id in (select public.user_organization_ids()));

create policy "members can view their stores"
  on public.stores for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "members can view their salesmen"
  on public.salesmen for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "members can view their memberships"
  on public.organization_members for select to authenticated
  using (user_id = auth.uid() or organization_id in (select public.user_organization_ids()));
