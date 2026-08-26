import { endOfDay, format, parseISO, startOfDay } from "date-fns";
import { supabase } from "../lib/supabase";
import type {
  Analytics,
  AppNotification,
  Conversation,
  ConversationAnalysis,
  ConversationFilters,
  ConversationRule,
  ConversationStatus,
  Customer,
  CustomerDetail,
  DateRange,
  ExportFile,
  FollowUp,
  FollowUpPriority,
  FollowUpStatus,
  LeaderboardEntry,
  Paginated,
  PurchaseIntent,
  Report,
  RetentionStatus,
  RuleResult,
  SalesmanPerformance,
  ScheduledReport,
  StoredReport,
  Sentiment,
  LanguageInsights,
  Transcript,
  TranscriptSegment,
  CommunicationSettings,
  WhatsAppStatus,
  OutboundMessage,
  AuditLog,
  TwoFactorSetup,
  AuthSession,
  CoachingResult,
  ProductRecommendation,
  CatalogProduct,
  ChurnPrediction,
  SalesScriptContent,
  StoredScript,
  InsightOverview,
} from "../types/conversation";
import type { ActivityLog, Device, SessionProfile, Store, StoreComparisonRow, StoreOverview } from "../types/store";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function asSentiment(value: unknown): Sentiment {
  return value === "positive" || value === "negative" ? value : "neutral";
}

function asIntent(value: unknown): PurchaseIntent {
  return value === "high" || value === "low" ? value : "medium";
}

function asStatus(value: unknown): ConversationStatus {
  if (
    value === "queued" ||
    value === "processing" ||
    value === "analyzed" ||
    value === "scored" ||
    value === "failed" ||
    value === "recorded"
  ) {
    return value;
  }
  return "recorded";
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function mapAnalysis(row: Record<string, unknown> | null | undefined): ConversationAnalysis | null {
  if (!row) return null;
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    summary: row.summary ? String(row.summary) : null,
    sentiment: asSentiment(row.sentiment),
    purchase_intent: asIntent(row.purchase_intent),
    objections: asStringArray(row.objections),
    key_points: asStringArray(row.key_points),
    customer_questions: asStringArray(row.customer_questions),
    language: row.language ? String(row.language) : null,
    language_code: row.language_code ? String(row.language_code) : row.language ? String(row.language) : null,
    language_confidence: typeof row.language_confidence === "number" ? row.language_confidence : null,
    summary_original: row.summary_original ? String(row.summary_original) : null,
    language_specific_insights: (row.language_specific_insights as LanguageInsights | null) ?? null,
    duration_spoken_seconds: typeof row.duration_spoken_seconds === "number" ? row.duration_spoken_seconds : null,
    ai_model: row.ai_model ? String(row.ai_model) : null,
    ai_processed_at: row.ai_processed_at ? String(row.ai_processed_at) : null,
    overall_score: asOptionalNumber(row.overall_score),
    communication_score: asOptionalNumber(row.communication_score),
    product_knowledge_score: asOptionalNumber(row.product_knowledge_score),
    objection_handling_score: asOptionalNumber(row.objection_handling_score),
    closing_ability_score: asOptionalNumber(row.closing_ability_score),
    rule_compliance_score: asOptionalNumber(row.rule_compliance_score),
    strengths: asStringArray(row.strengths),
    weaknesses: asStringArray(row.weaknesses),
    recommendations: asStringArray(row.recommendations),
    primary_emotion: row.primary_emotion ? String(row.primary_emotion) : null,
    emotion_scores: (row.emotion_scores as Record<string, number> | null) ?? null,
    emotional_intensity: asOptionalNumber(row.emotional_intensity) ?? null,
    emotion_triggers: Array.isArray(row.emotion_triggers)
      ? (row.emotion_triggers as Array<{ word: string; emotion: string; count: number }>)
      : null,
    tone_analysis: (row.tone_analysis as ConversationAnalysis["tone_analysis"]) ?? null,
  };
}

function mapRuleResult(row: Record<string, unknown>): RuleResult {
  return {
    rule_id: String(row.rule_id ?? row.id ?? ""),
    rule_type: String(row.rule_type ?? "custom"),
    description: row.description ? String(row.description) : undefined,
    is_followed: Boolean(row.is_followed),
    evidence: row.evidence ? String(row.evidence) : null,
  };
}

