alter table public.transcripts
  add column if not exists original_text text,
  add column if not exists translated_text text,
  add column if not exists original_language text,
  add column if not exists translation_language text default 'en';

alter table public.conversation_analyses
  add column if not exists language_code text,
  add column if not exists language_confidence numeric,
  add column if not exists summary_original text,
  add column if not exists language_specific_insights jsonb not null default '{}'::jsonb,
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table public.conversations
  add column if not exists recording_hash text;

create unique index if not exists conversations_org_recording_hash_uidx
  on public.conversations (organization_id, recording_hash)
  where recording_hash is not null;

create table if not exists public.translation_cache (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  target_language text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, target_language)
);

create index if not exists translation_cache_org_idx
  on public.translation_cache (organization_id);

alter table public.translation_cache enable row level security;

create policy "users can view translation cache in their organization"
  on public.translation_cache for select to authenticated
  using (organization_id in (select public.user_organization_ids()));
