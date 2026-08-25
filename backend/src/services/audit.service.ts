import { getSupabase } from "../lib/supabase.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { toCsv } from "../lib/csv.js";

export type AuditLog = {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AuditFilters = {
  userId?: string;
  action?: string;
  entityType?: string;
  search?: string;
  from?: string;
  to?: string;
};

function mapLog(row: Record<string, unknown>): AuditLog {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    user_id: row.user_id ? String(row.user_id) : null,
    action: String(row.action),
    entity_type: row.entity_type ? String(row.entity_type) : null,
    entity_id: row.entity_id ? String(row.entity_id) : null,
    ip_address: row.ip_address ? String(row.ip_address) : null,
    user_agent: row.user_agent ? String(row.user_agent) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function writeAuditLog(input: {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await getSupabase().from("audit_logs").insert({
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) logger.warn({ error, action: input.action }, "Failed to write audit log");
}

export async function listAuditLogs(
  organizationId: string,
  filters: AuditFilters = {},
): Promise<AuditLog[]> {
  let query = getSupabase()
    .from("audit_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.action) query = query.ilike("action", `%${filters.action}%`);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);
  if (filters.search) query = query.or(`action.ilike.%${filters.search}%,entity_type.ilike.%${filters.search}%`);
  const { data, error } = await query;
  if (error) throw new HttpError(500, "Failed to load audit logs.", "AUDIT_LOAD_FAILED");
  return (data ?? []).map((row) => mapLog(row as Record<string, unknown>));
}

export async function getAuditLog(organizationId: string, id: string): Promise<AuditLog> {
  const { data, error } = await getSupabase()
    .from("audit_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new HttpError(500, "Failed to load audit log.", "AUDIT_LOAD_FAILED");
  if (!data) throw new HttpError(404, "Audit log not found.", "NOT_FOUND");
  return mapLog(data as Record<string, unknown>);
}

export async function exportAuditLogsCsv(organizationId: string, filters: AuditFilters = {}) {
  const rows = await listAuditLogs(organizationId, filters);
  return {
    filename: `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: toCsv(
      ["created_at", "action", "entity_type", "entity_id", "user_id", "ip_address"],
      rows.map((row) => [
        row.created_at,
        row.action,
        row.entity_type ?? "",
        row.entity_id ?? "",
        row.user_id ?? "",
        row.ip_address ?? "",
      ]),
    ),
  };
}