function mapTranscript(row: Record<string, unknown> | null | undefined): Transcript | null {
  if (!row) return null;
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    text: row.text ? String(row.text) : null,
    language: row.language ? String(row.language) : null,
    original_text: row.original_text ? String(row.original_text) : null,
    translated_text: row.translated_text ? String(row.translated_text) : null,
    original_language: row.original_language ? String(row.original_language) : null,
    translation_language: row.translation_language ? String(row.translation_language) : null,
    is_auto_generated: Boolean(row.is_auto_generated),
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

function mapSegment(row: Record<string, unknown>): TranscriptSegment {
  return {
    id: String(row.id),
    speaker: row.speaker === "customer" ? "customer" : "salesman",
    text: String(row.text ?? ""),
    start_time: Number(row.start_time ?? 0),
    end_time: Number(row.end_time ?? 0),
  };
}

function mapConversation(row: Record<string, unknown>): Conversation {
  const analysis = asArray(row.analysis ?? row.conversation_analyses)[0] as Record<string, unknown> | undefined;
  const transcript = asArray(row.transcript ?? row.transcripts)[0] as Record<string, unknown> | undefined;
  const salesman = asArray(row.salesman ?? row.salesmen)[0] as Record<string, unknown> | undefined;
  return {
    id: String(row.id),
    organization_id: String(row.organization_id ?? ""),
    store_id: row.store_id ? String(row.store_id) : null,
    salesman_id: row.salesman_id ? String(row.salesman_id) : null,
    salesman_name: salesman?.name ? String(salesman.name) : null,
    device_id: row.device_id ? String(row.device_id) : null,
    duration_seconds: Number(row.duration_seconds ?? 0),
    language: row.language ? String(row.language) : null,
    recording_url: row.recording_url ? String(row.recording_url) : null,
    recording_path: row.recording_path ? String(row.recording_path) : null,
    status: asStatus(row.status),
    recorded_at: String(row.recorded_at ?? row.created_at ?? new Date().toISOString()),
    created_at: String(row.created_at ?? row.recorded_at ?? new Date().toISOString()),
    analysis: mapAnalysis(analysis),
    transcript: mapTranscript(transcript),
    segments: asArray(row.segments ?? row.transcript_segments).map((item) => mapSegment(item as Record<string, unknown>)),
    rule_results: asArray(row.rule_results).map((item) => mapRuleResult(item as Record<string, unknown>)),
  };
}

async function requireClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return supabase;
}

async function withSignedRecording(conversation: Conversation): Promise<Conversation> {
  if (conversation.recording_url || !conversation.recording_path) return conversation;
  try {
    const client = await requireClient();
    const { data } = await client.storage.from("recordings").createSignedUrl(conversation.recording_path, 60 * 60);
    if (data?.signedUrl) conversation.recording_url = data.signedUrl;
  } catch {
    // Storage policies may block unsigned playback; the rest of the page still works.
  }
  return conversation;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BACKEND_URL || ""}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
      ...(init?.headers ?? {}),
    },
  });
  const json = (await response.json().catch(() => null)) as { data?: T; message?: string } | null;
  if (!response.ok) throw new Error(json?.message ?? "Request failed.");
  if (json?.data === undefined) throw new Error(json?.message ?? "Empty response.");
  return json.data;
}

async function authHeader(): Promise<HeadersInit> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const token =
    session?.access_token ??
    localStorage.getItem("storelisten_token") ??
    localStorage.getItem("access_token") ??
    localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchConversations(filters: ConversationFilters = {}): Promise<Paginated<Conversation>> {
  const client = await requireClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let ids: string[] | null = null;
  const search = filters.search?.trim();
  if (search) {
    const uuidLike = /^[0-9a-f-]{36}$/i.test(search);
    const { data: transcriptHits } = await client
      .from("transcripts")
      .select("conversation_id")
      .ilike("text", `%${search}%`);
    const textIds = (transcriptHits ?? []).map((row) => String(row.conversation_id));
    ids = uuidLike ? Array.from(new Set([search, ...textIds])) : textIds;
    if (ids.length === 0 && !uuidLike) {
      return { data: [], total: 0, page, pageSize };
    }
  }

  const selectWithSalesman = `
      *,
      conversation_analyses (*),
      transcripts (*),
      salesman:salesmen (name)
    `;
  const selectBase = `
      *,
      conversation_analyses (*),
      transcripts (*)
    `;

  let query = client
    .from("conversations")
    .select(selectWithSalesman, { count: "exact" })
    .order("recorded_at", { ascending: false });

  if (ids) query = query.in("id", ids);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.salesmanId && filters.salesmanId !== "all") query = query.eq("salesman_id", filters.salesmanId);
  if (filters.storeId && filters.storeId !== "all") query = query.eq("store_id", filters.storeId);
  if (filters.from) query = query.gte("recorded_at", startOfDay(parseISO(filters.from)).toISOString());
  if (filters.to) query = query.lte("recorded_at", endOfDay(parseISO(filters.to)).toISOString());
  if (filters.sentiment && filters.sentiment !== "all") {
    query = query.eq("conversation_analyses.sentiment", filters.sentiment);
  }

  let { data, error, count } = await query.range(from, to);
  if (error) {
    query = client
      .from("conversations")
      .select(selectBase, { count: "exact" })
      .order("recorded_at", { ascending: false });
    if (ids) query = query.in("id", ids);
    if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.salesmanId && filters.salesmanId !== "all") query = query.eq("salesman_id", filters.salesmanId);
    if (filters.storeId && filters.storeId !== "all") query = query.eq("store_id", filters.storeId);
    if (filters.from) query = query.gte("recorded_at", startOfDay(parseISO(filters.from)).toISOString());
    if (filters.to) query = query.lte("recorded_at", endOfDay(parseISO(filters.to)).toISOString());
    if (filters.sentiment && filters.sentiment !== "all") {
      query = query.eq("conversation_analyses.sentiment", filters.sentiment);
    }
    const retry = await query.range(from, to);
    data = retry.data;
    error = retry.error;
    count = retry.count;
  }
  if (error) throw new Error(error.message);

  let rows = (data ?? []).map((row) => mapConversation(row as Record<string, unknown>));
  if (filters.sentiment && filters.sentiment !== "all") {
    rows = rows.filter((row) => row.analysis?.sentiment === filters.sentiment);
  }

  return { data: rows, total: count ?? rows.length, page, pageSize };
}

