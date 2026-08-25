-- WhatsApp / SMS history, customer consent, and communication settings.

alter table public.customers
  add column if not exists whatsapp_number text,
  add column if not exists sms_number text,
  add column if not exists preferred_contact text not null default 'whatsapp',
  add column if not exists contact_consent boolean not null default false;

alter table public.follow_ups
  add column if not exists contact_method text not null default 'whatsapp',
  add column if not exists message_sent boolean not null default false;

alter table public.organization_settings
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists sms_enabled boolean not null default false,
  add column if not exists push_enabled boolean not null default true,
  add column if not exists quiet_hours_start integer not null default 22,
  add column if not exists quiet_hours_end integer not null default 9,
  add column if not exists timezone text not null default 'Asia/Karachi',
  add column if not exists manager_whatsapp text,
  add column if not exists manager_sms text,
  add column if not exists follow_up_template text,
  add column if not exists daily_report_template text,
  add column if not exists high_intent_template text;

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  follow_up_id uuid references public.follow_ups(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_phone text,
  message_text text not null,
  template_used text,
  channel text not null default 'whatsapp',
  status text not null default 'queued',
  provider_id text,
  error_text text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique (organization_id, endpoint)
);

create index if not exists whatsapp_messages_org_idx
  on public.whatsapp_messages (organization_id, created_at desc);
create index if not exists whatsapp_messages_status_idx
  on public.whatsapp_messages (status, created_at);
create index if not exists push_subscriptions_org_idx
  on public.push_subscriptions (organization_id);

alter table public.whatsapp_messages enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "members can view whatsapp messages"
  on public.whatsapp_messages for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "members can view push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (organization_id in (select public.user_organization_ids()));
