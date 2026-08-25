alter table public.conversations
  add column if not exists recording_path text;

create table if not exists public.conversation_analyses (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  summary text,
  sentiment text,
  purchase_intent text,
  objections jsonb not null default '[]'::jsonb,
  key_points jsonb not null default '[]'::jsonb,
  customer_questions jsonb not null default '[]'::jsonb,
  language text,
  duration_spoken_seconds integer,
  ai_model text,
  ai_processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  speaker text,
  text text,
  start_time double precision,
  end_time double precision,
  created_at timestamptz not null default now()
);

create index if not exists conversation_analyses_conversation_id_idx
  on public.conversation_analyses (conversation_id);
create index if not exists transcript_segments_transcript_id_idx
  on public.transcript_segments (transcript_id);

drop trigger if exists conversation_analyses_set_updated_at on public.conversation_analyses;
create trigger conversation_analyses_set_updated_at
  before update on public.conversation_analyses
  for each row execute procedure public.set_updated_at();

alter table public.conversation_analyses enable row level security;
alter table public.transcript_segments enable row level security;

create policy "users can view analyses for conversations in their organization"
  on public.conversation_analyses for select to authenticated
  using (
    conversation_id in (
      select id from public.conversations
      where organization_id in (select public.user_organization_ids())
    )
  );

create policy "users can view transcript segments in their organization"
  on public.transcript_segments for select to authenticated
  using (
    transcript_id in (
      select t.id
      from public.transcripts t
      join public.conversations c on c.id = t.conversation_id
      where c.organization_id in (select public.user_organization_ids())
    )
  );
