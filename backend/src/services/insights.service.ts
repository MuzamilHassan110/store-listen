import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import { buildCoachingTips, saveCoachingSuggestions } from "./coaching.service.js";
import { detectEmotion } from "./emotion.service.js";
import { analyzeTone, type ToneSegment } from "./tone.service.js";

export async function persistAdvancedInsights(input: {
  conversationId: string;
  analysisId: string;
  transcript: string;
  sentiment?: string | null;
  objections?: string[] | null;
  segments: ToneSegment[];
}): Promise<void> {
  try {
    const emotion = detectEmotion(input.transcript, {
      sentiment: input.sentiment,
      objections: input.objections ?? [],
    });
    const tone = analyzeTone(input.transcript, input.segments);
    const coaching = buildCoachingTips(input.transcript, input.segments);
    const { error } = await getSupabase()
      .from("conversation_analyses")
      .update({
        primary_emotion: emotion.primary_emotion,
        emotion_scores: emotion.emotion_scores,
        emotional_intensity: emotion.emotional_intensity,
        emotion_triggers: emotion.emotion_triggers,
        tone_analysis: tone,
      })
      .eq("id", input.analysisId);
    if (error) {
      logger.warn({ error, conversationId: input.conversationId }, "Advanced AI columns missing; run migration 013");
      return;
    }
    await saveCoachingSuggestions(input.conversationId, coaching);
  } catch (err) {
    logger.warn({ err, conversationId: input.conversationId }, "Advanced AI enrich skipped");
  }
}

export async function loadInsightOverview(organizationId: string) {
  const { data: conversations } = await getSupabase()
    .from("conversations")
    .select("id, conversation_analyses (primary_emotion, tone_analysis, emotional_intensity)")
    .eq("organization_id", organizationId)
    .limit(400);
  const emotionCounts: Record<string, number> = {};
  const toneTotals = { confidence: 0, professionalism: 0, enthusiasm: 0, empathy: 0, assertiveness: 0, n: 0 };
  for (const row of conversations ?? []) {
    const analyses = Array.isArray(row.conversation_analyses)
      ? row.conversation_analyses
      : row.conversation_analyses
        ? [row.conversation_analyses]
        : [];
    const analysis = analyses[0] as Record<string, unknown> | undefined;
    const emotion = analysis?.primary_emotion ? String(analysis.primary_emotion) : "neutral";
    emotionCounts[emotion] = (emotionCounts[emotion] ?? 0) + 1;
    const tone = (analysis?.tone_analysis ?? {}) as Record<string, number>;
    if (tone.confidence_score != null) {
      toneTotals.confidence += Number(tone.confidence_score);
      toneTotals.professionalism += Number(tone.professionalism_score ?? 0);
      toneTotals.enthusiasm += Number(tone.enthusiasm_score ?? 0);
      toneTotals.empathy += Number(tone.empathy_score ?? 0);
      toneTotals.assertiveness += Number(tone.assertiveness_score ?? 0);
      toneTotals.n += 1;
    }
  }
  const { data: customers } = await getSupabase()
    .from("customers")
    .select("churn_risk")
    .eq("organization_id", organizationId)
    .limit(400);
  const churn = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (const row of customers ?? []) {
    const risk = String(row.churn_risk ?? "unknown");
    if (risk === "high" || risk === "medium" || risk === "low") churn[risk] += 1;
    else churn.unknown += 1;
  }
  const conversationIds = (conversations ?? []).map((row) => String(row.id));
  const { data: coachingRows } = conversationIds.length
    ? await getSupabase()
        .from("coaching_suggestions")
        .select("priority, is_implemented, trigger")
        .in("conversation_id", conversationIds)
    : { data: [] as Array<{ priority: string | null; is_implemented: boolean | null; trigger: string | null }> };
  const coachingTips = (coachingRows ?? []).filter((row) => !String(row.trigger ?? "").startsWith("missed_"));
  const implemented = coachingTips.filter((row) => row.is_implemented).length;
  const { count: productCount } = await getSupabase()
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  const { count: scriptCount } = await getSupabase()
    .from("sales_scripts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  const n = Math.max(1, toneTotals.n);
  return {
    emotion: Object.entries(emotionCounts).map(([name, value]) => ({ name, value })),
    average_tone: {
      confidence: Math.round(toneTotals.confidence / n),
      professionalism: Math.round(toneTotals.professionalism / n),
      enthusiasm: Math.round(toneTotals.enthusiasm / n),
      empathy: Math.round(toneTotals.empathy / n),
      assertiveness: Math.round(toneTotals.assertiveness / n),
    },
    churn,
    conversations_scanned: conversations?.length ?? 0,
    coaching: {
      total: coachingTips.length,
      implemented,
      high_priority: coachingTips.filter((row) => row.priority === "high").length,
      effectiveness_rate: coachingTips.length ? Math.round((implemented / coachingTips.length) * 100) : 0,
    },
    products: { catalog: productCount ?? 0 },
    scripts: { saved: scriptCount ?? 0 },
  };
}