export async function fetchConversationById(id: string): Promise<Conversation> {
  const client = await requireClient();
  const first = await client
    .from("conversations")
    .select(
      `
      *,
      conversation_analyses (*),
      transcripts (*),
      salesman:salesmen (name)
    `,
    )
    .eq("id", id)
    .single();
  const result = first.error
    ? await client
        .from("conversations")
        .select("*, conversation_analyses (*), transcripts (*)")
        .eq("id", id)
        .single()
    : first;
  if (result.error || !result.data) throw new Error(result.error?.message ?? "Conversation not found.");
  return withSignedRecording(mapConversation(result.data as Record<string, unknown>));
}

export async function fetchConversationAnalysis(id: string): Promise<Conversation> {
  try {
    const response = await fetch(`${BACKEND_URL || ""}/api/conversations/${id}/analysis`, {
      headers: { ...(await authHeader()) },
    });
    if (response.ok) {
      const json = (await response.json()) as {
        data?: {
          conversation: Record<string, unknown>;
          transcript?: Record<string, unknown> | null;
          analysis?: Record<string, unknown> | null;
          segments?: Array<Record<string, unknown>>;
          rule_results?: Array<Record<string, unknown>>;
        };
      };
      if (json.data?.conversation) {
        return withSignedRecording(
          mapConversation({
            ...json.data.conversation,
            transcripts: json.data.transcript ? [json.data.transcript] : [],
            conversation_analyses: json.data.analysis ? [json.data.analysis] : [],
            transcript_segments: json.data.segments ?? [],
            rule_results: json.data.rule_results ?? [],
          }),
        );
      }
    }
  } catch {
    // Fall back to Supabase when the API is down.
  }

  const conversation = await fetchConversationById(id);
  if (conversation.transcript?.id) {
    const client = await requireClient();
    const { data } = await client
      .from("transcript_segments")
      .select("*")
      .eq("transcript_id", conversation.transcript.id)
      .order("start_time", { ascending: true });
    conversation.segments = (data ?? []).map((row) => mapSegment(row as Record<string, unknown>));
  }
  try {
    const client = await requireClient();
    const { data } = await client
      .from("conversation_rule_results")
      .select("rule_id, is_followed, evidence, conversation_rules (rule_type, description)")
      .eq("conversation_id", conversation.id);
    conversation.rule_results = (data ?? []).map((row) => {
      const rule = asArray(row.conversation_rules)[0] as Record<string, unknown> | undefined;
      return mapRuleResult({
        ...row,
        rule_type: rule?.rule_type,
        description: rule?.description,
      });
    });
  } catch {
    conversation.rule_results = conversation.rule_results ?? [];
  }
  return withSignedRecording(conversation);
}

