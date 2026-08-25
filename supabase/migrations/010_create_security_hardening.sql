-- 2FA, audit logs, trusted devices, sessions, backups, and contact hashes.

alter table public.profiles
  add column if not exists two_factor_enabled boolean not null default false,
  add column if not exists two_factor_secret text,
  add column if not exists backup_codes text[] not null default '{}';

alter table public.customers
  add column if not exists phone_hash text,
  add column if not exists contacts_encrypted boolean not null default false;

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limit_logs (
  id uuid primary key default gen_random_uuid(),
  ip_address text,
  endpoint text,
  request_count integer not null default 1,
  window_start timestamptz not null default now(),
  blocked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_address text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.account_lockouts (
  email text primary key,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null,
  label text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_active timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.pending_2fa_logins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  access_token text,
  refresh_token text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.backup_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  backup_type text not null default 'daily',
  status text not null default 'pending',
  file_path text,
  file_size integer,
  error_text text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action, created_at desc);
create index if not exists login_attempts_email_idx on public.login_attempts (email, created_at desc);
create index if not exists auth_sessions_user_idx on public.auth_sessions (user_id, revoked_at);
create index if not exists backup_jobs_org_idx on public.backup_jobs (organization_id, created_at desc);
create index if not exists customers_phone_hash_idx on public.customers (organization_id, phone_hash);

alter table public.audit_logs enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.backup_jobs enable row level security;

create policy "members can view audit logs"
  on public.audit_logs for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "members can view their sessions"
  on public.auth_sessions for select to authenticated
  using (user_id = auth.uid());

create policy "members can view backup jobs"
  on public.backup_jobs for select to authenticated
  using (organization_id in (select public.user_organization_ids()));
