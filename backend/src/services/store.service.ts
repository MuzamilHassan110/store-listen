import { z } from "zod";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { canAccessAllStores, type OrgRole } from "../lib/rbac.js";
import { getSupabase } from "../lib/supabase.js";

export const storeBodySchema = z.object({
  name: z.string().min(1),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  manager_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
  opening_time: z.string().optional().nullable(),
  closing_time: z.string().optional().nullable(),
  timezone: z.string().optional(),
});

export type StoreStats = {
  total_conversations: number;
  active_salesmen: number;
  online_devices: number;
  average_score: number;
  total_recording_time: number;
  today_conversations: number;
};

export type StoreRecord = {
  id: string;
  organization_id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  manager_id?: string | null;
  is_active: boolean;
  opening_time?: string | null;
  closing_time?: string | null;
  timezone?: string | null;
  created_at?: string;
  stats?: StoreStats;
};

function startOfTodayIso(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function asStore(row: Record<string, unknown>, stats?: StoreStats): StoreRecord {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    name: String(row.name ?? "Store"),
    address: row.address ? String(row.address) : null,
    city: row.city ? String(row.city) : null,
    phone: row.phone ? String(row.phone) : null,
    manager_id: row.manager_id ? String(row.manager_id) : null,
    is_active: row.is_active !== false,
    opening_time: row.opening_time ? String(row.opening_time) : null,
    closing_time: row.closing_time ? String(row.closing_time) : null,
    timezone: row.timezone ? String(row.timezone) : "Asia/Karachi",
    created_at: row.created_at ? String(row.created_at) : undefined,
    stats,
  };
}

function emptyStats(): StoreStats {
  return {
    total_conversations: 0,
    active_salesmen: 0,
    online_devices: 0,
    average_score: 0,
    total_recording_time: 0,
    today_conversations: 0,
  };
}

export function filterStoresForRole(stores: StoreRecord[], role: OrgRole, storeIds: string[]): StoreRecord[] {
  if (canAccessAllStores(role)) return stores;
  if (storeIds.length === 0) return [];
  return stores.filter((store) => storeIds.includes(store.id));
}

export async function listStores(organizationId: string): Promise<StoreRecord[]> {
  const { data, error } = await getSupabase()
    .from("stores")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) {
    logger.error({ error }, "Failed to list stores");
    throw new HttpError(500, "Failed to load stores.", "STORE_LIST_FAILED");
  }
  return (data ?? []).map((row) => asStore(row as Record<string, unknown>));
}

export async function getOrganizationStores(
  organizationId: string,
  role: OrgRole,
  storeIds: string[],
): Promise<StoreRecord[]> {
  const stores = filterStoresForRole(await listStores(organizationId), role, storeIds);
  if (stores.length === 0) return [];

  const ids = stores.map((store) => store.id);
  const supabase = getSupabase();
  const today = startOfTodayIso();

  const [conversations, salesmen, devices] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, store_id, duration_seconds, recorded_at, conversation_analyses(overall_score)")
      .eq("organization_id", organizationId)
      .in("store_id", ids),
    supabase.from("salesmen").select("id, store_id").eq("organization_id", organizationId).in("store_id", ids),
    supabase.from("devices").select("id, store_id, is_online").eq("organization_id", organizationId).in("store_id", ids),
  ]);

  return stores.map((store) => {
    const stats = emptyStats();
    const convos = (conversations.data ?? []).filter((row) => String(row.store_id) === store.id);
    stats.total_conversations = convos.length;
    stats.total_recording_time = convos.reduce((sum, row) => sum + Number(row.duration_seconds ?? 0), 0);
    stats.today_conversations = convos.filter((row) => String(row.recorded_at ?? "") >= today).length;
    const scores = convos
      .flatMap((row) => {
        const analyses = Array.isArray(row.conversation_analyses) ? row.conversation_analyses : row.conversation_analyses ? [row.conversation_analyses] : [];
        return analyses.map((item) => Number((item as { overall_score?: number }).overall_score)).filter((value) => Number.isFinite(value));
      })
      .filter((value) => value > 0);
    stats.average_score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
    stats.active_salesmen = (salesmen.data ?? []).filter((row) => String(row.store_id) === store.id).length;
    stats.online_devices = (devices.data ?? []).filter((row) => String(row.store_id) === store.id && row.is_online).length;
    return { ...store, stats };
  });
}

export async function getStore(organizationId: string, storeId: string): Promise<StoreRecord> {
  const { data, error } = await getSupabase()
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Failed to load store.", "STORE_LOAD_FAILED");
  if (!data) throw new HttpError(404, "Store not found.", "NOT_FOUND");
  return asStore(data as Record<string, unknown>);
}

export async function createStore(organizationId: string, input: z.infer<typeof storeBodySchema>): Promise<StoreRecord> {
  const { data, error } = await getSupabase()
    .from("stores")
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      address: input.address ?? null,
      city: input.city ?? null,
      phone: input.phone ?? null,
      manager_id: input.manager_id ?? null,
      is_active: input.is_active ?? true,
      opening_time: input.opening_time ?? null,
      closing_time: input.closing_time ?? null,
      timezone: input.timezone ?? "Asia/Karachi",
    })
    .select()
    .single();
  if (error || !data) {
    logger.error({ error }, "Failed to create store");
    throw new HttpError(500, "Failed to create store. Run migration 008 if store columns are missing.", "STORE_CREATE_FAILED");
  }
  return asStore(data as Record<string, unknown>, emptyStats());
}