export async function retryAnalysis(id: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL || ""}/api/conversations/${id}/analyze`, {
    method: "POST",
    headers: { ...(await authHeader()) },
  });
  if (!response.ok && response.status !== 202) {
    const json = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(json?.message ?? "Retry analysis failed.");
  }
}

export type ConversationTranslation = {
  language: string;
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
    language_specific_insights: LanguageInsights | null;
  } | null;
};

export async function translateConversation(id: string, language: string): Promise<ConversationTranslation> {
  return apiJson<ConversationTranslation>(`/api/conversations/${id}/translate?language=${encodeURIComponent(language)}`);
}

export async function fetchSalesmen(): Promise<Array<{ id: string; name: string }>> {
  const client = await requireClient();
  const { data, error } = await client.from("salesmen").select("id, name").order("name");
  if (error) return [];
  return (data ?? []).map((row) => ({ id: String(row.id), name: String(row.name ?? "Salesman") }));
}

function sentimentScore(value?: Sentiment | null): number {
  if (value === "positive") return 1;
  if (value === "negative") return 0;
  return 0.5;
}

function countBy<T extends string>(items: T[]): Array<{ name: string; value: number }> {
  const map = new Map<string, number>();
  for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

export async function fetchAnalytics(dateRange?: DateRange, storeId?: string | null): Promise<Analytics> {
  const client = await requireClient();
  let query = client
    .from("conversations")
    .select("*, conversation_analyses(*)")
    .order("recorded_at", { ascending: false });
  if (dateRange?.from) query = query.gte("recorded_at", startOfDay(parseISO(dateRange.from)).toISOString());
  if (dateRange?.to) query = query.lte("recorded_at", endOfDay(parseISO(dateRange.to)).toISOString());
  if (storeId && storeId !== "all") query = query.eq("store_id", storeId);

  const { data, error } = await query.limit(1000);
  if (error) throw new Error(error.message);

  const conversations = (data ?? []).map((row) => mapConversation(row as Record<string, unknown>));
  const today = format(new Date(), "yyyy-MM-dd");
  const analyzed = conversations.filter((item) => item.status === "analyzed" || item.status === "scored");
  const pending = conversations.filter((item) =>
    item.status === "queued" || item.status === "processing" || item.status === "recorded" || item.status === "failed",
  );
  const perDayMap = new Map<string, number>();
  const objections = new Map<string, number>();

  for (const item of conversations) {
    const day = format(parseISO(item.recorded_at), "yyyy-MM-dd");
    perDayMap.set(day, (perDayMap.get(day) ?? 0) + 1);
    for (const objection of item.analysis?.objections ?? []) {
      objections.set(objection, (objections.get(objection) ?? 0) + 1);
    }
  }

  const totalDuration = conversations.reduce((sum, item) => sum + item.duration_seconds, 0);
  const sentimentValues = conversations.map((item) => item.analysis?.sentiment).filter(Boolean) as Sentiment[];
  const intentValues = conversations.map((item) => item.analysis?.purchase_intent).filter(Boolean) as PurchaseIntent[];

  return {
    totalConversations: conversations.length,
    averageDuration: conversations.length ? totalDuration / conversations.length : 0,
    totalRecordingTime: totalDuration,
    analyzedPercentage: conversations.length ? (analyzed.length / conversations.length) * 100 : 0,
    todayCount: conversations.filter((item) => format(parseISO(item.recorded_at), "yyyy-MM-dd") === today).length,
    pendingCount: pending.length,
    highIntentCount: conversations.filter((item) => item.analysis?.purchase_intent === "high").length,
    averageSentimentScore:
      sentimentValues.length === 0
        ? 0
        : sentimentValues.reduce((sum, item) => sum + sentimentScore(item), 0) / sentimentValues.length,
    perDay: [...perDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    sentiment: countBy(sentimentValues),
    intent: countBy(intentValues),
    objections: [...objections.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value })),
    languages: countBy(conversations.map((item) => item.language || item.analysis?.language || "unknown").map(String)),
    recent: conversations.slice(0, 5),
    peakHours: Array.from({ length: 12 }, (_, index) => {
      const hour = index * 2;
      const value = conversations.filter((item) => parseISO(item.recorded_at).getHours() >= hour && parseISO(item.recorded_at).getHours() < hour + 2).length;
      return { name: `${hour}:00`, value };
    }),
    objectionTrend: [...perDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date]) => ({
        date,
        count: conversations
          .filter((item) => format(parseISO(item.recorded_at), "yyyy-MM-dd") === date)
          .reduce((sum, item) => sum + (item.analysis?.objections.length ?? 0), 0),
      })),
    products: countBy(
      conversations
        .map((item) => item.analysis?.key_points?.[0])
        .filter((item): item is string => Boolean(item))
        .map((item) => item.slice(0, 24)),
    ).slice(0, 8),
    funnel: [
      { name: "Recorded", value: conversations.length },
      { name: "Analyzed", value: analyzed.length },
      { name: "High intent", value: conversations.filter((item) => item.analysis?.purchase_intent === "high").length },
      {
        name: "High score",
        value: conversations.filter((item) => (item.analysis?.overall_score ?? 0) >= 80).length,
      },
    ],
    salesmanTrend: conversations
      .filter((item) => item.salesman_name && item.analysis?.overall_score != null)
      .reduce<Array<{ name: string; value: number; count: number }>>((list, item) => {
        const existing = list.find((row) => row.name === item.salesman_name);
        if (existing) {
          existing.value += item.analysis?.overall_score ?? 0;
          existing.count += 1;
        } else {
          list.push({ name: item.salesman_name ?? "Salesman", value: item.analysis?.overall_score ?? 0, count: 1 });
        }
        return list;
      }, [])
      .map((row) => ({ name: row.name, value: Math.round(row.value / row.count) })),
  };
}

export async function generateReport(dateRange: DateRange): Promise<Report> {
  const [analytics, list] = await Promise.all([
    fetchAnalytics(dateRange),
    fetchConversations({ from: dateRange.from, to: dateRange.to, page: 1, pageSize: 200 }),
  ]);
  return {
    range: dateRange,
    generatedAt: new Date().toISOString(),
    analytics,
    conversations: list.data,
  };
}

export async function scoreConversation(id: string): Promise<Conversation> {
  const bundle = await apiJson<{
    conversation: Record<string, unknown>;
    transcript?: Record<string, unknown> | null;
    analysis?: Record<string, unknown> | null;
    segments?: Array<Record<string, unknown>>;
    rule_results?: Array<Record<string, unknown>>;
  }>(`/api/conversations/${id}/score`, { method: "POST" });
  return mapConversation({
    ...bundle.conversation,
    transcripts: bundle.transcript ? [bundle.transcript] : [],
    conversation_analyses: bundle.analysis ? [bundle.analysis] : [],
    transcript_segments: bundle.segments ?? [],
    rule_results: bundle.rule_results ?? [],
  });
}

export async function fetchSalesmanPerformance(id: string): Promise<SalesmanPerformance> {
  return apiJson<SalesmanPerformance>(`/api/salesmen/${id}/performance`);
}

export async function fetchLeaderboard(period: "week" | "month" | "all" = "all"): Promise<LeaderboardEntry[]> {
  return apiJson<LeaderboardEntry[]>(`/api/salesmen/leaderboard?period=${period}`);
}

export async function fetchRules(): Promise<ConversationRule[]> {
  return apiJson<ConversationRule[]>("/api/rules");
}

export async function createRule(input: Omit<ConversationRule, "id">): Promise<ConversationRule> {
  return apiJson<ConversationRule>("/api/rules", { method: "POST", body: JSON.stringify(input) });
}

export async function updateRule(id: string, input: Partial<ConversationRule>): Promise<ConversationRule> {
  return apiJson<ConversationRule>(`/api/rules/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function deleteRule(id: string): Promise<ConversationRule> {
  return apiJson<ConversationRule>(`/api/rules/${id}`, { method: "DELETE" });
}

