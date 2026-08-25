import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";

export type ActivityType =
  | "conversation_uploaded"
  | "analysis_completed"
  | "lead_detected"
  | "follow_up_created"
  | "score_updated"
  | "device_registered"
  | "device_sync";

export type ActivityLog = {
  id: string;
  organization_id: string;
  store_id: string | null;
  user_id: string | null;
  activity_type: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function logActivity(input: {
  organizationId: string;
  storeId?: string | null;
  userId?: string | null;
  activityType: ActivityType | string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await getSupabase().from("activity_logs").insert({
    organization_id: input.organizationId,
    store_id: input.storeId ?? null,
    user_id: input.userId ?? null,
    activity_type: input.activityType,
    description: input.description,
    metadata: input.metadata ?? {},
  });
  if (error) {
    logger.warn({ error, type: input.activityType }, "Could not write activity log; run migration 008");
  }
}

export async function listActivity(input: {
  organizationId: string;
  storeId?: string | null;
  storeIds?: string[];
  limit?: number;
}): Promise<ActivityLog[]> {
  let query = getSupabase()
    .from("activity_logs")
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 40);

  if (input.storeId) query = query.eq("store_id", input.storeId);
  else if (input.storeIds?.length) query = query.in("store_id", input.storeIds);

  const { data, error } = await query;
  if (error) {
    logger.warn({ error }, "Could not load activity logs; run migration 008");
    return [];
  }
  return (data ?? []) as ActivityLog[];
}
