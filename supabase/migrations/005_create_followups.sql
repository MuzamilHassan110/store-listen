-- CRM tables: customers, follow-ups, notifications, and a thin profiles row for auth users.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text,
  phone text,
  email text,
  total_visits integer not null default 1,
  total_purchases integer not null default 0,
  last_visit_at timestamptz,
  preferred_language text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_interactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  interaction_type text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  product_interest text,
  priority text not null default 'medium',
  status text not null default 'pending',
  follow_up_date timestamptz,
  notes text,
  suggested_message text,
  lead_score integer,
  assigned_to uuid references public.salesmen(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  type text,
  title text,
  message text,
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists customers_organization_id_idx on public.customers (organization_id);
create index if not exists customers_phone_idx on public.customers (organization_id, phone);
create index if not exists customer_interactions_customer_id_idx on public.customer_interactions (customer_id);
create index if not exists follow_ups_organization_id_idx on public.follow_ups (organization_id);
create index if not exists follow_ups_status_date_idx on public.follow_ups (status, follow_up_date);
create index if not exists follow_ups_conversation_id_idx on public.follow_ups (conversation_id);
create index if not exists notifications_org_user_idx on public.notifications (organization_id, user_id, is_read);

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

drop trigger if exists follow_ups_set_updated_at on public.follow_ups;
create trigger follow_ups_set_updated_at
  before update on public.follow_ups
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_interactions enable row level security;
alter table public.follow_ups enable row level security;
alter table public.notifications enable row level security;

create policy "users can view their profile"
  on public.profiles for select to authenticated
  using (id = auth.uid() or organization_id in (select public.user_organization_ids()));

create policy "members can view customers in their organization"
  on public.customers for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "members can insert customers in their organization"
  on public.customers for insert to authenticated
  with check (organization_id in (select public.user_organization_ids()));

create policy "members can update customers in their organization"
  on public.customers for update to authenticated
  using (organization_id in (select public.user_organization_ids()))
  with check (organization_id in (select public.user_organization_ids()));

create policy "members can view customer interactions in their organization"
  on public.customer_interactions for select to authenticated
  using (
    customer_id in (
      select id from public.customers
      where organization_id in (select public.user_organization_ids())
    )
  );

create policy "members can view follow-ups in their organization"
  on public.follow_ups for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "members can insert follow-ups in their organization"
  on public.follow_ups for insert to authenticated
  with check (organization_id in (select public.user_organization_ids()));

create policy "members can update follow-ups in their organization"
  on public.follow_ups for update to authenticated
  using (organization_id in (select public.user_organization_ids()))
  with check (organization_id in (select public.user_organization_ids()));

create policy "members can view their organization notifications"
  on public.notifications for select to authenticated
  using (
    organization_id in (select public.user_organization_ids())
    and (user_id is null or user_id = auth.uid())
  );

create policy "members can update their organization notifications"
  on public.notifications for update to authenticated
  using (organization_id in (select public.user_organization_ids()))
  with check (organization_id in (select public.user_organization_ids()));
