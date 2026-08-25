import type { RequestHandler } from "express";
import { getSupabase } from "../lib/supabase.js";
import { sendError } from "../lib/api-response.js";
import { logger } from "../lib/logger.js";
import { assertStoreAccess, hasMinimumRole, normalizeRole, type OrgRole } from "../lib/rbac.js";

type AuthRequest = Parameters<RequestHandler>[0];

async function resolveMembership(
  userId: string,
  metadata: Record<string, unknown>,
): Promise<{ organizationId: string | null; role: OrgRole }> {
  const fromMeta = metadata.organization_id;
  const { data, error } = await getSupabase()
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ error }, "Failed to resolve organization membership");
  }

  const organizationId =
    data?.organization_id ??
    (typeof fromMeta === "string" && fromMeta.length > 0 ? fromMeta : null);
  const role = normalizeRole(
    data?.role ?? (typeof metadata.role === "string" ? metadata.role : null),
  );
  return { organizationId, role };
}

async function resolveStoreScope(input: {
  userId: string;
  organizationId: string;
  role: OrgRole;
}): Promise<{ storeIds: string[]; salesmanId: string | null }> {
  const supabase = getSupabase();
  let storeIds: string[] = [];
  let salesmanId: string | null = null;

  const salesman = await supabase
    .from("salesmen")
    .select("id, store_id")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .limit(1)
    .maybeSingle();
  if (salesman.data?.id) salesmanId = String(salesman.data.id);
  if (salesman.data?.store_id) storeIds.push(String(salesman.data.store_id));

  const assignments = await supabase
    .from("store_assignments")
    .select("store_id")
    .eq("user_id", input.userId);
  if (!assignments.error && assignments.data) {
    for (const row of assignments.data) {
      if (row.store_id) storeIds.push(String(row.store_id));
    }
  }

  return { storeIds: [...new Set(storeIds)], salesmanId };
}

export const requireAuth: RequestHandler = async (req: AuthRequest, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    return;
  }

  try {
    const { data, error } = await getSupabase().auth.getUser(token);
    if (error || !data.user) {
      sendError(res, 401, "Invalid or expired token.", "UNAUTHENTICATED");
      return;
    }

    const metadata = {
      ...((data.user.app_metadata ?? {}) as Record<string, unknown>),
      ...((data.user.user_metadata ?? {}) as Record<string, unknown>),
    };
    const membership = await resolveMembership(data.user.id, metadata);
    if (!membership.organizationId) {
      sendError(res, 403, "No organization is linked to this account.", "ORGANIZATION_REQUIRED");
      return;
    }

    const scope = await resolveStoreScope({
      userId: data.user.id,
      organizationId: membership.organizationId,
      role: membership.role,
    });

    req.auth = {
      userId: data.user.id,
      organizationId: membership.organizationId,
      email: data.user.email,
      role: membership.role,
      storeIds: scope.storeIds,
      salesmanId: scope.salesmanId,
    };
    next();
  } catch (err) {
    next(err);
  }
};

export function requireRole(...roles: OrgRole[]): RequestHandler {
  const needed = roles.length ? roles : (["owner"] as OrgRole[]);
  return (req, res, next) => {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    if (needed.some((role) => hasMinimumRole(req.auth!.role, role))) {
      next();
      return;
    }
    sendError(res, 403, "You do not have permission for this action.", "FORBIDDEN");
  };
}

export function requireStoreAccess(paramName = "id"): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const raw =
      (typeof req.params[paramName] === "string" ? req.params[paramName] : undefined) ??
      (typeof req.query.storeId === "string" ? req.query.storeId : undefined) ??
      (typeof req.body?.storeId === "string" ? req.body.storeId : undefined) ??
      (typeof req.body?.store_id === "string" ? req.body.store_id : undefined);
    if (!assertStoreAccess({ role: req.auth.role, storeIds: req.auth.storeIds, storeId: raw })) {
      sendError(res, 403, "You do not have access to this store.", "STORE_FORBIDDEN");
      return;
    }
    next();
  };
}

export function requireOrganizationAccess(organizationId: string, actorOrgId: string): boolean {
  return organizationId === actorOrgId;
}