export function testRuleAgainstText(keywords: string[], sample: string): { matched: boolean; evidence: string | null } {
  const haystack = sample.toLowerCase();
  for (const keyword of keywords) {
    const needle = keyword.trim().toLowerCase();
    if (!needle) continue;
    const index = haystack.indexOf(needle);
    if (index >= 0) {
      return { matched: true, evidence: sample.slice(Math.max(0, index - 24), index + needle.length + 24).trim() };
    }
  }
  return { matched: false, evidence: null };
}

export async function fetchFollowUps(filters: {
  status?: FollowUpStatus | "";
  priority?: FollowUpPriority | "";
  assigned_to?: string;
  search?: string;
  from?: string;
  to?: string;
} = {}): Promise<FollowUp[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.assigned_to) params.set("assigned_to", filters.assigned_to);
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return apiJson<FollowUp[]>(`/api/followups${query ? `?${query}` : ""}`);
}

export async function fetchDueFollowUps(): Promise<FollowUp[]> {
  return apiJson<FollowUp[]>("/api/followups/due-today");
}

export async function createFollowUp(input: Partial<FollowUp> & { conversation_id: string }): Promise<FollowUp> {
  return apiJson<FollowUp>("/api/followups", { method: "POST", body: JSON.stringify(input) });
}

