import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { canAccessAllStores } from "../lib/rbac.js";
import { listActivity } from "../services/activity.service.js";

export const listActivityHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const storeId = typeof req.query.storeId === "string" ? req.query.storeId : null;
    const logs = await listActivity({
      organizationId: req.auth.organizationId,
      storeId,
      storeIds: canAccessAllStores(req.auth.role) ? undefined : req.auth.storeIds,
      limit: Number(req.query.limit ?? 40) || 40,
    });
    sendSuccess(res, 200, "Activity loaded.", logs);
  } catch (err) {
    next(err);
  }
};
