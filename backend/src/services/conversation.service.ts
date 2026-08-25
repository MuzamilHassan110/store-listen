import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import {
  detectSpeakerSegments,
  resolveTranscripts,
  type ConversationAnalysisResult,
} from "./analysis.service.js";
import { normalizeLanguage } from "./language.js";
import {
  compliancePercent,
  evaluateAndSaveRules,
  getConversationRuleResults,
  type RuleEvaluation,
} from "./rules.service.js";
import { processConversationInsights } from "./lead.service.js";
import { scoreConversation, type ConversationScore } from "./scoring.service.js";
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
  language_code?: string | null;
  language_confidence?: number | null;
  summary_original?: string | null;
  language_specific_insights?: Record<string, unknown> | null;
  duration_spoken_seconds: number | null;
  ai_model: string | null;
  ai_processed_at: string | null;
  created_at: string | null;
  overall_score?: number | null;
  communication_score?: number | null;
  product_knowledge_score?: number | null;
  objection_handling_score?: number | null;
  closing_ability_score?: number | null;
  rule_compliance_score?: number | null;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
};

export type ConversationBundle = {
  conversation: Record<string, unknown>;
  transcript: Record<string, unknown> | null;
  analysis: ConversationAnalysisRow | null;
  segments: Array<Record<string, unknown>>;
  rule_results: RuleEvaluation[];
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

  let ruleResults: RuleEvaluation[] = [];
  try {
    ruleResults = await getConversationRuleResults(conversationId, organizationId);
  } catch (err) {
    if (err instanceof HttpError && err.code !== "NOT_FOUND") {
      logger.error({ err, conversationId }, "Failed to load rule results for bundle");
    }
  }

  return {
    conversation,
    transcript: transcript ?? null,
    analysis: analysis ?? null,
    segments: segments ?? [],
    rule_results: ruleResults,
  };
}