export async function updateFollowUp(id: string, input: Partial<FollowUp>): Promise<FollowUp> {
  return apiJson<FollowUp>(`/api/followups/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function completeFollowUp(id: string, notes?: string): Promise<FollowUp> {
  return apiJson<FollowUp>(`/api/followups/${id}/complete`, { method: "POST", body: JSON.stringify({ notes }) });
}

export async function snoozeFollowUp(id: string, follow_up_date: string): Promise<FollowUp> {
  return apiJson<FollowUp>(`/api/followups/${id}/snooze`, { method: "POST", body: JSON.stringify({ follow_up_date }) });
}

export async function cancelFollowUp(id: string): Promise<FollowUp> {
  return apiJson<FollowUp>(`/api/followups/${id}`, { method: "DELETE" });
}

export async function suggestFollowUpMessage(id: string): Promise<FollowUp> {
  return apiJson<FollowUp>(`/api/followups/${id}/message`, { method: "POST" });
}

export async function detectConversationLead(conversationId: string): Promise<FollowUp | null> {
  return apiJson<FollowUp | null>(`/api/conversations/${conversationId}/detect-leads`, { method: "POST" });
}

export async function fetchCustomers(search?: string): Promise<Customer[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiJson<Customer[]>(`/api/customers${query}`);
}

export async function fetchCustomerById(id: string): Promise<CustomerDetail> {
  return apiJson<CustomerDetail>(`/api/customers/${id}`);
}

export async function updateCustomerNotes(id: string, notes: string): Promise<Customer> {
  return updateCustomer(id, { notes });
}

export async function updateCustomer(id: string, input: Partial<Customer>): Promise<Customer> {
  return apiJson<Customer>(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  return apiJson<AppNotification[]>("/api/notifications");
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  return apiJson<AppNotification>(`/api/notifications/${id}/read`, { method: "PUT" });
}

export async function markAllNotificationsRead(): Promise<{ count: number }> {
  return apiJson<{ count: number }>("/api/notifications/read-all", { method: "PUT" });
}

export async function deleteNotification(id: string): Promise<{ id: string }> {
  return apiJson<{ id: string }>(`/api/notifications/${id}`, { method: "DELETE" });
}

export async function fetchStoredReports(): Promise<StoredReport[]> {
  return apiJson<StoredReport[]>("/api/reports");
}

export async function generateConversationPdf(id: string): Promise<StoredReport> {
  return apiJson<StoredReport>(`/api/reports/conversation/${id}`);
}

export async function generateSalesmanPdf(id: string, start: string, end: string): Promise<StoredReport> {
  return apiJson<StoredReport>(`/api/reports/salesman/${id}?start_date=${start}&end_date=${end}`);
}

export async function generateStorePdf(start: string, end: string, period?: string): Promise<StoredReport> {
  const extra = period ? `&period=${period}` : "";
  return apiJson<StoredReport>(`/api/reports/store?start_date=${start}&end_date=${end}${extra}`);
}

export async function fetchSchedules(): Promise<ScheduledReport[]> {
  return apiJson<ScheduledReport[]>("/api/reports/schedules");
}

export async function saveSchedule(input: Partial<ScheduledReport> & { report_type: string }): Promise<ScheduledReport> {
  return apiJson<ScheduledReport>("/api/reports/schedules", { method: "POST", body: JSON.stringify(input) });
}

export async function exportConversationsCsv(): Promise<ExportFile> {
  return apiJson<ExportFile>("/api/export/conversations");
}

export async function exportSalesmenCsv(): Promise<ExportFile> {
  return apiJson<ExportFile>("/api/export/salesmen");
}

export async function exportFollowUpsCsv(): Promise<ExportFile> {
  return apiJson<ExportFile>("/api/export/followups");
}

export async function exportCustomersCsv(): Promise<ExportFile> {
  return apiJson<ExportFile>("/api/export/customers");
}

export async function fetchRetentionStatus(): Promise<RetentionStatus> {
  return apiJson<RetentionStatus>("/api/retention/status");
}

export async function saveRetentionDays(days: number): Promise<{ retention_days: number }> {
  return apiJson<{ retention_days: number }>("/api/retention/settings", {
    method: "PUT",
    body: JSON.stringify({ retention_days: days }),
  });
}

export async function runRetentionCleanup(days?: number): Promise<{ archived: number }> {
  return apiJson<{ archived: number }>("/api/retention/cleanup", {
    method: "POST",
    body: JSON.stringify({ days }),
  });
}

export async function fetchSessionProfile(): Promise<SessionProfile> {
  return apiJson<SessionProfile>("/api/me");
}

export async function fetchStores(): Promise<{ stores: Store[]; role: SessionProfile["role"] }> {
  return apiJson<{ stores: Store[]; role: SessionProfile["role"] }>("/api/stores");
}

export async function createStore(input: Partial<Store> & { name: string }): Promise<Store> {
  return apiJson<Store>("/api/stores", { method: "POST", body: JSON.stringify(input) });
}

export async function updateStore(id: string, input: Partial<Store>): Promise<Store> {
  return apiJson<Store>(`/api/stores/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function deactivateStore(id: string): Promise<Store> {
  return apiJson<Store>(`/api/stores/${id}`, { method: "DELETE" });
}

export async function fetchStoreOverview(id: string): Promise<StoreOverview> {
  return apiJson<StoreOverview>(`/api/stores/${id}/overview`);
}

export async function compareStores(ids: string[], from?: string, to?: string): Promise<StoreComparisonRow[]> {
  const params = new URLSearchParams({ ids: ids.join(",") });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiJson<StoreComparisonRow[]>(`/api/stores/compare?${params.toString()}`);
}

export async function fetchDevices(storeId?: string | null): Promise<Device[]> {
  const suffix = storeId && storeId !== "all" ? `?storeId=${encodeURIComponent(storeId)}` : "";
  return apiJson<Device[]>(`/api/devices${suffix}`);
}

export async function registerDevice(input: Partial<Device> & { device_id: string }): Promise<Device> {
  return apiJson<Device>("/api/devices/register", { method: "POST", body: JSON.stringify(input) });
}

export async function syncDevice(id: string): Promise<Device> {
  return apiJson<Device>(`/api/devices/${id}/sync`, { method: "POST" });
}

export async function restartDevice(id: string): Promise<Device> {
  return apiJson<Device>(`/api/devices/${id}/restart`, { method: "POST" });
}

export async function fetchActivity(storeId?: string | null): Promise<ActivityLog[]> {
  const suffix = storeId && storeId !== "all" ? `?storeId=${encodeURIComponent(storeId)}` : "";
  return apiJson<ActivityLog[]>(`/api/activity${suffix}`);
}

export async function fetchWhatsAppStatus(): Promise<WhatsAppStatus> {
  return apiJson<WhatsAppStatus>("/api/whatsapp/status");
}

export async function connectWhatsApp(): Promise<WhatsAppStatus> {
  return apiJson<WhatsAppStatus>("/api/whatsapp/connect", { method: "POST" });
}

export async function logoutWhatsApp(): Promise<WhatsAppStatus> {
  return apiJson<WhatsAppStatus>("/api/whatsapp/logout", { method: "POST" });
}

export async function fetchWhatsAppTemplates(): Promise<{
  templates: Array<{ name: string; channel: string; label: string; body: string }>;
}> {
  return apiJson("/api/whatsapp/templates");
}

export async function fetchWhatsAppHistory(): Promise<OutboundMessage[]> {
  return apiJson<OutboundMessage[]>("/api/whatsapp/history");
}

export async function previewFollowUpMessage(
  followUpId: string,
  channel: "whatsapp" | "sms" = "whatsapp",
): Promise<{ text: string; phone: string | null; consented: boolean }> {
  return apiJson(`/api/whatsapp/preview?follow_up_id=${followUpId}&channel=${channel}`);
}

export async function sendFollowUpWhatsApp(
  followUpId: string,
  text?: string,
  channel: "whatsapp" | "sms" = "whatsapp",
): Promise<OutboundMessage> {
  return apiJson<OutboundMessage>("/api/whatsapp/send", {
    method: "POST",
    body: JSON.stringify({ follow_up_id: followUpId, message: text, channel }),
  });
}

export async function sendWhatsAppTest(to: string, message: string): Promise<OutboundMessage> {
  return apiJson<OutboundMessage>("/api/whatsapp/send", {
    method: "POST",
    body: JSON.stringify({ to, message }),
  });
}

export async function fetchCommunicationSettings(): Promise<CommunicationSettings> {
  return apiJson<CommunicationSettings>("/api/communication/settings");
}

export async function saveCommunicationSettings(
  input: Partial<CommunicationSettings>,
): Promise<CommunicationSettings> {
  return apiJson<CommunicationSettings>("/api/communication/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function fetchTwoFactorStatus(deviceToken?: string | null): Promise<{ enabled: boolean; trusted: boolean }> {
  const query = deviceToken ? `?device_token=${encodeURIComponent(deviceToken)}` : "";
  return apiJson(`/api/auth/2fa/status${query}`);
}

export async function setupTwoFactor(): Promise<TwoFactorSetup> {
  return apiJson<TwoFactorSetup>("/api/auth/2fa/setup", { method: "POST" });
}

export async function verifyTwoFactorSetup(code: string): Promise<{ enabled: boolean }> {
  return apiJson("/api/auth/2fa/verify", { method: "POST", body: JSON.stringify({ code }) });
}

export async function disableTwoFactor(code: string): Promise<{ enabled: boolean }> {
  return apiJson("/api/auth/2fa/disable", { method: "POST", body: JSON.stringify({ code }) });
}

export async function confirmTwoFactor(code: string, rememberDevice: boolean): Promise<{ device_token?: string | null }> {
  return apiJson("/api/auth/2fa/confirm", {
    method: "POST",
    body: JSON.stringify({ code, remember_device: rememberDevice }),
  });
}

export async function loginWithPassword(email: string, password: string, deviceToken?: string | null) {
  return apiJson<{ status: string; temp_token?: string; access_token?: string; refresh_token?: string }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password, device_token: deviceToken }) },
  );
}

