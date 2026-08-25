import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import { logActivity } from "./activity.service.js";
import { createNotification } from "./notification.service.js";
import { queueFollowUpIfConsented, queueHighIntentAlert } from "./communication.service.js";

export type ExtractedCustomer = {
  name: string | null;
  phone: string | null;
  productInterest: string | null;
};

export type LeadScoreInput = {
  purchaseIntent?: string | null;
  sentiment?: string | null;
  questionCount: number;
  objectionCount: number;
  durationSeconds: number;
};

export type FollowUpRow = {
  id: string;
  organization_id: string;
  conversation_id: string;
  customer_id?: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  product_interest: string | null;
  priority: "high" | "medium" | "low";
  status: "pending" | "completed" | "cancelled" | "snoozed";
  follow_up_date: string | null;
  notes: string | null;
  suggested_message: string | null;
  lead_score: number | null;
  assigned_to: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  contact_method?: "whatsapp" | "sms";
  message_sent?: boolean;
};

const PHONE_RE = /(?:\+?92|0)?[\s-]?(?:3\d{2})[\s-]?\d{7}|\+?\d[\d\s()-]{8,14}\d/g;
const NAME_PATTERNS = [
  /(?:my name is|i am|i'm|this is)\s+([A-Z][a-zA-Z]{1,20}(?:\s+[A-Z][a-zA-Z]{1,20})?)/i,
  /(?:mera naam|main|mein)\s+([A-Za-z\u0600-\u06FF]{2,20})/i,
];

export function extractCustomerInfo(transcript: string, keyPoints: string[] = []): ExtractedCustomer {
  const phones = transcript.match(PHONE_RE)?.map((value) => value.replace(/[^\d+]/g, "")) ?? [];
  const phone = phones.find((value) => value.replace(/\D/g, "").length >= 10) ?? null;

  let name: string | null = null;
  for (const pattern of NAME_PATTERNS) {
    const match = transcript.match(pattern);
    if (match?.[1]) {
      name = match[1].trim();
      break;
    }
  }

  const productInterest =
    keyPoints.find((point) => point.trim().length > 0)?.slice(0, 160) ??
    extractProductFromText(transcript);

  return { name, phone, productInterest };
}

function extractProductFromText(transcript: string): string | null {
  const match = transcript.match(
    /(?:looking for|interested in|about the|this)\s+([a-zA-Z0-9\u0600-\u06FF][\w\s\u0600-\u06FF-]{2,40})/i,
  );
  return match?.[1]?.trim() ?? null;
}

export function scoreLead(input: LeadScoreInput): number {
  const intent =
    input.purchaseIntent === "high" ? 40 : input.purchaseIntent === "medium" ? 20 : input.purchaseIntent === "low" ? 5 : 10;
  const sentiment = input.sentiment === "positive" ? 20 : input.sentiment === "neutral" ? 10 : 0;
  const questions = input.questionCount > 3 ? 15 : input.questionCount > 1 ? 10 : input.questionCount === 0 ? 5 : 8;
  const objections = input.objectionCount < 2 ? 15 : input.objectionCount < 5 ? 10 : 5;
  const duration = input.durationSeconds > 300 ? 10 : input.durationSeconds > 120 ? 5 : 2;
  return Math.max(0, Math.min(100, intent + sentiment + questions + objections + duration));
}

export function shouldCreateLead(intent?: string | null, sentiment?: string | null): boolean {
  const goodIntent = intent === "high" || intent === "medium";
  const goodSentiment = sentiment === "positive" || sentiment === "neutral";
  return goodIntent && goodSentiment;
}

function followUpDate(priority: "high" | "medium" | "low"): string {
  const date = new Date();
  date.setDate(date.getDate() + (priority === "high" ? 1 : priority === "medium" ? 3 : 7));
  return date.toISOString();
}

function asPriority(intent?: string | null): "high" | "medium" | "low" {
  return intent === "high" || intent === "low" ? intent : "medium";
}

async function ensureProfile(userId: string, organizationId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { error } = await supabase.from("profiles").upsert(
    { id: userId, organization_id: organizationId },
    { onConflict: "id" },
  );
  if (error) {
    logger.warn({ error, userId }, "Could not upsert profile for follow-up created_by");
    return null;
  }
  return userId;
}

export async function upsertCustomerFromVisit(input: {
  organizationId: string;
  conversationId: string;
  name?: string | null;
  phone?: string | null;
  language?: string | null;
  notes?: string | null;
}): Promise<string | null> {
  if (!input.name && !input.phone) return null;
  const supabase = getSupabase();
  let existing = null as Record<string, unknown> | null;

  if (input.phone) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("phone", input.phone)
      .maybeSingle();
    existing = data;
  }
  if (!existing && input.name) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("organization_id", input.organizationId)
      .ilike("name", input.name)
      .maybeSingle();
    existing = data;
  }

  if (existing) {
    const { data } = await supabase
      .from("customers")
      .update({
        name: input.name || existing.name,
        phone: input.phone || existing.phone,
        last_visit_at: new Date().toISOString(),
        total_visits: Number(existing.total_visits ?? 1) + 1,
        preferred_language: input.language || existing.preferred_language,
        notes: input.notes || existing.notes,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    const customerId = data?.id ? String(data.id) : String(existing.id);
    await supabase.from("customer_interactions").insert({
      customer_id: customerId,
      conversation_id: input.conversationId,
      interaction_type: "visit",
      notes: input.notes,
    });
    return customerId;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: input.organizationId,
      name: input.name,
      phone: input.phone,
      last_visit_at: new Date().toISOString(),
      total_visits: 1,
      preferred_language: input.language,
      notes: input.notes,
    })
    .select("id")
    .single();
  if (error || !data) {
    logger.error({ error }, "Failed to create customer");
    return null;
  }
  await supabase.from("customer_interactions").insert({
    customer_id: data.id,
    conversation_id: input.conversationId,
    interaction_type: "visit",
    notes: input.notes,
  });
  return String(data.id);
}

