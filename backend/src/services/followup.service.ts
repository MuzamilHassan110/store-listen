import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import { generateFollowUpMessage, type FollowUpRow } from "./lead.service.js";

export type FollowUpFilters = {
  status?: string;
  priority?: string;
  assignedTo?: string;
  from?: string;
  to?: string;
  search?: string;
};

export type FollowUpWithContext = FollowUpRow & {
  salesman_name?: string | null;
  conversation_summary?: string | null;
  conversation_recorded_at?: string | null;
};

function mapFollowUp(row: Record<string, unknown>): FollowUpWithContext {
  const salesman = Array.isArray(row.salesmen) ? row.salesmen[0] : row.salesmen;
  const conversations = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations;
  const analyses = conversations
    ? Array.isArray((conversations as Record<string, unknown>).conversation_analyses)
      ? ((conversations as Record<string, unknown>).conversation_analyses as Array<Record<string, unknown>>)[0]
      : (conversations as Record<string, unknown>).conversation_analyses
    : null;
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    conversation_id: String(row.conversation_id),
    customer_id: row.customer_id ? String(row.customer_id) : null,
    customer_name: row.customer_name ? String(row.customer_name) : null,
    customer_phone: row.customer_phone ? String(row.customer_phone) : null,
    product_interest: row.product_interest ? String(row.product_interest) : null,
    priority: (row.priority === "high" || row.priority === "low" ? row.priority : "medium") as FollowUpRow["priority"],
    status: (["pending", "completed", "cancelled", "snoozed"].includes(String(row.status))
      ? row.status
      : "pending") as FollowUpRow["status"],
    follow_up_date: row.follow_up_date ? String(row.follow_up_date) : null,
    notes: row.notes ? String(row.notes) : null,
    suggested_message: row.suggested_message ? String(row.suggested_message) : null,
    lead_score: typeof row.lead_score === "number" ? row.lead_score : null,
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
    created_by: row.created_by ? String(row.created_by) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    salesman_name: salesman && typeof salesman === "object" ? String((salesman as { name?: string }).name ?? "") : null,
    conversation_summary:
      analyses && typeof analyses === "object" ? String((analyses as { summary?: string }).summary ?? "") : null,
    conversation_recorded_at:
      conversations && typeof conversations === "object"
        ? String((conversations as { recorded_at?: string }).recorded_at ?? "")
        : null,
  };
}

const SELECT = `
  *,
  salesmen (name),
  conversations (recorded_at, conversation_analyses (summary))
`;

