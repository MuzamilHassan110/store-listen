import type { RequestHandler } from "express";
import { getSupabase } from "../lib/supabase.js";
import { sendError } from "../lib/api-response.js";
import { logger } from "../lib/logger.js";

type AuthRequest = Parameters<RequestHandler>[0];

async function resolveOrganizationId(userId: string, metadata: Record<string, unknown>): Promise<string | null> {
  const fromMeta = metadata.organization_id;
  if (typeof fromMeta === "string" && fromMeta.length > 0) {
    return fromMeta;
  }

  const { data, error } = await getSupabase()
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ error }, "Failed to resolve organization membership");
    return null;
  }

  return data?.organization_id ?? null;
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

    const organizationId = await resolveOrganizationId(data.user.id, {
      ...((data.user.app_metadata ?? {}) as Record<string, unknown>),
      ...((data.user.user_metadata ?? {}) as Record<string, unknown>),
    });

    if (!organizationId) {
      sendError(res, 403, "No organization is linked to this account.", "ORGANIZATION_REQUIRED");
      return;
    }

    req.auth = {
      userId: data.user.id,
      organizationId,
      email: data.user.email,
    };
    next();
  } catch (err) {
    next(err);
  }
};