export async function updateStore(
  organizationId: string,
  storeId: string,
  input: Partial<z.infer<typeof storeBodySchema>>,
): Promise<StoreRecord> {
  await getStore(organizationId, storeId);
  const { data, error } = await getSupabase()
    .from("stores")
    .update({
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.manager_id !== undefined ? { manager_id: input.manager_id } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      ...(input.opening_time !== undefined ? { opening_time: input.opening_time } : {}),
      ...(input.closing_time !== undefined ? { closing_time: input.closing_time } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    })
    .eq("id", storeId)
    .eq("organization_id", organizationId)
    .select()
    .single();
  if (error || !data) throw new HttpError(500, "Failed to update store.", "STORE_UPDATE_FAILED");
  return asStore(data as Record<string, unknown>);
}

export async function deactivateStore(organizationId: string, storeId: string): Promise<StoreRecord> {
  return updateStore(organizationId, storeId, { is_active: false });
}

export async function getStoreOverview(organizationId: string, storeId: string) {
  const listed = await getOrganizationStores(organizationId, "owner", [storeId]);
  const store = listed.find((item) => item.id === storeId) ?? (await getStore(organizationId, storeId));
  const supabase = getSupabase();
  const today = startOfTodayIso();

  const [recent, salesmen, devices] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, recorded_at, duration_seconds, status, salesman_id, conversation_analyses(overall_score, sentiment, purchase_intent)")
      .eq("organization_id", organizationId)
      .eq("store_id", storeId)
      .order("recorded_at", { ascending: false })
      .limit(8),
    supabase.from("salesmen").select("id, name, store_id").eq("organization_id", organizationId).eq("store_id", storeId),
    supabase.from("devices").select("*").eq("organization_id", organizationId).eq("store_id", storeId),
  ]);

  const todayConversations = (recent.data ?? []).filter((row) => String(row.recorded_at ?? "") >= today).length;

  return {
    store,
    today_conversations: store.stats?.today_conversations ?? todayConversations,
    active_salesmen: salesmen.data ?? [],
    devices: devices.data ?? [],
    recent_conversations: recent.data ?? [],
    performance: {
      average_score: store.stats?.average_score ?? 0,
      total_conversations: store.stats?.total_conversations ?? 0,
      total_recording_time: store.stats?.total_recording_time ?? 0,
    },
  };
}

export async function compareStores(
  organizationId: string,
  storeIds: string[],
  dateRange?: { from?: string; to?: string },
) {
  if (storeIds.length < 2) {
    throw new HttpError(400, "Select at least two stores to compare.", "VALIDATION_ERROR");
  }
  const stores = await listStores(organizationId);
  const selected = stores.filter((store) => storeIds.includes(store.id));
  if (selected.length < 2) throw new HttpError(404, "One or more stores were not found.", "NOT_FOUND");

  let query = getSupabase()
    .from("conversations")
    .select("store_id, duration_seconds, recorded_at, conversation_analyses(overall_score, purchase_intent)")
    .eq("organization_id", organizationId)
    .in("store_id", storeIds);
  if (dateRange?.from) query = query.gte("recorded_at", dateRange.from);
  if (dateRange?.to) query = query.lte("recorded_at", dateRange.to);
  const { data: conversations } = await query;
  const { data: devices } = await getSupabase()
    .from("devices")
    .select("store_id, is_online")
    .eq("organization_id", organizationId)
    .in("store_id", storeIds);

  return selected.map((store) => {
    const convos = (conversations ?? []).filter((row) => String(row.store_id) === store.id);
    const scores = convos
      .flatMap((row) => {
        const analyses = Array.isArray(row.conversation_analyses) ? row.conversation_analyses : row.conversation_analyses ? [row.conversation_analyses] : [];
        return analyses.map((item) => Number((item as { overall_score?: number }).overall_score)).filter((value) => Number.isFinite(value) && value > 0);
      });
    const highIntent = convos.filter((row) => {
      const analyses = Array.isArray(row.conversation_analyses) ? row.conversation_analyses : row.conversation_analyses ? [row.conversation_analyses] : [];
      return analyses.some((item) => (item as { purchase_intent?: string }).purchase_intent === "high");
    }).length;
    return {
      id: store.id,
      name: store.name,
      city: store.city,
      total_conversations: convos.length,
      average_score: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
      average_duration: convos.length
        ? Math.round(convos.reduce((sum, row) => sum + Number(row.duration_seconds ?? 0), 0) / convos.length)
        : 0,
      high_intent: highIntent,
      online_devices: (devices ?? []).filter((row) => String(row.store_id) === store.id && row.is_online).length,
    };
  });
}

export async function assignUserToStore(input: {
  organizationId: string;
  storeId: string;
  userId: string;
  role: "manager" | "viewer";
}) {
  await getStore(input.organizationId, input.storeId);
  const { data, error } = await getSupabase()
    .from("store_assignments")
    .upsert(
      { store_id: input.storeId, user_id: input.userId, role: input.role },
      { onConflict: "store_id,user_id" },
    )
    .select()
    .single();
  if (error || !data) {
    logger.error({ error }, "Failed to assign user to store");
    throw new HttpError(500, "Failed to assign user. Run migration 008.", "STORE_ASSIGN_FAILED");
  }
  return data;
}

export async function removeStoreAssignment(storeId: string, userId: string): Promise<void> {
  const { error } = await getSupabase().from("store_assignments").delete().eq("store_id", storeId).eq("user_id", userId);
  if (error) throw new HttpError(500, "Failed to remove assignment.", "STORE_ASSIGN_FAILED");
}

export async function listStoreUsers(storeId: string) {
  const { data, error } = await getSupabase()
    .from("store_assignments")
    .select("id, role, user_id, created_at, profiles(full_name)")
    .eq("store_id", storeId);
  if (error) {
    logger.warn({ error }, "Failed to list store users");
    return [];
  }
  return data ?? [];
}