export async function completeTwoFactorLogin(tempToken: string, code: string, remember: boolean, backup = false) {
  return apiJson<{ access_token: string; refresh_token: string | null; device_token?: string | null }>(
    backup ? "/api/auth/2fa/backup" : "/api/auth/2fa/login",
    { method: "POST", body: JSON.stringify({ temp_token: tempToken, code, remember_device: remember }) },
  );
}

export async function fetchAuditLogs(filters: { action?: string; search?: string; from?: string; to?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.action) params.set("action", filters.action);
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return apiJson<AuditLog[]>(`/api/audit-logs${query ? `?${query}` : ""}`);
}

export async function exportAuditLogs(): Promise<ExportFile> {
  return apiJson<ExportFile>("/api/audit-logs/export");
}

export async function fetchSessions(): Promise<AuthSession[]> {
  return apiJson<AuthSession[]>("/api/auth/sessions");
}

export async function revokeSession(id: string): Promise<{ id: string }> {
  return apiJson(`/api/auth/sessions/${id}`, { method: "DELETE" });
}

export async function revokeAllSessions(): Promise<{ count: number }> {
  return apiJson("/api/auth/sessions", { method: "DELETE" });
}

export async function changePassword(password: string): Promise<{ updated: boolean }> {
  return apiJson("/api/auth/password", { method: "POST", body: JSON.stringify({ password }) });
}

