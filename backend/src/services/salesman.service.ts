import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import { CACHE_TTL, cacheInvalidate, cacheWrap } from "./cache.service.js";
import type { ConversationScore } from "./scoring.service.js";

export type LeaderboardPeriod = "week" | "month" | "all";

export type SalesmanPerformance = {
  salesman_id: string;
  salesman_name: string;
  total_conversations: number;
  average_scores: {
    overall: number;
    communication: number;
    product_knowledge: number;
    objection_handling: number;
    closing_ability: number;
    rule_compliance: number;
  };
  trends: {
    last_7_days: number[];
    last_30_days: number[];
  };
  top_strengths: string[];
  top_weaknesses: string[];
  recent_conversations: Array<{
    id: string;
    recorded_at: string;
    status: string;
    overall_score: number | null;
    duration_seconds: number;
  }>;
};

export type LeaderboardEntry = {
  rank: number;
  salesman_id: string;
  salesman_name: string;
  total_conversations: number;
  average_score: number;
  average_scores: SalesmanPerformance["average_scores"];
};

type ScoredConversation = {
  id: string;
  salesman_id: string | null;
  recorded_at: string;
  status: string;
  duration_seconds: number;
  score: ConversationScore | null;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function latestScore(analyses: unknown): ConversationScore | null {
  const rows = Array.isArray(analyses) ? analyses : analyses ? [analyses] : [];
  const latest = rows
    .slice()
    .sort((a, b) => String((b as { created_at?: string }).created_at ?? "").localeCompare(String((a as { created_at?: string }).created_at ?? "")))[0] as
    | Record<string, unknown>
    | undefined;
  if (!latest || latest.overall_score == null) return null;
  return {
    overall_score: Number(latest.overall_score),
    communication_score: Number(latest.communication_score ?? 0),
    product_knowledge_score: Number(latest.product_knowledge_score ?? 0),
    objection_handling_score: Number(latest.objection_handling_score ?? 0),
    closing_ability_score: Number(latest.closing_ability_score ?? 0),
    rule_compliance_score: Number(latest.rule_compliance_score ?? 0),
    strengths: asStringArray(latest.strengths),
    weaknesses: asStringArray(latest.weaknesses),
    recommendations: asStringArray(latest.recommendations),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function periodStart(period: LeaderboardPeriod): string | null {
  if (period === "all") return null;
  const days = period === "week" ? 7 : 30;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function dailyAverages(items: ScoredConversation[], days: number): number[] {
  const buckets = Array.from({ length: days }, () => [] as number[]);
  const now = new Date();
  for (const item of items) {
    if (!item.score) continue;
    const recorded = new Date(item.recorded_at);
    const diff = Math.floor((now.getTime() - recorded.getTime()) / 86_400_000);
    if (diff < 0 || diff >= days) continue;
    buckets[days - 1 - diff]?.push(item.score.overall_score);
  }
  return buckets.map((day) => (day.length ? average(day) : 0));
}

function topLabels(items: ScoredConversation[], key: "strengths" | "weaknesses"): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const label of item.score?.[key] ?? []) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);
}

async function loadScoredConversations(organizationId: string, from?: string | null): Promise<ScoredConversation[]> {
  let query = getSupabase()
    .from("conversations")
    .select("id, salesman_id, recorded_at, status, duration_seconds, conversation_analyses(*)")
    .eq("organization_id", organizationId)
    .order("recorded_at", { ascending: false })
    .limit(2000);
  if (from) query = query.gte("recorded_at", from);

  const { data, error } = await query;
  if (error) {
    logger.error({ error, organizationId }, "Failed to load conversations for scoring");
    throw new HttpError(500, "Failed to load salesman performance.", "PERFORMANCE_LOAD_FAILED");
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    salesman_id: row.salesman_id ? String(row.salesman_id) : null,
    recorded_at: String(row.recorded_at ?? row.id),
    status: String(row.status ?? ""),
    duration_seconds: Number(row.duration_seconds ?? 0),
    score: latestScore(row.conversation_analyses),
  }));
}

