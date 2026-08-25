import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";

export type NotificationType =
  | "high_intent"
  | "follow_up_due"
  | "score_drop"
  | "rule_violation"
  | "analysis_failed";

export type AppNotification = {
  id: string;
  organization_id: string;
  user_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

function mapNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    user_id: row.user_id ? String(row.user_id) : null,
    type: String(row.type ?? ""),
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    is_read: Boolean(row.is_read),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function createNotification(input: {
  organizationId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<AppNotification | null> {
  const { data, error } = await getSupabase()
    .from("notifications")
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();
  if (error || !data) {
    logger.error({ error, type: input.type }, "Failed to create notification");
    return null;
  }
  return mapNotification(data as Record<string, unknown>);
}

export async function listNotifications(
  organizationId: string,
  userId?: string,
): Promise<AppNotification[]> {
  let query = getSupabase()
    .from("notifications")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (userId) {
    query = query.or(`user_id.is.null,user_id.eq.${userId}`);
  }
  const { data, error } = await query;
  if (error) {
    logger.error({ error, organizationId }, "Failed to list notifications");
    throw error;
  }
  return (data ?? []).map((row) => mapNotification(row as Record<string, unknown>));
}

export async function markNotificationRead(
  organizationId: string,
  notificationId: string,
): Promise<AppNotification> {
  const { data, error } = await getSupabase()
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("organization_id", organizationId)
    .select()
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Notification not found.");
  return mapNotification(data as Record<string, unknown>);
}

export async function markAllNotificationsRead(organizationId: string, userId?: string): Promise<number> {
  let query = getSupabase()
    .from("notifications")
    .update({ is_read: true })
    .eq("organization_id", organizationId)
    .eq("is_read", false);
  if (userId) query = query.or(`user_id.is.null,user_id.eq.${userId}`);
  const { data, error } = await query.select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function deleteNotification(organizationId: string, notificationId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("organization_id", organizationId);
  if (error) throw error;
}

export async function notifyDueFollowUps(organizationId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const { data: due } = await getSupabase()
    .from("follow_ups")
    .select("id, customer_name, priority")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "snoozed"])
    .gte("follow_up_date", start.toISOString())
    .lte("follow_up_date", end.toISOString());

  let created = 0;
  for (const item of due ?? []) {
    const { data: existing } = await getSupabase()
      .from("notifications")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("type", "follow_up_due")
      .contains("metadata", { follow_up_id: item.id })
      .limit(1)
      .maybeSingle();
    if (existing) continue;
    const saved = await createNotification({
      organizationId,
      type: "follow_up_due",
      title: "Follow-up due today",
      message: `Call ${item.customer_name || "a customer"} (${item.priority} priority).`,
      metadata: { follow_up_id: item.id },
    });
    if (saved) created += 1;
  }
  return created;
}
