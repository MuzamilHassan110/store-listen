import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import {
  analyzeConversation,
  detectSpeakerSegments,
  enhanceTranscript,
  type ConversationAnalysisResult,
} from "./analysis.service.js";
import { downloadRecordingBuffer, recordingPathFromConversation } from "./storage.service.js";

export type ConversationAnalysisRow = {
  id: string;
  conversation_id: string;
  summary: string | null;
  sentiment: string | null;
  purchase_intent: string | null;
  objections: string[];
  key_points: string[];
  customer_questions: string[];
  language: string | null;
  duration_spoken_seconds: number | null;
  ai_model: string | null;
  ai_processed_at: string | null;
  created_at: string | null;
};

export type ConversationBundle = {
  conversation: Record<string, unknown>;
  transcript: Record<string, unknown> | null;
  analysis: ConversationAnalysisRow | null;
  segments: Array<Record<string, unknown>>;
};

export async function setConversationStatus(conversationId: string, status: string): Promise<void> {
  const { error } = await getSupabase().from("conversations").update({ status }).eq("id", conversationId);
  if (error) {
    logger.error({ error, conversationId, status }, "Failed to update conversation status");
  }
}

export async function getConversationBundle(
  conversationId: string,
  organizationId: string,
): Promise<ConversationBundle | null> {
  const supabase = getSupabase();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    logger.error({ error, conversationId }, "Failed to load conversation");
    throw new HttpError(500, "Failed to load conversation.", "CONVERSATION_LOAD_FAILED");
  }
  if (!conversation) return null;

  const { data: transcript } = await supabase
    .from("transcripts")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: analysis } = await supabase
    .from("conversation_analyses")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: segments } = transcript?.id
    ? await supabase
        .from("transcript_segments")
        .select("*")
        .eq("transcript_id", transcript.id)
        .order("start_time", { ascending: true })
    : { data: [] };

  return {
    conversation,
    transcript: transcript ?? null,
    analysis: analysis ?? null,
    segments: segments ?? [],
  };
}

async function upsertTranscript(conversationId: string, text: string, language: string | null) {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("transcripts")
    .select("id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("transcripts")
      .update({ text, language, is_auto_generated: true })
      .eq("id", existing.id)
      .select()
      .single();
    if (error || !data) throw new HttpError(500, "Failed to update transcript.", "TRANSCRIPT_UPDATE_FAILED");
    return data;
  }

  const { data, error } = await supabase
    .from("transcripts")
    .insert({ conversation_id: conversationId, text, language, is_auto_generated: true })
    .select()
    .single();
  if (error || !data) throw new HttpError(500, "Failed to save transcript.", "TRANSCRIPT_INSERT_FAILED");
  return data;
}

async function replaceSegments(
  transcriptId: string,
  segments: Array<{ speaker: string; text: string; start: number; end: number }>,
) {
  const supabase = getSupabase();
  await supabase.from("transcript_segments").delete().eq("transcript_id", transcriptId);
  if (segments.length === 0) return [];

  const { data, error } = await supabase
    .from("transcript_segments")
    .insert(
      segments.map((segment) => ({
        transcript_id: transcriptId,
        speaker: segment.speaker,
        text: segment.text,
        start_time: segment.start,
        end_time: segment.end,
      })),
    )
    .select();

  if (error) {
    logger.error({ error, transcriptId }, "Failed to save transcript segments");
    throw new HttpError(500, "Failed to save transcript segments.", "SEGMENTS_INSERT_FAILED");
  }
  return data ?? [];
}

async function insertAnalysis(conversationId: string, analysis: ConversationAnalysisResult) {
  const { data, error } = await getSupabase()
    .from("conversation_analyses")
    .insert({
      conversation_id: conversationId,
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      purchase_intent: analysis.purchase_intent,
      objections: analysis.objections,
      key_points: analysis.key_points,
      customer_questions: analysis.customer_questions,
      language: analysis.language,
      duration_spoken_seconds: analysis.duration_spoken_seconds,
      ai_model: env.GEMINI_MODEL,
      ai_processed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    logger.error({ error, conversationId }, "Failed to save conversation analysis");
    throw new HttpError(500, "Failed to save analysis.", "ANALYSIS_INSERT_FAILED");
  }
  return data as ConversationAnalysisRow;
}

export async function persistAnalysisResult(input: {
  conversationId: string;
  liveTranscript: string;
  analysis: ConversationAnalysisResult;
}): Promise<ConversationBundle> {
  const enhanced = enhanceTranscript(input.analysis.transcript, input.liveTranscript);
  const transcript = await upsertTranscript(input.conversationId, enhanced, input.analysis.language);
  const segments = detectSpeakerSegments(enhanced, input.analysis.duration_spoken_seconds);
  const savedSegments = await replaceSegments(transcript.id, segments);
  const analysis = await insertAnalysis(input.conversationId, {
    ...input.analysis,
    transcript: enhanced,
  });
  await setConversationStatus(input.conversationId, "analyzed");

  const { data: conversation } = await getSupabase().from("conversations").select("*").eq("id", input.conversationId).single();
  return {
    conversation: conversation ?? { id: input.conversationId, status: "analyzed" },
    transcript,
    analysis,
    segments: savedSegments,
  };
}

export async function loadAudioForConversation(conversation: {
  id: string;
  organization_id: string;
  store_id: string | null;
  recording_path?: string | null;
  recorded_at?: string | null;
  created_at?: string | null;
}): Promise<{ buffer: Buffer; mimeType: string }> {
  const path = recordingPathFromConversation(conversation);
  const downloaded = await downloadRecordingBuffer(path);
  return { buffer: downloaded.buffer, mimeType: downloaded.contentType };
}
