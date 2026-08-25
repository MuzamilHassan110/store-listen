import { z } from "zod";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import { logActivity } from "./activity.service.js";

export const registerDeviceSchema = z.object({
  device_id: z.string().min(1),
  device_name: z.string().optional(),
  store_id: z.string().uuid().optional().nullable(),
  app_version: z.string().optional(),
  os_version: z.string().optional(),
  storage_used_bytes: z.coerce.number().int().nonnegative().optional(),
});

export const updateDeviceSchema = z.object({
  device_name: z.string().optional(),
  store_id: z.string().uuid().optional().nullable(),
  app_version: z.string().optional(),
  os_version: z.string().optional(),
  is_online: z.boolean().optional(),
  storage_used_bytes: z.coerce.number().int().nonnegative().optional(),
});

export async function listDevices(organizationId: string, storeId?: string | null) {
  let query = getSupabase()
    .from("devices")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (storeId) query = query.eq("store_id", storeId);
  const { data, error } = await query;
  if (error) {
    logger.warn({ error }, "Failed to list devices; run migration 008");
    return [];
  }
  return data ?? [];
}

export async function findDeviceByHardwareId(organizationId: string, deviceId: string) {
  const { data } = await getSupabase()
    .from("devices")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("device_id", deviceId)
    .maybeSingle();
  return data;
}

export async function registerDevice(
  organizationId: string,
  input: z.infer<typeof registerDeviceSchema>,
  userId?: string,
) {
  const existing = await findDeviceByHardwareId(organizationId, input.device_id);
  const payload = {
    organization_id: organizationId,
    store_id: input.store_id ?? existing?.store_id ?? null,
    device_name: input.device_name ?? existing?.device_name ?? "StoreListen device",
    device_id: input.device_id,
    app_version: input.app_version ?? existing?.app_version ?? null,
    os_version: input.os_version ?? existing?.os_version ?? null,
    storage_used_bytes: input.storage_used_bytes ?? existing?.storage_used_bytes ?? 0,
    is_online: true,
    last_sync_at: new Date().toISOString(),
  };

  const query = existing
    ? getSupabase().from("devices").update(payload).eq("id", existing.id).select().single()
    : getSupabase().from("devices").insert(payload).select().single();
  const { data, error } = await query;
  if (error || !data) {
    logger.error({ error }, "Failed to register device");
    throw new HttpError(500, "Failed to register device. Run migration 008.", "DEVICE_REGISTER_FAILED");
  }
  await logActivity({
    organizationId,
    storeId: data.store_id ? String(data.store_id) : null,
    userId,
    activityType: "device_registered",
    description: `${data.device_name || "Device"} registered`,
    metadata: { device_id: data.device_id, id: data.id },
  });
  return data;
}

export async function updateDevice(
  organizationId: string,
  id: string,
  input: z.infer<typeof updateDeviceSchema>,
) {
  const { data, error } = await getSupabase()
    .from("devices")
    .update(input)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .maybeSingle();
  if (error) throw new HttpError(500, "Failed to update device.", "DEVICE_UPDATE_FAILED");
  if (!data) throw new HttpError(404, "Device not found.", "NOT_FOUND");
  return data;
}

export async function getDevice(organizationId: string, id: string) {
  const { data, error } = await getSupabase()
    .from("devices")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Failed to load device.", "DEVICE_LOAD_FAILED");
  if (!data) throw new HttpError(404, "Device not found.", "NOT_FOUND");
  return data;
}

export function deviceIsOnline(row: { is_online?: boolean; last_sync_at?: string | null }): boolean {
  if (!row.last_sync_at) return Boolean(row.is_online);
  const age = Date.now() - Date.parse(row.last_sync_at);
  return Boolean(row.is_online) && Number.isFinite(age) && age < 5 * 60 * 1000;
}

export async function getDeviceStatus(organizationId: string, id: string) {
  const device = await getDevice(organizationId, id);
  const online = deviceIsOnline(device);
  return {
    ...device,
    is_online: online,
    stale: !online,
  };
}

export async function syncDevice(organizationId: string, id: string, userId?: string) {
  const now = new Date().toISOString();
  const data = await updateDevice(organizationId, id, { is_online: true });
  const { data: synced } = await getSupabase()
    .from("devices")
    .update({ last_sync_at: now, is_online: true })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();
  await logActivity({
    organizationId,
    storeId: data.store_id ? String(data.store_id) : null,
    userId,
    activityType: "device_sync",
    description: `${data.device_name || "Device"} sync requested`,
    metadata: { device_id: data.device_id, id },
  });
  return synced ?? { ...data, last_sync_at: now, is_online: true };
}
