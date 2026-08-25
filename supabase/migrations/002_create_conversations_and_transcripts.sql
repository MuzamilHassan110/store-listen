create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  store_id uuid references public.stores(id),
  salesman_id uuid references public.salesmen(id),
  device_id text,
  duration_seconds integer,
  language text,
  recording_url text,
  status text not null default 'recorded',
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  text text,
  language text,
  is_auto_generated boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists conversations_organization_id_idx on public.conversations (organization_id);
create index if not exists conversations_store_id_idx on public.conversations (store_id);
create index if not exists conversations_recorded_at_idx on public.conversations (recorded_at desc);
create index if not exists transcripts_conversation_id_idx on public.transcripts (conversation_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute procedure public.set_updated_at();

alter table public.conversations enable row level security;
alter table public.transcripts enable row level security;

create policy "users can view conversations in their organization"
  on public.conversations for select to authenticated
  using (organization_id in (select public.user_organization_ids()));

create policy "users can insert conversations for their organization"
  on public.conversations for insert to authenticated
  with check (organization_id in (select public.user_organization_ids()));

create policy "users can view transcripts for conversations in their organization"
  on public.transcripts for select to authenticated
  using (
    conversation_id in (
      select id from public.conversations
      where organization_id in (select public.user_organization_ids())
    )
  );

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;