export function invalidateScoreCache(organizationId: string): void {
  cacheInvalidate(`scores:${organizationId}`);
  cacheInvalidate(`leaderboard:${organizationId}`);
}

export async function getSalesmanPerformance(
  organizationId: string,
  salesmanId: string,
): Promise<SalesmanPerformance> {
  return cacheWrap(`scores:${organizationId}:${salesmanId}`, CACHE_TTL.scores, () => loadSalesmanPerformance(organizationId, salesmanId));
}

async function loadSalesmanPerformance(
  organizationId: string,
  salesmanId: string,
): Promise<SalesmanPerformance> {
  const { data: salesman, error } = await getSupabase()
    .from("salesmen")
    .select("id, name")
    .eq("id", salesmanId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Failed to load salesman.", "SALESMAN_LOAD_FAILED");
  if (!salesman) throw new HttpError(404, "Salesman not found.", "NOT_FOUND");

  const conversations = (await loadScoredConversations(organizationId)).filter((item) => item.salesman_id === salesmanId);
  const scored = conversations.filter((item) => item.score);

  return {
    salesman_id: salesmanId,
    salesman_name: String(salesman.name ?? "Salesman"),
    total_conversations: conversations.length,
    average_scores: {
      overall: average(scored.map((item) => item.score!.overall_score)),
      communication: average(scored.map((item) => item.score!.communication_score)),
      product_knowledge: average(scored.map((item) => item.score!.product_knowledge_score)),
      objection_handling: average(scored.map((item) => item.score!.objection_handling_score)),
      closing_ability: average(scored.map((item) => item.score!.closing_ability_score)),
      rule_compliance: average(scored.map((item) => item.score!.rule_compliance_score)),
    },
    trends: {
      last_7_days: dailyAverages(scored, 7),
      last_30_days: dailyAverages(scored, 30),
    },
    top_strengths: topLabels(scored, "strengths"),
    top_weaknesses: topLabels(scored, "weaknesses"),
    recent_conversations: conversations.slice(0, 8).map((item) => ({
      id: item.id,
      recorded_at: item.recorded_at,
      status: item.status,
      overall_score: item.score?.overall_score ?? null,
      duration_seconds: item.duration_seconds,
    })),
  };
}

export async function getSalesmanLeaderboard(
  organizationId: string,
  period: LeaderboardPeriod = "all",
): Promise<LeaderboardEntry[]> {
  return cacheWrap(`leaderboard:${organizationId}:${period}`, CACHE_TTL.scores, () => loadSalesmanLeaderboard(organizationId, period));
}

async function loadSalesmanLeaderboard(
  organizationId: string,
  period: LeaderboardPeriod,
): Promise<LeaderboardEntry[]> {
  const { data: salesmen, error } = await getSupabase()
    .from("salesmen")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) throw new HttpError(500, "Failed to load salesmen.", "SALESMEN_LOAD_FAILED");

  const conversations = await loadScoredConversations(organizationId, periodStart(period));
  const bySalesman = new Map<string, ScoredConversation[]>();
  for (const item of conversations) {
    if (!item.salesman_id) continue;
    const list = bySalesman.get(item.salesman_id) ?? [];
    list.push(item);
    bySalesman.set(item.salesman_id, list);
  }

  const entries = (salesmen ?? []).map((person) => {
    const items = bySalesman.get(String(person.id)) ?? [];
    const scored = items.filter((item) => item.score);
    const average_scores = {
      overall: average(scored.map((item) => item.score!.overall_score)),
      communication: average(scored.map((item) => item.score!.communication_score)),
      product_knowledge: average(scored.map((item) => item.score!.product_knowledge_score)),
      objection_handling: average(scored.map((item) => item.score!.objection_handling_score)),
      closing_ability: average(scored.map((item) => item.score!.closing_ability_score)),
      rule_compliance: average(scored.map((item) => item.score!.rule_compliance_score)),
    };
    return {
      salesman_id: String(person.id),
      salesman_name: String(person.name ?? "Salesman"),
      total_conversations: items.length,
      average_score: average_scores.overall,
      average_scores,
    };
  });

  entries.sort((a, b) => b.average_score - a.average_score || b.total_conversations - a.total_conversations);
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}
