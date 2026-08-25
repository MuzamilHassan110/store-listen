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
  FollowUp,
  FollowUpPriority,
  FollowUpStatus,
  LeaderboardEntry,
  Paginated,
  PurchaseIntent,
  Report,
  RuleResult,
  SalesmanPerformance,
  Sentiment,
  Transcript,
  TranscriptSegment,
} from "../types/conversation";

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

export async function fetchAnalytics(dateRange?: DateRange): Promise<Analytics> {
  const client = await requireClient();
  let query = client
    .from("conversations")
    .select("*, conversation_analyses(*)")
    .order("recorded_at", { ascending: false });
  if (dateRange?.from) query = query.gte("recorded_at", startOfDay(parseISO(dateRange.from)).toISOString());
  if (dateRange?.to) query = query.lte("recorded_at", endOfDay(parseISO(dateRange.to)).toISOString());

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
  return apiJson<Customer>(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify({ notes }) });
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