export function buildFollowUpMessage(input: {
  customerName?: string | null;
  productInterest?: string | null;
  objections?: string[];
  sentiment?: string | null;
  notes?: string | null;
}): string {
  const name = input.customerName || "there";
  const product = input.productInterest || "the product we discussed";
  const objection = input.objections?.[0];
  const closer =
    input.sentiment === "positive"
      ? "Happy to reserve one if you would like to move forward."
      : "I can walk you through options that fit your needs.";
  return [
    `Hi ${name}, thanks for visiting us.`,
    `I wanted to follow up about ${product}.`,
    objection ? `You mentioned ${objection} — I have a couple of alternatives that may help.` : null,
    closer,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function generateFollowUpMessage(followUp: {
  customer_name?: string | null;
  product_interest?: string | null;
  notes?: string | null;
  objections?: string[];
  sentiment?: string | null;
}): Promise<string> {
  const fallback = buildFollowUpMessage({
    customerName: followUp.customer_name,
    productInterest: followUp.product_interest,
    objections: followUp.objections,
    sentiment: followUp.sentiment,
    notes: followUp.notes,
  });
  if (!env.GEMINI_API_KEY) return fallback;

  try {
    const model = new GoogleGenerativeAI(env.GEMINI_API_KEY).getGenerativeModel({
      model: env.GEMINI_MODEL,
      generationConfig: { temperature: 0.4 },
    });
    const result = await model.generateContent(
      `Write a short, friendly retail follow-up SMS (max 2 sentences) for a store customer.
Customer: ${followUp.customer_name ?? "unknown"}
Product interest: ${followUp.product_interest ?? "unknown"}
Sentiment: ${followUp.sentiment ?? "neutral"}
Objections: ${(followUp.objections ?? []).join("; ") || "none"}
Notes: ${followUp.notes ?? ""}
Return only the message text.`,
    );
    const text = result.response.text().trim();
    return text || fallback;
  } catch (err) {
    logger.warn({ err }, "Gemini follow-up message failed; using template");
    return fallback;
  }
}

export async function detectLeads(conversationId: string, createdBy?: string | null): Promise<FollowUpRow | null> {
  const supabase = getSupabase();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("*, conversation_analyses(*), transcripts(*)")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Failed to load conversation for lead detection.", "LEAD_LOAD_FAILED");
  if (!conversation) throw new HttpError(404, "Conversation not found.", "NOT_FOUND");

  const analyses = Array.isArray(conversation.conversation_analyses)
    ? conversation.conversation_analyses
    : conversation.conversation_analyses
      ? [conversation.conversation_analyses]
      : [];
  const analysis = analyses.sort((a: { created_at?: string }, b: { created_at?: string }) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  )[0] as Record<string, unknown> | undefined;
  if (!analysis) return null;

  const intent = analysis.purchase_intent ? String(analysis.purchase_intent) : null;
  const sentiment = analysis.sentiment ? String(analysis.sentiment) : null;
  if (!shouldCreateLead(intent, sentiment)) return null;

  const { data: existing } = await supabase
    .from("follow_ups")
    .select("id")
    .eq("conversation_id", conversationId)
    .not("status", "eq", "cancelled")
    .limit(1)
    .maybeSingle();
  if (existing) return null;

  const transcripts = Array.isArray(conversation.transcripts)
    ? conversation.transcripts
    : conversation.transcripts
      ? [conversation.transcripts]
      : [];
  const transcriptText = String(transcripts[0]?.text ?? "");
  const keyPoints = Array.isArray(analysis.key_points) ? analysis.key_points.map(String) : [];
  const objections = Array.isArray(analysis.objections) ? analysis.objections.map(String) : [];
  const questions = Array.isArray(analysis.customer_questions) ? analysis.customer_questions.map(String) : [];
  const extracted = extractCustomerInfo(transcriptText, keyPoints);
  const priority = asPriority(intent);
  const leadScore = scoreLead({
    purchaseIntent: intent,
    sentiment,
    questionCount: questions.length,
    objectionCount: objections.length,
    durationSeconds: Number(conversation.duration_seconds ?? analysis.duration_spoken_seconds ?? 0),
  });

  const organizationId = String(conversation.organization_id);
  const customerId = await upsertCustomerFromVisit({
    organizationId,
    conversationId,
    name: extracted.name,
    phone: extracted.phone,
    language: conversation.language ? String(conversation.language) : null,
    notes: analysis.summary ? String(analysis.summary) : null,
  });

  const createdById = createdBy ? await ensureProfile(createdBy, organizationId) : null;
  const suggested = buildFollowUpMessage({
    customerName: extracted.name,
    productInterest: extracted.productInterest,
    objections,
    sentiment,
    notes: analysis.summary ? String(analysis.summary) : null,
  });

  const { data: followUp, error: insertError } = await supabase
    .from("follow_ups")
    .insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      store_id: conversation.store_id ?? null,
      customer_id: customerId,
      customer_name: extracted.name,
      customer_phone: extracted.phone,
      product_interest: extracted.productInterest,
      priority,
      status: "pending",
      follow_up_date: followUpDate(priority),
      notes: analysis.summary ? String(analysis.summary) : null,
      suggested_message: suggested,
      lead_score: leadScore,
      assigned_to: conversation.salesman_id ?? null,
      created_by: createdById,
    })
    .select()
    .single();

  if (insertError || !followUp) {
    logger.error({ error: insertError, conversationId }, "Failed to create follow-up from lead");
    return null;
  }

  await logActivity({
    organizationId,
    storeId: conversation.store_id ? String(conversation.store_id) : null,
    userId: createdById,
    activityType: "lead_detected",
    description: `Lead detected${extracted.name ? ` for ${extracted.name}` : ""}`,
    metadata: { conversation_id: conversationId, follow_up_id: followUp.id, lead_score: leadScore },
  });

  if (priority === "high") {
    await createNotification({
      organizationId,
      type: "high_intent",
      title: "High-intent lead",
      message: `${extracted.name || "A customer"} is interested in ${extracted.productInterest || "a product"}.`,
      metadata: { conversation_id: conversationId, follow_up_id: followUp.id, lead_score: leadScore },
    });
    void queueHighIntentAlert(organizationId, {
      store_name: "store",
      customer_name: extracted.name,
      product_name: extracted.productInterest,
      score: leadScore,
      link: `/followups`,
    });
  }

  void queueFollowUpIfConsented(organizationId, String(followUp.id));
  return followUp as FollowUpRow;
}

export async function processConversationInsights(input: {
  conversationId: string;
  organizationId: string;
  overallScore?: number | null;
  ruleCompliance?: number | null;
  createdBy?: string | null;
}): Promise<void> {
  try {
    await detectLeads(input.conversationId, input.createdBy);
  } catch (err) {
    logger.error({ err, conversationId: input.conversationId }, "Lead detection failed");
  }

  if (typeof input.overallScore === "number" && input.overallScore < 60) {
    await createNotification({
      organizationId: input.organizationId,
      type: "score_drop",
      title: "Salesman score dropped",
      message: `Latest conversation scored ${input.overallScore}. Review coaching tips.`,
      metadata: { conversation_id: input.conversationId, overall_score: input.overallScore },
    });
  }

  if (typeof input.ruleCompliance === "number" && input.ruleCompliance < 50) {
    await createNotification({
      organizationId: input.organizationId,
      type: "rule_violation",
      title: "Low rule compliance",
      message: `Rule compliance was ${input.ruleCompliance}%. Required talking points were missed.`,
      metadata: { conversation_id: input.conversationId, rule_compliance_score: input.ruleCompliance },
    });
  }
}
