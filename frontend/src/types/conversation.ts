export type ConversationStatus = "recorded" | "queued" | "processing" | "analyzed" | "failed";
export type Sentiment = "positive" | "negative" | "neutral";
export type PurchaseIntent = "high" | "medium" | "low";

export interface Transcript {
  id: string;
  conversation_id: string;
  text: string | null;
  language: string | null;
  is_auto_generated?: boolean;
  created_at?: string;
}

export interface ConversationAnalysis {
  id: string;
  conversation_id: string;
  summary?: string | null;
  sentiment: Sentiment;
  purchase_intent: PurchaseIntent;
  objections: string[];
  key_points: string[];
  customer_questions: string[];
  language?: string | null;
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
}

export interface ConversationFilters {
  search?: string;
  status?: ConversationStatus | "all";
  sentiment?: Sentiment | "all";
  salesmanId?: string | "all";
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
}

export interface Report {
  range: DateRange;
  generatedAt: string;
  analytics: Analytics;
  conversations: Conversation[];
}
