import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";

export type ChurnRisk = "low" | "medium" | "high";

export type ChurnPrediction = {
  churn_risk: ChurnRisk;
  churn_score: number;
  risk_factors: string[];
  retention_suggestions: string[];
};

export type ChurnSignals = {
  negativeCount: number;
  recentCount: number;
  priceObjections: number;
  openFollowUps: number;
  overdueFollowUps: number;
  visits: number;
  purchases: number;
  daysSinceVisit: number | null;
};

export function scoreChurn(signals: ChurnSignals): ChurnPrediction {
  let score = 10;
  const factors: string[] = [];
  if (signals.recentCount > 0 && signals.negativeCount / signals.recentCount >= 0.5) {
    score += 30;
    factors.push("Negative sentiment in recent conversations");
  }
  if (signals.priceObjections >= 2) {
    score += 20;
    factors.push("Price objections increased");
  }
  if (signals.openFollowUps > 0) {
    score += 15;
    factors.push("Follow-up not completed");
  }
  if (signals.overdueFollowUps > 0) {
    score += 10;
    factors.push("Overdue follow-up");
  }
  if (signals.visits > 1 && signals.purchases === 0) {
    score += 15;
    factors.push("Repeat visits without a purchase");
  }
  if (signals.daysSinceVisit != null && signals.daysSinceVisit > 30) {
    score += 15;
    factors.push("No visit in over 30 days");
  }
  score = Math.min(100, score);
  const churn_risk: ChurnRisk = score >= 65 ? "high" : score >= 35 ? "medium" : "low";
  const retention_suggestions =
    churn_risk === "high"
      ? ["Offer a special discount", "Call the customer personally", "Send a WhatsApp follow-up"]
      : churn_risk === "medium"
        ? ["Send a WhatsApp check-in", "Remind them of pending follow-up"]
        : ["Keep regular service quality"];
  return { churn_risk, churn_score: score, risk_factors: factors.length ? factors : ["No elevated risk signals"], retention_suggestions };
}

export async function predictChurn(customerId: string, organizationId: string): Promise<ChurnPrediction> {
  const supabase = getSupabase();
  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !customer) throw new HttpError(404, "Customer not found.", "NOT_FOUND");

  const { data: interactions } = await supabase
    .from("customer_interactions")
    .select("conversation_id")
    .eq("customer_id", customerId)
    .limit(20);
  const conversationIds = (interactions ?? []).map((row) => String(row.conversation_id)).filter(Boolean);

  let negativeCount = 0;
  let priceObjections = 0;
  if (conversationIds.length) {
    const { data: analyses } = await supabase
      .from("conversation_analyses")
      .select("sentiment, objections, primary_emotion")
      .in("conversation_id", conversationIds);
    for (const row of analyses ?? []) {
      if (row.sentiment === "negative" || row.primary_emotion === "frustrated") negativeCount += 1;
      const objections = Array.isArray(row.objections) ? row.objections : [];
      if (objections.some((item) => /price|mehnga|expensive/i.test(String(item)))) priceObjections += 1;
    }
  }

  const { data: followUps } = await supabase
    .from("follow_ups")
    .select("status, follow_up_date")
    .eq("customer_id", customerId);
  const openFollowUps = (followUps ?? []).filter((row) => row.status === "pending" || row.status === "snoozed").length;
  const overdueFollowUps = (followUps ?? []).filter((row) => {
    if (row.status !== "pending" || !row.follow_up_date) return false;
    return Date.parse(String(row.follow_up_date)) < Date.now();
  }).length;

  const lastVisit = customer.last_visit_at ? Date.parse(String(customer.last_visit_at)) : NaN;
  const prediction = scoreChurn({
    negativeCount,
    recentCount: conversationIds.length,
    priceObjections,
    openFollowUps,
    overdueFollowUps,
    visits: Number(customer.total_visits ?? 0),
    purchases: Number(customer.total_purchases ?? 0),
    daysSinceVisit: Number.isFinite(lastVisit) ? Math.round((Date.now() - lastVisit) / 86_400_000) : null,
  });

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      churn_risk: prediction.churn_risk,
      churn_score: prediction.churn_score,
      last_churn_analysis: new Date().toISOString(),
    })
    .eq("id", customerId);
  if (updateError) logger.warn({ updateError, customerId }, "Could not store churn fields; run migration 013");
  return prediction;
}
