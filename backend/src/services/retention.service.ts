import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";

export type RetentionStatus = {
  conversation_count: number;
  recordings_count: number;
  archived_count: number;
  oldest_conversation: string | null;
  retention_days: number;
  next_cleanup_date: string | null;
};

async function getRetentionDays(organizationId: string): Promise<number> {
  const { data } = await getSupabase()
    .from("organization_settings")
    .select("retention_days")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return Number(data?.retention_days ?? 90);
}

export async function updateRetentionDays(organizationId: string, days: number): Promise<number> {
  const { error } = await getSupabase()
    .from("organization_settings")
    .upsert({ organization_id: organizationId, retention_days: days, updated_at: new Date().toISOString() });
  if (error) throw new HttpError(500, "Failed to save retention settings.", "RETENTION_SAVE_FAILED");
  return days;
}

export async function getRetentionStatus(organizationId: string): Promise<RetentionStatus> {
  const supabase = getSupabase();
  const [{ count: conversationCount }, { data: oldest }, { count: recordingsCount }, { count: archivedCount }] =
    await Promise.all([
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase
        .from("conversations")
        .select("recorded_at")
        .eq("organization_id", organizationId)
        .order("recorded_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .not("recording_path", "is", null),
      supabase
        .from("archived_conversations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
    ]);

  const retentionDays = await getRetentionDays(organizationId);
  const oldestAt = oldest?.recorded_at ? String(oldest.recorded_at) : null;
  const next = oldestAt
    ? new Date(new Date(oldestAt).getTime() + retentionDays * 86_400_000).toISOString()
    : null;

  return {
    conversation_count: conversationCount ?? 0,
    recordings_count: recordingsCount ?? 0,
    archived_count: archivedCount ?? 0,
    oldest_conversation: oldestAt,
    retention_days: retentionDays,
    next_cleanup_date: next,
  };
}

export async function cleanupOldRecordings(organizationId: string, days?: number): Promise<{ archived: number }> {
  const retentionDays = days ?? (await getRetentionDays(organizationId));
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, organization_id, recorded_at, duration_seconds, language, status, recording_path, conversation_analyses(*), transcripts(text)")
    .eq("organization_id", organizationId)
    .lt("recorded_at", cutoff)
    .not("recording_path", "is", null)
    .limit(200);
  if (error) throw new HttpError(500, "Failed to load recordings for cleanup.", "RETENTION_LOAD_FAILED");

  let archived = 0;
  for (const row of data ?? []) {
    const analyses = Array.isArray(row.conversation_analyses) ? row.conversation_analyses : [];
    const analysis = analyses[0] as Record<string, unknown> | undefined;
    const transcripts = Array.isArray(row.transcripts) ? row.transcripts : [];
    const transcript = transcripts[0] as { text?: string } | undefined;

    const { error: insertError } = await supabase.from("archived_conversations").insert({
      original_conversation_id: row.id,
      organization_id: organizationId,
      metadata: {
        recorded_at: row.recorded_at,
        duration_seconds: row.duration_seconds,
        language: row.language,
        status: row.status,
      },
      transcript: transcript?.text ?? null,
      analysis: analysis ?? {},
      scores: {
        overall_score: analysis?.overall_score ?? null,
        communication_score: analysis?.communication_score ?? null,
        product_knowledge_score: analysis?.product_knowledge_score ?? null,
        objection_handling_score: analysis?.objection_handling_score ?? null,
        closing_ability_score: analysis?.closing_ability_score ?? null,
        rule_compliance_score: analysis?.rule_compliance_score ?? null,
      },
    });
    if (insertError) {
      logger.error({ error: insertError, conversationId: row.id }, "Failed to archive conversation");
      continue;
    }

    if (row.recording_path) {
      const { error: storageError } = await supabase.storage.from("recordings").remove([String(row.recording_path)]);
      if (storageError) logger.warn({ storageError, path: row.recording_path }, "Could not delete recording object");
    }

    await supabase
      .from("conversations")
      .update({ recording_path: null, recording_url: null })
      .eq("id", row.id);
    archived += 1;
  }

  return { archived };
}
