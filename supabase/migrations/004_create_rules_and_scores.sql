-- Salesman scores on each analysis row, plus org conversation rules.

alter table public.conversation_analyses
  add column if not exists overall_score integer,
  add column if not exists communication_score integer,
  add column if not exists product_knowledge_score integer,
  add column if not exists objection_handling_score integer,
  add column if not exists closing_ability_score integer,
  add column if not exists rule_compliance_score integer,
  add column if not exists strengths text[] not null default '{}',
  add column if not exists weaknesses text[] not null default '{}',
  add column if not exists recommendations text[] not null default '{}';

create table if not exists public.conversation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_type text not null,
  description text not null,
  keywords text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_rule_results (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  rule_id uuid not null references public.conversation_rules(id) on delete cascade,
  is_followed boolean,
  evidence text,
  created_at timestamptz not null default now()
);

create index if not exists conversation_rules_organization_id_idx
  on public.conversation_rules (organization_id);
create index if not exists conversation_rule_results_conversation_id_idx
  on public.conversation_rule_results (conversation_id);
create index if not exists conversation_analyses_overall_score_idx
  on public.conversation_analyses (overall_score);

drop trigger if exists conversation_rules_set_updated_at on public.conversation_rules;
create trigger conversation_rules_set_updated_at
  before update on public.conversation_rules
  for each row execute procedure public.set_updated_at();

alter table public.conversation_rules enable row level security;
alter table public.conversation_rule_results enable row level security;

create policy "members can view conversation rules"
  on public.conversation_rules for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "members can insert conversation rules"
  on public.conversation_rules for insert to authenticated
  with check (organization_id in (select public.user_organization_ids()));

create policy "members can update conversation rules"
  on public.conversation_rules for update to authenticated
  using (organization_id in (select public.user_organization_ids()))
  with check (organization_id in (select public.user_organization_ids()));

create policy "members can view rule results in their organization"
  on public.conversation_rule_results for select to authenticated
  using (
    conversation_id in (
      select id from public.conversations
      where organization_id in (select public.user_organization_ids())
    )
  );

insert into public.conversation_rules (organization_id, rule_type, description, keywords)
select
  org.id,
  seed.rule_type,
  seed.description,
  seed.keywords
from public.organizations org
cross join (
  values
    ('greeting', 'Greeting required', array['salam', 'hello', 'welcome', 'assalam']),
    ('budget', 'Ask budget', array['budget', 'price range', 'kitna', 'range']),
    ('warranty', 'Explain warranty', array['warranty', 'guarantee', 'waranti']),
    ('return_policy', 'Explain return policy', array['return', 'exchange', 'wapsi']),
    ('custom', 'Mention benefits', array['benefit', 'faida', 'feature', 'advantage']),
    ('discount', 'No unauthorized discount', array['extra discount', 'special price'])
) as seed(rule_type, description, keywords)
where not exists (
  select 1
  from public.conversation_rules existing
  where existing.organization_id = org.id
    and existing.rule_type = seed.rule_type
    and existing.description = seed.description
);
