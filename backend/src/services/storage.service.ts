import { getSupabase } from "../lib/supabase.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";

const BUCKET = "recordings";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

export function buildRecordingObjectPath(
  organizationId: string,
  storeId: string | null,
  conversationId: string,
  recordedAt = new Date(),
): string {
  const date = recordedAt.toISOString().slice(0, 10);
  return `${organizationId}/${storeId ?? "unassigned"}/${date}/${conversationId}.webm`;
}

export function recordingPathFromConversation(conversation: {
  id: string;
  organization_id: string;
  store_id: string | null;
  recording_path?: string | null;
  recorded_at?: string | null;
  created_at?: string | null;
}): string {
  if (conversation.recording_path) return conversation.recording_path;
  const stamp = conversation.recorded_at ?? conversation.created_at ?? new Date().toISOString();
  return buildRecordingObjectPath(
    conversation.organization_id,
    conversation.store_id,
    conversation.id,
    new Date(stamp),
  );
}

export async function uploadRecordingBuffer(input: {
  path: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ path: string; recordingUrl: string }> {
  const supabase = getSupabase();

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(input.path, input.buffer, {
    contentType: input.contentType,
    upsert: false,
  });

  if (uploadError) {
    logger.error({ err: uploadError, path: input.path }, "Failed to upload recording");
    throw new HttpError(500, "Failed to store the audio recording.", "STORAGE_UPLOAD_FAILED");
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(input.path, SIGNED_URL_TTL_SECONDS);

  if (signed?.signedUrl) {
    return { path: input.path, recordingUrl: signed.signedUrl };
  }

  logger.warn({ err: signedError, path: input.path }, "Signed URL failed; falling back to public URL");
  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(input.path);
  return { path: input.path, recordingUrl: publicData.publicUrl };
}

export async function downloadRecordingBuffer(path: string): Promise<{ buffer: Buffer; contentType: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);

  if (error || !data) {
    logger.error({ err: error, path }, "Failed to download recording");
    throw new HttpError(404, "Recording audio was not found in storage.", "RECORDING_NOT_FOUND");
  }

  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || "audio/webm",
  };
}
