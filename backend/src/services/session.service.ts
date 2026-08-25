import { getSupabase } from "../lib/supabase.js";
import { HttpError } from "../lib/http-error.js";

export type AuthSession = {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_active: string;
  is_current: boolean;
};

export async function startSession(input: {
  userId: string;
  organizationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<AuthSession> {
  const { data, error } = await getSupabase()
    .from("auth_sessions")
    .insert({
      user_id: input.userId,
      organization_id: input.organizationId ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new HttpError(500, "Failed to start session.", "SESSION_CREATE_FAILED");
  return mapSession(data as Record<string, unknown>, String(data.id));
}

export async function listSessions(userId: string, currentId?: string | null): Promise<AuthSession[]> {
  const { data, error } = await getSupabase()
    .from("auth_sessions")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("last_active", { ascending: false });
  if (error) throw new HttpError(500, "Failed to load sessions.", "SESSION_LOAD_FAILED");
  return (data ?? []).map((row) => mapSession(row as Record<string, unknown>, currentId));
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("auth_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) throw new HttpError(500, "Failed to revoke session.", "SESSION_REVOKE_FAILED");
}

export async function revokeAllSessions(userId: string, exceptId?: string | null): Promise<number> {
  let query = getSupabase()
    .from("auth_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (exceptId) query = query.neq("id", exceptId);
  const { data, error } = await query.select("id");
  if (error) throw new HttpError(500, "Failed to revoke sessions.", "SESSION_REVOKE_FAILED");
  return data?.length ?? 0;
}

function mapSession(row: Record<string, unknown>, currentId?: string | null): AuthSession {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    ip_address: row.ip_address ? String(row.ip_address) : null,
    user_agent: row.user_agent ? String(row.user_agent) : null,
    created_at: String(row.created_at),
    last_active: String(row.last_active ?? row.created_at),
    is_current: currentId ? String(row.id) === currentId : false,
  };
}
