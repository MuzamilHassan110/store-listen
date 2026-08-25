import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import { decryptText, encryptText, hashPhone } from "./encryption.service.js";

export type CustomerRow = {
  id: string;
  organization_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  total_visits: number;
  total_purchases: number;
  last_visit_at: string | null;
  preferred_language: string | null;
  notes: string | null;
  purchase_probability: number;
  created_at: string;
  whatsapp_number: string | null;
  sms_number: string | null;
  preferred_contact: "whatsapp" | "sms";
  contact_consent: boolean;
};

export type CustomerDetail = CustomerRow & {
  interactions: Array<{
    id: string;
    conversation_id: string;
    interaction_type: string | null;
    notes: string | null;
    created_at: string;
  }>;
  follow_ups: Array<Record<string, unknown>>;
  conversations: Array<Record<string, unknown>>;
};

function purchaseProbability(visits: number, purchases: number, latestScore?: number | null): number {
  const closeRate = visits > 0 ? (purchases / visits) * 60 : 0;
  const scoreShare = typeof latestScore === "number" ? latestScore * 0.4 : 20;
  return Math.round(Math.max(5, Math.min(95, closeRate + scoreShare)));
}

function mapCustomer(row: Record<string, unknown>, latestScore?: number | null): CustomerRow {
  const visits = Number(row.total_visits ?? 1);
  const purchases = Number(row.total_purchases ?? 0);
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    name: row.name ? String(row.name) : null,
    phone: decryptText(row.phone ? String(row.phone) : null),
    email: decryptText(row.email ? String(row.email) : null),
    total_visits: visits,
    total_purchases: purchases,
    last_visit_at: row.last_visit_at ? String(row.last_visit_at) : null,
    preferred_language: row.preferred_language ? String(row.preferred_language) : null,
    notes: row.notes ? String(row.notes) : null,
    purchase_probability: purchaseProbability(visits, purchases, latestScore),
    created_at: String(row.created_at ?? new Date().toISOString()),
    whatsapp_number: decryptText(row.whatsapp_number ? String(row.whatsapp_number) : null),
    sms_number: decryptText(row.sms_number ? String(row.sms_number) : null),
    preferred_contact: row.preferred_contact === "sms" ? "sms" : "whatsapp",
    contact_consent: Boolean(row.contact_consent),
  };
}

export async function listCustomers(organizationId: string, search?: string): Promise<CustomerRow[]> {
  let query = getSupabase()
    .from("customers")
    .select("*, follow_ups (lead_score, created_at)")
    .eq("organization_id", organizationId)
    .order("last_visit_at", { ascending: false, nullsFirst: false });
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  }
  const { data, error } = await query.limit(200);
  if (error) {
    logger.error({ error, organizationId }, "Failed to list customers");
    throw new HttpError(500, "Failed to load customers.", "CUSTOMERS_LOAD_FAILED");
  }
  return (data ?? []).map((row) => {
    const followUps = Array.isArray(row.follow_ups) ? row.follow_ups : [];
    const latest = followUps
      .slice()
      .sort((a: { created_at?: string }, b: { created_at?: string }) =>
        String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
      )[0] as { lead_score?: number } | undefined;
    return mapCustomer(row as Record<string, unknown>, latest?.lead_score);
  });
}

export async function getCustomerDetail(organizationId: string, customerId: string): Promise<CustomerDetail> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Failed to load customer.", "CUSTOMER_LOAD_FAILED");
  if (!data) throw new HttpError(404, "Customer not found.", "NOT_FOUND");

  const [{ data: interactions }, { data: followUps }] = await Promise.all([
    supabase
      .from("customer_interactions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("follow_ups")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  ]);

  const conversationIds = [...new Set((interactions ?? []).map((item) => String(item.conversation_id)))];
  const { data: conversations } = conversationIds.length
    ? await supabase
        .from("conversations")
        .select("id, recorded_at, duration_seconds, status, language")
        .in("id", conversationIds)
        .order("recorded_at", { ascending: false })
    : { data: [] };

  const latestScore = followUps?.[0]?.lead_score as number | undefined;
  return {
    ...mapCustomer(data as Record<string, unknown>, latestScore),
    interactions: (interactions ?? []).map((item) => ({
      id: String(item.id),
      conversation_id: String(item.conversation_id),
      interaction_type: item.interaction_type ? String(item.interaction_type) : null,
      notes: item.notes ? String(item.notes) : null,
      created_at: String(item.created_at),
    })),
    follow_ups: (followUps ?? []).map((item) => ({
      id: String(item.id),
      conversation_id: String(item.conversation_id),
      customer_name: item.customer_name,
      product_interest: item.product_interest,
      priority: item.priority === "high" || item.priority === "low" ? item.priority : "medium",
      status:
        item.status === "completed" || item.status === "cancelled" || item.status === "snoozed"
          ? item.status
          : "pending",
      follow_up_date: item.follow_up_date,
      lead_score: item.lead_score,
    })),
    conversations: conversations ?? [],
  };
}

export async function updateCustomerNotes(
  organizationId: string,
  customerId: string,
  notes: string,
): Promise<CustomerRow> {
  return updateCustomer(organizationId, customerId, { notes });
}

export async function updateCustomer(
  organizationId: string,
  customerId: string,
  input: Partial<{
    notes: string;
    whatsapp_number: string | null;
    sms_number: string | null;
    preferred_contact: "whatsapp" | "sms";
    contact_consent: boolean;
    phone: string | null;
  }>,
): Promise<CustomerRow> {
  const patch: Record<string, unknown> = { ...input };
  if (input.phone !== undefined) {
    patch.phone = encryptText(input.phone);
    patch.phone_hash = hashPhone(input.phone);
    patch.contacts_encrypted = true;
  }
  if (input.whatsapp_number !== undefined) patch.whatsapp_number = encryptText(input.whatsapp_number);
  if (input.sms_number !== undefined) patch.sms_number = encryptText(input.sms_number);
  const { data, error } = await getSupabase()
    .from("customers")
    .update(patch)
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .select()
    .maybeSingle();
  if (error || !data) throw new HttpError(error ? 500 : 404, "Failed to update customer.", "CUSTOMER_UPDATE_FAILED");
  return mapCustomer(data as Record<string, unknown>);
}