export async function listFollowUps(
  organizationId: string,
  filters: FollowUpFilters = {},
): Promise<FollowUpWithContext[]> {
  let query = getSupabase()
    .from("follow_ups")
    .select(SELECT)
    .eq("organization_id", organizationId)
    .order("follow_up_date", { ascending: true, nullsFirst: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
  if (filters.from) query = query.gte("follow_up_date", filters.from);
  if (filters.to) query = query.lte("follow_up_date", filters.to);
  if (filters.search) query = query.ilike("customer_name", `%${filters.search}%`);

  const { data, error } = await query.limit(200);
  if (error) {
    logger.error({ error, organizationId }, "Failed to list follow-ups");
    throw new HttpError(500, "Failed to load follow-ups.", "FOLLOWUPS_LOAD_FAILED");
  }
  return (data ?? []).map((row) => mapFollowUp(row as Record<string, unknown>));
}

export async function listDueToday(organizationId: string): Promise<FollowUpWithContext[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return listFollowUps(organizationId, {
    from: start.toISOString(),
    to: end.toISOString(),
    status: undefined,
  }).then((rows) => rows.filter((row) => row.status === "pending" || row.status === "snoozed"));
}

export async function createFollowUp(
  organizationId: string,
  input: {
    conversation_id: string;
    customer_name?: string;
    customer_phone?: string;
    product_interest?: string;
    priority?: FollowUpRow["priority"];
    follow_up_date?: string;
    notes?: string;
    assigned_to?: string | null;
    customer_id?: string | null;
  },
): Promise<FollowUpWithContext> {
  const { data, error } = await getSupabase()
    .from("follow_ups")
    .insert({
      organization_id: organizationId,
      conversation_id: input.conversation_id,
      customer_id: input.customer_id ?? null,
      customer_name: input.customer_name ?? null,
      customer_phone: input.customer_phone ?? null,
      product_interest: input.product_interest ?? null,
      priority: input.priority ?? "medium",
      status: "pending",
      follow_up_date: input.follow_up_date ?? new Date(Date.now() + 86_400_000).toISOString(),
      notes: input.notes ?? null,
      assigned_to: input.assigned_to ?? null,
    })
    .select(SELECT)
    .single();
  if (error || !data) {
    logger.error({ error }, "Failed to create follow-up");
    throw new HttpError(500, "Failed to create follow-up.", "FOLLOWUP_CREATE_FAILED");
  }
  return mapFollowUp(data as Record<string, unknown>);
}

export async function updateFollowUp(
  organizationId: string,
  id: string,
  input: Partial<{
    status: FollowUpRow["status"];
    follow_up_date: string;
    notes: string;
    assigned_to: string | null;
    customer_name: string;
    customer_phone: string;
    product_interest: string;
    priority: FollowUpRow["priority"];
    suggested_message: string;
  }>,
): Promise<FollowUpWithContext> {
  const { data, error } = await getSupabase()
    .from("follow_ups")
    .update(input)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select(SELECT)
    .maybeSingle();
  if (error) throw new HttpError(500, "Failed to update follow-up.", "FOLLOWUP_UPDATE_FAILED");
  if (!data) throw new HttpError(404, "Follow-up not found.", "NOT_FOUND");
  return mapFollowUp(data as Record<string, unknown>);
}

export async function cancelFollowUp(organizationId: string, id: string): Promise<FollowUpWithContext> {
  return updateFollowUp(organizationId, id, { status: "cancelled" });
}

export async function completeFollowUp(
  organizationId: string,
  id: string,
  notes?: string,
): Promise<FollowUpWithContext> {
  const current = await getFollowUp(organizationId, id);
  return updateFollowUp(organizationId, id, {
    status: "completed",
    notes: notes ?? current.notes ?? undefined,
  }).then(async (row) => {
    await getSupabase()
      .from("follow_ups")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", id);
    if (row.customer_id) {
      await getSupabase().from("customer_interactions").insert({
        customer_id: row.customer_id,
        conversation_id: row.conversation_id,
        interaction_type: "follow_up",
        notes: notes ?? "Follow-up completed",
      });
    }
    return { ...row, status: "completed" as const, completed_at: new Date().toISOString() };
  });
}

export async function snoozeFollowUp(
  organizationId: string,
  id: string,
  followUpDate: string,
): Promise<FollowUpWithContext> {
  return updateFollowUp(organizationId, id, { status: "snoozed", follow_up_date: followUpDate });
}

export async function getFollowUp(organizationId: string, id: string): Promise<FollowUpWithContext> {
  const { data, error } = await getSupabase()
    .from("follow_ups")
    .select(SELECT)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Failed to load follow-up.", "FOLLOWUP_LOAD_FAILED");
  if (!data) throw new HttpError(404, "Follow-up not found.", "NOT_FOUND");
  return mapFollowUp(data as Record<string, unknown>);
}

export async function suggestFollowUpMessage(organizationId: string, id: string): Promise<FollowUpWithContext> {
  const followUp = await getFollowUp(organizationId, id);
  const message = await generateFollowUpMessage({
    customer_name: followUp.customer_name,
    product_interest: followUp.product_interest,
    notes: followUp.notes,
    sentiment: null,
  });
  return updateFollowUp(organizationId, id, { suggested_message: message });
}
