import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashRecordingBuffer } from "../lib/hash.js";
import { getSupabase } from "../lib/supabase.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { buildRecordingObjectPath, uploadRecordingBuffer } from "./storage.service.js";

export const recordingBodySchema = z.object({
  duration: z.coerce.number().int().nonnegative(),
  transcript: z.string().optional().default(""),
  language: z.string().optional(),
  deviceId: z.string().min(1),
  recordingHash: z.string().optional(),
  salesmanId: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return null;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        ? value
        : null;
    }),
});

export type RecordingBody = z.infer<typeof recordingBodySchema>;

export type ConversationWithTranscript = {
  id: string;
  organization_id: string;
  store_id: string | null;
  salesman_id: string | null;
  device_id: string | null;
  duration_seconds: number | null;
  language: string | null;
  recording_url: string | null;
  recording_path: string | null;
  status: string | null;
  recorded_at: string | null;
  created_at: string | null;
  recording_hash?: string | null;
  duplicate?: boolean;
  transcript: {
    id: string;
    conversation_id: string;
    text: string | null;
    language: string | null;
    is_auto_generated: boolean | null;
    created_at: string | null;
  } | null;
};

export async function findConversationByHash(
  organizationId: string,
  recordingHash: string,
): Promise<ConversationWithTranscript | null> {
  if (!recordingHash) return null;
  const supabase = getSupabase();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("recording_hash", recordingHash)
    .maybeSingle();
  if (error || !conversation) return null;

  const { data: transcript } = await supabase
    .from("transcripts")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { ...conversation, transcript: transcript ?? null, duplicate: true };
}

export async function createRecording(input: {
  organizationId: string;
  body: RecordingBody;
  file: Express.Multer.File;
}): Promise<ConversationWithTranscript> {
  const recordingHash = hashRecordingBuffer(input.file.buffer);
  const existing = await findConversationByHash(input.organizationId, recordingHash);
  if (existing) return existing;

  const conversationId = randomUUID();
  const language = input.body.language?.trim() || null;
  const transcriptText = input.body.transcript.trim();
  const objectPath = buildRecordingObjectPath(input.organizationId, null, conversationId);

  const { recordingUrl } = await uploadRecordingBuffer({
    path: objectPath,
    buffer: input.file.buffer,
    contentType: input.file.mimetype || "audio/webm",
  });

  const recordedAt = new Date().toISOString();
  const supabase = getSupabase();
  const row = {
    id: conversationId,
    organization_id: input.organizationId,
    store_id: null,
    salesman_id: input.body.salesmanId,
    device_id: input.body.deviceId,
    duration_seconds: input.body.duration,
    language,
    recording_url: recordingUrl,
    recording_path: objectPath,
    status: "queued",
    recorded_at: recordedAt,
  };

  let conversationError: unknown = null;
  const withHash = await supabase.from("conversations").insert({ ...row, recording_hash: recordingHash }).select().single();
  let conversationRow = withHash.data;
  conversationError = withHash.error;
  if (!conversationRow) {
    logger.warn({ error: withHash.error }, "Saving conversation without recording_hash; run migration 007");
    const withoutHash = await supabase.from("conversations").insert(row).select().single();
    conversationRow = withoutHash.data;
    conversationError = withoutHash.error;
  }

  if ((conversationError || !conversationRow) && input.body.salesmanId) {
    const retry = await supabase
      .from("conversations")
      .insert({ ...row, salesman_id: null, recording_hash: recordingHash })
      .select()
      .single();
    conversationRow = retry.data;
    if (!conversationRow) {
      const retryBase = await supabase.from("conversations").insert({ ...row, salesman_id: null }).select().single();
      conversationRow = retryBase.data;
    }
  }

  if (!conversationRow) {
    logger.error({ err: conversationError }, "Failed to insert conversation");
    throw new HttpError(500, "Failed to save conversation metadata.", "CONVERSATION_INSERT_FAILED");
  }

  const { data: transcriptRow, error: transcriptError } = await supabase
    .from("transcripts")
    .insert({
      conversation_id: conversationId,
      text: transcriptText,
      language,
      is_auto_generated: true,
    })
    .select()
    .single();

  if (transcriptError || !transcriptRow) {
    logger.error({ err: transcriptError }, "Failed to insert transcript");
    throw new HttpError(500, "Failed to save transcript.", "TRANSCRIPT_INSERT_FAILED");
  }

  const transcript = transcriptRow;

  return { ...conversationRow, transcript };
}
