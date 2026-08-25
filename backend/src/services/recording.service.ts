import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSupabase } from "../lib/supabase.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { buildRecordingObjectPath, uploadRecordingBuffer } from "./storage.service.js";

export const recordingBodySchema = z.object({
  duration: z.coerce.number().int().nonnegative(),
  transcript: z.string().optional().default(""),
  language: z.string().optional(),
  deviceId: z.string().min(1),
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
  transcript: {
    id: string;
    conversation_id: string;
    text: string | null;
    language: string | null;
    is_auto_generated: boolean | null;
    created_at: string | null;
  } | null;
};

export async function createRecording(input: {
  organizationId: string;
  body: RecordingBody;
  file: Express.Multer.File;
}): Promise<ConversationWithTranscript> {
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

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({
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
    })
    .select()
    .single();

  let conversationRow = conversation;
  if ((conversationError || !conversationRow) && input.body.salesmanId) {
    const retry = await supabase
      .from("conversations")
      .insert({
        id: conversationId,
        organization_id: input.organizationId,
        store_id: null,
        salesman_id: null,
        device_id: input.body.deviceId,
        duration_seconds: input.body.duration,
        language,
        recording_url: recordingUrl,
        recording_path: objectPath,
        status: "queued",
        recorded_at: recordedAt,
      })
      .select()
      .single();
    conversationRow = retry.data;
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
