import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import { isSupportedLanguage, languageDisplayName, normalizeLanguage, type SupportedLanguage } from "./language.js";

const transcriptTranslationSchema = z.object({
  text: z.string().default(""),
});

const analysisTranslationSchema = z.object({
  summary: z.string().default(""),
  objections: z.array(z.string()).default([]),
  key_points: z.array(z.string()).default([]),
  customer_questions: z.array(z.string()).default([]),
});

export type TranslatedAnalysis = z.infer<typeof analysisTranslationSchema>;

export type ConversationTranslation = {
  language: SupportedLanguage;
  cached: boolean;
  transcript: {
    id: string | null;
    original: string;
    translated: string;
    original_language: string | null;
  };
  analysis: {
    id: string | null;
    summary: string;
    objections: string[];
    key_points: string[];
    customer_questions: string[];
    language_specific_insights: Record<string, unknown> | null;
  } | null;
};

function getModel() {
  if (!env.GEMINI_API_KEY) {
    throw new HttpError(500, "Gemini API key is not configured.", "GEMINI_NOT_CONFIGURED");
  }
  const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return client.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(raw) as unknown;
}

async function generateJson(prompt: string): Promise<unknown> {
  const model = getModel();
  const result = await model.generateContent([{ text: prompt }]);
  return extractJson(result.response.text());
}

