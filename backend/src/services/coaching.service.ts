import { countPhrase } from "./nlp.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";

export type CoachingPriority = "high" | "medium" | "low";

export type CoachingTip = {
  trigger: string;
  suggestion: string;
  priority: CoachingPriority;
  timestamp: number;
};

export type MissedOpportunity = {
  type: string;
  description: string;
  timestamp: number;
};

export type CoachingResult = {
  tips: CoachingTip[];
  missed_opportunities: MissedOpportunity[];
};

export type CoachingSegment = { speaker?: string; text?: string; start_time?: number; end_time?: number };

function stamp(segments: CoachingSegment[], fallback: number): number {
  const customer = segments.find((segment) => String(segment.speaker) === "customer");
  return Number(customer?.start_time ?? fallback);
}

export function buildCoachingTips(transcript: string, segments: CoachingSegment[] = []): CoachingResult {
  const text = transcript.toLowerCase();
  const tips: CoachingTip[] = [];
  const missed: MissedOpportunity[] = [];
  const priceHits = ["price", "mehnga", "expensive", "budget", "kitna"].reduce(
    (sum, word) => sum + countPhrase(text, word),
    0,
  );
  const hesitate = countPhrase(text, "sochna") + countPhrase(text, "think") + countPhrase(text, "later");
  const interest = countPhrase(text, "i'll take") + countPhrase(text, "le lunga") + countPhrase(text, "interested");
  const objection = countPhrase(text, "problem") + countPhrase(text, "issue") + countPhrase(text, "but");
  const closeAsk = countPhrase(text, "shall i book") + countPhrase(text, "order") + countPhrase(text, "card");

  if (priceHits >= 2) {
    tips.push({
      trigger: "price_objection",
      suggestion: `Customer mentioned price ${priceHits} times. Try explaining financing options or EMI plans.`,
      priority: "high",
      timestamp: stamp(segments, 120),
    });
  }
  if (hesitate >= 1) {
    tips.push({
      trigger: "hesitation",
      suggestion: "Customer is hesitant. Offer a trial, demo, or a callback after they talk to family.",
      priority: "medium",
      timestamp: stamp(segments, 180),
    });
  }
  if (interest >= 1) {
    tips.push({
      trigger: "buying_signal",
      suggestion: "Customer showed interest. Ask for the sale and confirm payment or delivery.",
      priority: "high",
      timestamp: stamp(segments, 240),
    });
  }
  if (objection >= 1) {
    tips.push({
      trigger: "objection",
      suggestion: "Acknowledge the concern, then address it with a specific feature or policy.",
      priority: "medium",
      timestamp: stamp(segments, 90),
    });
  }
  if (transcript.trim().length > 80 && !/\?/.test(transcript)) {
    tips.push({
      trigger: "silence_or_closed",
      suggestion: "Ask an open-ended question so the customer keeps talking about their needs.",
      priority: "low",
      timestamp: 30,
    });
  }
  if (interest >= 1 && closeAsk === 0) {
    missed.push({
      type: "closing",
      description: "Customer showed high interest but the salesman did not ask for the sale.",
      timestamp: stamp(segments, 300),
    });
  }
  if (priceHits >= 1 && countPhrase(text, "emi") === 0 && countPhrase(text, "installment") === 0) {
    missed.push({
      type: "value",
      description: "Price came up but financing / EMI was never mentioned.",
      timestamp: stamp(segments, 200),
    });
  }

  return { tips, missed_opportunities: missed };
}

export async function saveCoachingSuggestions(conversationId: string, result: CoachingResult): Promise<void> {
  try {
    await getSupabase().from("coaching_suggestions").delete().eq("conversation_id", conversationId);
    const rows = [
      ...result.tips,
      ...result.missed_opportunities.map((item) => ({
        trigger: `missed_${item.type}`,
        suggestion: item.description,
        priority: "high" as const,
        timestamp: item.timestamp,
      })),
    ];
    if (!rows.length) return;
    const { error } = await getSupabase().from("coaching_suggestions").insert(
      rows.map((tip) => ({
        conversation_id: conversationId,
        trigger: tip.trigger,
        suggestion: tip.suggestion,
        priority: tip.priority,
        timestamp: tip.timestamp,
        is_implemented: false,
      })),
    );
    if (error) logger.warn({ error, conversationId }, "Failed to save coaching tips; run migration 013");
  } catch (err) {
    logger.warn({ err, conversationId }, "Coaching persist skipped");
  }
}

export async function generateCoachingTips(conversationId: string, organizationId: string): Promise<CoachingResult> {
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
    .select("id, text, original_text")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let segments: CoachingSegment[] = [];
  if (transcript?.id) {
    const { data } = await supabase
      .from("transcript_segments")
      .select("speaker, text, start_time, end_time")
      .eq("transcript_id", transcript.id);
    segments = (data ?? []) as CoachingSegment[];
  }
  const text = String(transcript?.original_text ?? transcript?.text ?? "");
  const result = buildCoachingTips(text, segments);
  await saveCoachingSuggestions(conversationId, result);
  return result;
}

export async function listCoachingSuggestions(conversationId: string) {
  const { data, error } = await getSupabase()
    .from("coaching_suggestions")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("timestamp", { ascending: true });
  if (error) {
    logger.warn({ error, conversationId }, "Coaching list failed; run migration 013");
    return [];
  }
  return data ?? [];
}
