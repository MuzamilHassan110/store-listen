-- Query indexes for dashboard, follow-ups, and audit lists.

create index if not exists idx_conversations_org_date
  on public.conversations (organization_id, recorded_at desc);
create index if not exists idx_conversations_status
  on public.conversations (status);
create index if not exists idx_transcripts_conversation
  on public.transcripts (conversation_id);
create index if not exists idx_analyses_conversation
  on public.conversation_analyses (conversation_id);
create index if not exists idx_followups_status
  on public.follow_ups (status, follow_up_date);
create index if not exists idx_notifications_user
  on public.notifications (user_id, is_read);
create index if not exists idx_audit_logs_org
  on public.audit_logs (organization_id, created_at desc);