async function readCache(
  organizationId: string,
  sourceType: string,
  sourceId: string,
  targetLanguage: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await getSupabase()
    .from("translation_cache")
    .select("payload")
    .eq("organization_id", organizationId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("target_language", targetLanguage)
    .maybeSingle();
  if (error || !data?.payload) return null;
  return data.payload as Record<string, unknown>;
}

async function writeCache(
  organizationId: string,
  sourceType: string,
  sourceId: string,
  targetLanguage: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await getSupabase().from("translation_cache").upsert(
    {
      organization_id: organizationId,
      source_type: sourceType,
      source_id: sourceId,
      target_language: targetLanguage,
      payload,
    },
    { onConflict: "source_type,source_id,target_language" },
  );
  if (error) {
    logger.warn({ error, sourceType, sourceId, targetLanguage }, "Could not cache translation; run migration 007");
  }
}

export async function translateTranscript(transcriptId: string, targetLanguage: string): Promise<string> {
  const language = normalizeLanguage(targetLanguage);
  const supabase = getSupabase();
  const { data: transcript, error } = await supabase.from("transcripts").select("*").eq("id", transcriptId).maybeSingle();
  if (error || !transcript) throw new HttpError(404, "Transcript not found.", "NOT_FOUND");

  const originalLanguage = normalizeLanguage(
    String(transcript.original_language ?? transcript.language ?? "en"),
  );
  const source = String(transcript.original_text ?? transcript.text ?? "");
  if (!source.trim()) return "";
  if (originalLanguage === language) return source;

  if (language === "en" && transcript.translated_text) {
    return String(transcript.translated_text);
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("organization_id")
    .eq("id", transcript.conversation_id)
    .maybeSingle();
  const organizationId = conversation?.organization_id ? String(conversation.organization_id) : null;
  if (organizationId) {
    const cached = await readCache(organizationId, "transcript", transcriptId, language);
    if (cached?.text) return String(cached.text);
  }

  const parsed = transcriptTranslationSchema.parse(
    await generateJson(
      `Translate this labeled sales transcript into ${languageDisplayName(language)} (${language}).
Preserve speaker labels such as "Salesman:" and "Customer:" on their own lines.
Do not add commentary. Return ONLY JSON: { "text": "..." }

Transcript:
${source.slice(0, 12000)}`,
    ),
  );

  if (language === "en") {
    const { error: updateError } = await supabase
      .from("transcripts")
      .update({ translated_text: parsed.text, translation_language: "en" })
      .eq("id", transcriptId);
    if (updateError) {
      logger.warn({ updateError, transcriptId }, "Could not persist English transcript translation");
    }
  }

  if (organizationId) {
    await writeCache(organizationId, "transcript", transcriptId, language, { text: parsed.text });
  }
  return parsed.text;
}

export async function translateAnalysis(analysisId: string, targetLanguage: string): Promise<TranslatedAnalysis> {
  const language = normalizeLanguage(targetLanguage);
  const supabase = getSupabase();
  const { data: analysis, error } = await supabase
    .from("conversation_analyses")
    .select("*")
    .eq("id", analysisId)
    .maybeSingle();
  if (error || !analysis) throw new HttpError(404, "Analysis not found.", "NOT_FOUND");

  const originalLanguage = normalizeLanguage(String(analysis.language_code ?? analysis.language ?? "en"));
  const source: TranslatedAnalysis = {
    summary:
      language === originalLanguage && analysis.summary_original
        ? String(analysis.summary_original)
        : String(analysis.summary ?? ""),
    objections: Array.isArray(analysis.objections) ? analysis.objections.map(String) : [],
    key_points: Array.isArray(analysis.key_points) ? analysis.key_points.map(String) : [],
    customer_questions: Array.isArray(analysis.customer_questions) ? analysis.customer_questions.map(String) : [],
  };

  if (originalLanguage === language && analysis.summary_original) {
    return { ...source, summary: String(analysis.summary_original) };
  }
  if (language === "en") return source;

  const stored = analysis.translations && typeof analysis.translations === "object"
    ? (analysis.translations as Record<string, TranslatedAnalysis>)
    : null;
  if (stored?.[language]?.summary) return stored[language];

  const { data: conversation } = await supabase
    .from("conversations")
    .select("organization_id")
    .eq("id", analysis.conversation_id)
    .maybeSingle();
  const organizationId = conversation?.organization_id ? String(conversation.organization_id) : null;
  if (organizationId) {
    const cached = await readCache(organizationId, "analysis", analysisId, language);
    if (cached) {
      const parsed = analysisTranslationSchema.safeParse(cached);
      if (parsed.success) return parsed.data;
    }
  }

  const parsed = analysisTranslationSchema.parse(
    await generateJson(
      `Translate this conversation analysis into ${languageDisplayName(language)} (${language}).
Keep lists as arrays. Return ONLY JSON:
{ "summary": "", "objections": [], "key_points": [], "customer_questions": [] }

Source JSON:
${JSON.stringify(source).slice(0, 12000)}`,
    ),
  );

  const nextTranslations = { ...(stored ?? {}), [language]: parsed };
  const { error: updateError } = await supabase
    .from("conversation_analyses")
    .update({ translations: nextTranslations })
    .eq("id", analysisId);
  if (updateError) {
    logger.warn({ updateError, analysisId }, "Could not persist analysis translations");
  }
  if (organizationId) {
    await writeCache(organizationId, "analysis", analysisId, language, parsed);
  }
  return parsed;
}

export async function translateConversation(
  conversationId: string,
  organizationId: string,
  targetLanguage: string,
): Promise<ConversationTranslation> {
  if (!isSupportedLanguage(normalizeLanguage(targetLanguage))) {
    throw new HttpError(400, "Unsupported language.", "UNSUPPORTED_LANGUAGE");
  }
  const language = normalizeLanguage(targetLanguage);
  const supabase = getSupabase();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!conversation) throw new HttpError(404, "Conversation not found.", "NOT_FOUND");

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

  const original = String(transcript?.original_text ?? transcript?.text ?? "");
  let translated = "";
  let cached = false;

  if (transcript?.id) {
    const existing =
      language === "en" && transcript.translated_text
        ? String(transcript.translated_text)
        : language === normalizeLanguage(String(transcript.original_language ?? transcript.language ?? "en"))
          ? original
          : null;
    if (existing != null && existing.length > 0) {
      translated = existing;
      cached = true;
    } else {
      const cacheHit = await readCache(organizationId, "transcript", String(transcript.id), language);
      if (cacheHit?.text) {
        translated = String(cacheHit.text);
        cached = true;
      } else {
        translated = await translateTranscript(String(transcript.id), language);
      }
    }
  }

  let translatedAnalysis: ConversationTranslation["analysis"] = null;
  if (analysis?.id) {
    const cacheHit = await readCache(organizationId, "analysis", String(analysis.id), language);
    const parsedCache = cacheHit ? analysisTranslationSchema.safeParse(cacheHit) : null;
    const result = parsedCache?.success ? parsedCache.data : await translateAnalysis(String(analysis.id), language);
    if (parsedCache?.success) cached = cached || true;
    translatedAnalysis = {
      id: String(analysis.id),
      summary: result.summary,
      objections: result.objections,
      key_points: result.key_points,
      customer_questions: result.customer_questions,
      language_specific_insights:
        analysis.language_specific_insights && typeof analysis.language_specific_insights === "object"
          ? (analysis.language_specific_insights as Record<string, unknown>)
          : null,
    };
  }

  return {
    language,
    cached,
    transcript: {
      id: transcript?.id ? String(transcript.id) : null,
      original,
      translated,
      original_language: transcript?.original_language ? String(transcript.original_language) : transcript?.language ? String(transcript.language) : null,
    },
    analysis: translatedAnalysis,
  };
}