async function upsertTranscript(
  conversationId: string,
  payload: {
    text: string;
    language: string | null;
    original_text?: string | null;
    translated_text?: string | null;
    original_language?: string | null;
    translation_language?: string | null;
  },
) {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("transcripts")
    .select("id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const withLanguage = {
    text: payload.text,
    language: payload.language,
    is_auto_generated: true,
    original_text: payload.original_text ?? null,
    translated_text: payload.translated_text ?? null,
    original_language: payload.original_language ?? payload.language,
    translation_language: payload.translation_language ?? "en",
  };
  const base = { text: payload.text, language: payload.language, is_auto_generated: true };

  if (existing?.id) {
    const updated = await supabase.from("transcripts").update(withLanguage).eq("id", existing.id).select().single();
    if (!updated.error && updated.data) return updated.data;
    logger.warn({ error: updated.error, conversationId }, "Saving transcript without translation columns; run migration 007");
    const { data, error } = await supabase.from("transcripts").update(base).eq("id", existing.id).select().single();
    if (error || !data) throw new HttpError(500, "Failed to update transcript.", "TRANSCRIPT_UPDATE_FAILED");
    return data;
  }

  const inserted = await supabase
    .from("transcripts")
    .insert({ conversation_id: conversationId, ...withLanguage })
    .select()
    .single();
  if (!inserted.error && inserted.data) return inserted.data;
  logger.warn({ error: inserted.error, conversationId }, "Saving transcript without translation columns; run migration 007");
  const { data, error } = await supabase
    .from("transcripts")
    .insert({ conversation_id: conversationId, ...base })
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

async function insertAnalysis(
  conversationId: string,
  analysis: ConversationAnalysisResult,
  score: ConversationScore,
) {
  const language = normalizeLanguage(analysis.language_code || analysis.language);
  const languageFields = {
    language_code: language,
    language_confidence: analysis.language_confidence ?? null,
    summary_original: analysis.summary_original || null,
    language_specific_insights: analysis.language_specific_insights ?? {},
  };
  const base = {
    conversation_id: conversationId,
    summary: analysis.summary,
    sentiment: analysis.sentiment,
    purchase_intent: analysis.purchase_intent,
    objections: analysis.objections,
    key_points: analysis.key_points,
    customer_questions: analysis.customer_questions,
    language,
    duration_spoken_seconds: analysis.duration_spoken_seconds,
    ai_model: env.GEMINI_MODEL,
    ai_processed_at: new Date().toISOString(),
  };
  const supabase = getSupabase();
  const withLanguage = await supabase
    .from("conversation_analyses")
    .insert({ ...base, ...languageFields, ...score })
    .select()
    .single();
  if (!withLanguage.error && withLanguage.data) return withLanguage.data as ConversationAnalysisRow;

  logger.warn({ error: withLanguage.error, conversationId }, "Saving analysis without language columns; run migration 007");
  const withScores = await supabase.from("conversation_analyses").insert({ ...base, ...score }).select().single();
  if (!withScores.error && withScores.data) return withScores.data as ConversationAnalysisRow;

  logger.warn({ error: withScores.error, conversationId }, "Saving analysis without scores; run migration 004");
  const { data, error } = await supabase.from("conversation_analyses").insert(base).select().single();
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
  const resolved = resolveTranscripts(input.analysis, input.liveTranscript);
  const enhanced = resolved.scoring;
  const transcript = await upsertTranscript(input.conversationId, {
    text: enhanced,
    language: resolved.language,
    original_text: resolved.original,
    translated_text: resolved.translated,
    original_language: resolved.language,
    translation_language: "en",
  });
  const segments = detectSpeakerSegments(enhanced || resolved.original, input.analysis.duration_spoken_seconds);
  await getSupabase()
    .from("conversations")
    .update({ language: resolved.language })
    .eq("id", input.conversationId);
  const savedSegments = await replaceSegments(transcript.id, segments);

  const { data: conversationRow } = await getSupabase()
    .from("conversations")
    .select("organization_id")
    .eq("id", input.conversationId)
    .maybeSingle();
  const organizationId = conversationRow?.organization_id ? String(conversationRow.organization_id) : null;

  let ruleResults: RuleEvaluation[] = [];
  let compliance: number | null = null;
  if (organizationId) {
    try {
      ruleResults = await evaluateAndSaveRules({
        conversationId: input.conversationId,
        organizationId,
        transcript: enhanced,
      });
      compliance = compliancePercent(ruleResults);
    } catch (err) {
      logger.error({ err, conversationId: input.conversationId }, "Rule check failed after analysis");
    }
  }

  const score = scoreConversation(input.analysis, enhanced, segments, compliance);
  const analysis = await insertAnalysis(
    input.conversationId,
    { ...input.analysis, transcript: enhanced, language: resolved.language, language_code: resolved.language },
    score,
  );
  const hasScores = analysis.overall_score != null;
  await setConversationStatus(input.conversationId, hasScores ? "scored" : "analyzed");

  if (organizationId) {
    try {
      await processConversationInsights({
        conversationId: input.conversationId,
        organizationId,
        overallScore: analysis.overall_score,
        ruleCompliance: analysis.rule_compliance_score,
      });
    } catch (err) {
      logger.error({ err, conversationId: input.conversationId }, "Lead/notification hook failed");
    }
  }

  const { data: conversation } = await getSupabase().from("conversations").select("*").eq("id", input.conversationId).single();
  return {
    conversation: conversation ?? { id: input.conversationId, status: hasScores ? "scored" : "analyzed" },
    transcript,
    analysis,
    segments: savedSegments,
    rule_results: ruleResults,
  };
}

export async function scoreExistingConversation(
  conversationId: string,
  organizationId: string,
): Promise<ConversationBundle> {
  const bundle = await getConversationBundle(conversationId, organizationId);
  if (!bundle) throw new HttpError(404, "Conversation not found.", "NOT_FOUND");
  if (!bundle.analysis) {
    throw new HttpError(409, "Analyze this conversation before scoring it.", "ANALYSIS_REQUIRED");
  }

  const transcriptText = String(bundle.transcript?.text ?? "");
  const segments = bundle.segments.map((segment) => ({
    speaker: String(segment.speaker ?? "salesman"),
    text: String(segment.text ?? ""),
  }));

  const ruleResults = await evaluateAndSaveRules({
    conversationId,
    organizationId,
    transcript: transcriptText,
  });
  const score = scoreConversation(bundle.analysis, transcriptText, segments, compliancePercent(ruleResults));

  const { data, error } = await getSupabase()
    .from("conversation_analyses")
    .update(score)
    .eq("id", bundle.analysis.id)
    .select()
    .single();
  if (error || !data) {
    logger.error({ error, conversationId }, "Failed to save conversation scores");
    throw new HttpError(500, "Failed to save scores.", "SCORE_UPDATE_FAILED");
  }

  await setConversationStatus(conversationId, "scored");
  try {
    await processConversationInsights({
      conversationId,
      organizationId,
      overallScore: score.overall_score,
      ruleCompliance: score.rule_compliance_score,
    });
  } catch (err) {
    logger.error({ err, conversationId }, "Lead/notification hook failed");
  }
  const refreshed = await getConversationBundle(conversationId, organizationId);
  if (!refreshed) throw new HttpError(404, "Conversation not found.", "NOT_FOUND");
  return refreshed;
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
