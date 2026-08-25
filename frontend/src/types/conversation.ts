export type ConversationStatus = "recorded" | "queued" | "processing" | "analyzed" | "scored" | "failed";
export type Sentiment = "positive" | "negative" | "neutral";
export type PurchaseIntent = "high" | "medium" | "low";

export interface Transcript {
  id: string;
  conversation_id: string;
  text: string | null;
  language: string | null;
  original_text?: string | null;
  translated_text?: string | null;
  original_language?: string | null;
  translation_language?: string | null;
  is_auto_generated?: boolean;
  created_at?: string;
}

export interface LanguageInsights {
  idioms?: string[];
  cultural_notes?: string[];
  local_objections?: string[];
}

export interface ScoreBreakdown {
  overall_score: number;
  communication_score: number;
  product_knowledge_score: number;
  objection_handling_score: number;
  closing_ability_score: number;
  rule_compliance_score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface ConversationRule {
  id: string;
  rule_type: string;
  description: string;
  keywords: string[];
  is_active: boolean;
}

export interface RuleResult {
  rule_id: string;
  rule_type: string;
  description?: string;
  is_followed: boolean;
  evidence?: string | null;
}

export interface ConversationAnalysis extends Partial<ScoreBreakdown> {
  id: string;
  conversation_id: string;
  summary?: string | null;
  sentiment: Sentiment;
  purchase_intent: PurchaseIntent;
  objections: string[];
  key_points: string[];
  customer_questions: string[];
  language?: string | null;
  language_code?: string | null;
  language_confidence?: number | null;
  summary_original?: string | null;
  language_specific_insights?: LanguageInsights | null;
  duration_spoken_seconds?: number | null;
  ai_model?: string | null;
  ai_processed_at?: string | null;
}

export interface TranscriptSegment {
  id: string;
  speaker: "salesman" | "customer";
  text: string;
  start_time: number;
  end_time: number;
}

export interface Conversation {
  id: string;
  organization_id: string;
  store_id?: string | null;
  salesman_id?: string | null;
  salesman_name?: string | null;
  device_id?: string | null;
  duration_seconds: number;
  language?: string | null;
  recording_url?: string | null;
  recording_path?: string | null;
  status: ConversationStatus;
  recorded_at: string;
  created_at: string;
  transcript?: Transcript | null;
  analysis?: ConversationAnalysis | null;
  segments?: TranscriptSegment[];
  rule_results?: RuleResult[];
}

export interface SalesmanPerformance {
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
}

export interface LeaderboardEntry {
  rank: number;
  salesman_id: string;
  salesman_name: string;
  total_conversations: number;
  average_score: number;
  average_scores: SalesmanPerformance["average_scores"];
}

export interface ConversationFilters {
  search?: string;
  status?: ConversationStatus | "all";
  sentiment?: Sentiment | "all";
  salesmanId?: string | "all";
  storeId?: string | "all";
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface Analytics {
  totalConversations: number;
  averageDuration: number;
  totalRecordingTime: number;
  analyzedPercentage: number;
  todayCount: number;
  pendingCount: number;
  highIntentCount: number;
  averageSentimentScore: number;
  perDay: Array<{ date: string; count: number }>;
  sentiment: Array<{ name: string; value: number }>;
  intent: Array<{ name: string; value: number }>;
  objections: Array<{ name: string; value: number }>;
  languages: Array<{ name: string; value: number }>;
  recent: Conversation[];
  peakHours: Array<{ name: string; value: number }>;
  objectionTrend: Array<{ date: string; count: number }>;
  products: Array<{ name: string; value: number }>;
  funnel: Array<{ name: string; value: number }>;
  salesmanTrend: Array<{ name: string; value: number }>;
}

export interface Report {
  range: DateRange;
  generatedAt: string;
  analytics: Analytics;
  conversations: Conversation[];
}

export type FollowUpPriority = "high" | "medium" | "low";
export type FollowUpStatus = "pending" | "completed" | "cancelled" | "snoozed";

export interface FollowUp {
  id: string;
  organization_id?: string;
  conversation_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  product_interest?: string | null;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  follow_up_date?: string | null;
  notes?: string | null;
  suggested_message?: string | null;
  assigned_to?: string | null;
  lead_score?: number | null;
  salesman_name?: string | null;
  conversation_summary?: string | null;
  conversation_recorded_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
}

export interface Customer {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  total_visits: number;
  total_purchases: number;
  last_visit_at?: string | null;
  preferred_language?: string | null;
  notes?: string | null;
  purchase_probability?: number;
}

export interface CustomerDetail extends Customer {
  interactions: Array<{
    id: string;
    conversation_id: string;
    interaction_type: string | null;
    notes: string | null;
    created_at: string;
  }>;
  follow_ups: FollowUp[];
  conversations: Array<{
    id: string;
    recorded_at?: string;
    duration_seconds?: number;
    status?: string;
    language?: string;
  }>;
}

export interface StoredReport {
  id: string;
  organization_id: string;
  report_type: "conversation" | "salesman" | "store" | "daily" | "weekly" | "monthly" | string;
  file_url: string | null;
  file_name: string | null;
  generated_at: string;
  date_range?: { start: string; end: string } | null;
  metadata?: Record<string, unknown>;
}

export interface ScheduledReport {
  id: string;
  report_type: string;
  recipient_email?: string | null;
  is_active: boolean;
  last_sent_at?: string | null;
}

export interface RetentionStatus {
  conversation_count: number;
  recordings_count: number;
  archived_count: number;
  oldest_conversation: string | null;
  retention_days: number;
  next_cleanup_date: string | null;
}

export interface ExportFile {
  filename: string;
  csv: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}
