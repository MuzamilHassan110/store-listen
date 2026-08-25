-- Generated reports, scheduling, archives, and retention settings.

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_type text not null,
  file_url text,
  file_path text,
  file_name text,
  date_range jsonb,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

create table if not exists public.scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_type text not null,
  recipient_email text,
  is_active boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.archived_conversations (
  id uuid primary key default gen_random_uuid(),
  original_conversation_id uuid,
  organization_id uuid,
  archived_at timestamptz not null default now(),
  metadata jsonb,
  transcript text,
  analysis jsonb,
  scores jsonb
);

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  retention_days integer not null default 90,
  updated_at timestamptz not null default now()
);

create index if not exists reports_organization_id_idx on public.reports (organization_id, generated_at desc);
create index if not exists scheduled_reports_organization_id_idx on public.scheduled_reports (organization_id);
create index if not exists archived_conversations_org_idx on public.archived_conversations (organization_id);

drop trigger if exists scheduled_reports_set_updated_at on public.scheduled_reports;
create trigger scheduled_reports_set_updated_at
  before update on public.scheduled_reports
  for each row execute procedure public.set_updated_at();

alter table public.reports enable row level security;
alter table public.scheduled_reports enable row level security;
alter table public.archived_conversations enable row level security;
alter table public.organization_settings enable row level security;

create policy "members can view reports"
  on public.reports for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "members can view scheduled reports"
  on public.scheduled_reports for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "members can insert scheduled reports"
  on public.scheduled_reports for insert to authenticated
  with check (organization_id in (select public.user_organization_ids()));

create policy "members can update scheduled reports"
  on public.scheduled_reports for update to authenticated
  using (organization_id in (select public.user_organization_ids()))
  with check (organization_id in (select public.user_organization_ids()));

create policy "members can view archived conversations"
  on public.archived_conversations for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "members can view organization settings"
  on public.organization_settings for select to authenticated
  using (organization_id in (select public.user_organization_ids()));
