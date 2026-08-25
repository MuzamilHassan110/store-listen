import { getSupabase } from "../lib/supabase.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";

const BUCKET = "recordings";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

export function buildRecordingObjectPath(
  organizationId: string,
  storeId: string | null,
  conversationId: string,
): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${organizationId}/${storeId ?? "unassigned"}/${date}/${conversationId}.webm`;
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
