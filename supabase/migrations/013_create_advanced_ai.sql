-- Advanced AI: emotion, tone, coaching, products, scripts, churn.

alter table public.conversation_analyses
  add column if not exists primary_emotion text,
  add column if not exists emotion_scores jsonb not null default '{}'::jsonb,
  add column if not exists emotional_intensity double precision,
  add column if not exists emotion_triggers jsonb not null default '[]'::jsonb,
  add column if not exists tone_analysis jsonb not null default '{}'::jsonb;

alter table public.customers
  add column if not exists churn_risk text,
  add column if not exists churn_score integer,
  add column if not exists last_churn_analysis timestamptz;

create table if not exists public.coaching_suggestions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  trigger text,
  suggestion text,
  priority text,
  timestamp double precision,
  is_implemented boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text,
  price_range text,
  features text[] not null default '{}',
  brand text,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_scripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text,
  script_type text,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coaching_suggestions_conversation_id_idx
  on public.coaching_suggestions (conversation_id);
create index if not exists products_organization_id_idx on public.products (organization_id);
create index if not exists sales_scripts_organization_id_idx on public.sales_scripts (organization_id);
create index if not exists conversation_analyses_primary_emotion_idx
  on public.conversation_analyses (primary_emotion);

alter table public.coaching_suggestions enable row level security;
alter table public.products enable row level security;
alter table public.sales_scripts enable row level security;

create policy "members can view coaching for their conversations"
  on public.coaching_suggestions for select to authenticated
  using (
    conversation_id in (
      select id from public.conversations
      where organization_id in (select public.user_organization_ids())
    )
  );

create policy "members can view products in their organization"
  on public.products for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "members can view scripts in their organization"
  on public.sales_scripts for select to authenticated
  using (organization_id in (select public.user_organization_ids()));