export async function fetchCoaching(conversationId: string): Promise<CoachingResult> {
  return apiJson<CoachingResult>(`/api/conversations/${conversationId}/coaching`);
}

export async function fetchRecommendations(conversationId: string): Promise<ProductRecommendation> {
  return apiJson<ProductRecommendation>(`/api/conversations/${conversationId}/recommendations`);
}

export async function fetchProducts(): Promise<CatalogProduct[]> {
  const rows = await apiJson<Array<Record<string, unknown>>>("/api/products");
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    category: row.category ? String(row.category) : null,
    price_range: row.price_range ? String(row.price_range) : null,
    features: asStringArray(row.features),
    brand: row.brand ? String(row.brand) : null,
  }));
}

export async function createProduct(input: Omit<CatalogProduct, "id">): Promise<CatalogProduct> {
  return apiJson<CatalogProduct>("/api/products", { method: "POST", body: JSON.stringify(input) });
}

export async function updateProduct(id: string, input: Omit<CatalogProduct, "id">): Promise<CatalogProduct> {
  return apiJson<CatalogProduct>(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function deleteProduct(id: string): Promise<{ id: string }> {
  return apiJson(`/api/products/${id}`, { method: "DELETE" });
}

export async function fetchCustomerChurn(id: string): Promise<ChurnPrediction> {
  return apiJson<ChurnPrediction>(`/api/customers/${id}/churn`);
}

export async function fetchScripts(): Promise<StoredScript[]> {
  const rows = await apiJson<Array<Record<string, unknown>>>("/api/scripts");
  return rows.map((row) => {
    const content = (row.content ?? {}) as Partial<SalesScriptContent>;
    return {
      id: String(row.id),
      name: row.name ? String(row.name) : null,
      script_type: row.script_type ? String(row.script_type) : null,
      content: {
        opening: String(content.opening ?? ""),
        value_proposition: String(content.value_proposition ?? ""),
        objection_handlers: Array.isArray(content.objection_handlers)
          ? content.objection_handlers.map((item) => ({
              objection: String(item.objection ?? ""),
              response: String(item.response ?? ""),
            }))
          : [],
        closing: String(content.closing ?? ""),
      },
    };
  });
}

export async function generateScript(input: {
  customer_id?: string;
  customer_name?: string;
  product_id?: string;
  product_name?: string;
  preferred_language?: string;
}): Promise<SalesScriptContent> {
  return apiJson<SalesScriptContent>("/api/scripts/generate", { method: "POST", body: JSON.stringify(input) });
}

export async function saveScript(input: {
  name: string;
  script_type?: string;
  content: SalesScriptContent;
}): Promise<StoredScript> {
  return apiJson<StoredScript>("/api/scripts", { method: "POST", body: JSON.stringify(input) });
}

export async function updateScript(
  id: string,
  input: { name: string; script_type?: string; content: SalesScriptContent },
): Promise<StoredScript> {
  return apiJson<StoredScript>(`/api/scripts/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function deleteScript(id: string): Promise<{ id: string }> {
  return apiJson(`/api/scripts/${id}`, { method: "DELETE" });
}

export async function fetchInsightOverview(): Promise<InsightOverview> {
  return apiJson<InsightOverview>("/api/insights/overview");
}
