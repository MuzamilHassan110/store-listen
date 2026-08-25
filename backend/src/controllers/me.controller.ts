import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { canAccessAllStores, canManageSalesmen, canManageStores, canViewStoreSwitcher } from "../lib/rbac.js";

export const getMeHandler: RequestHandler = (req, res) => {
  if (!req.auth) {
    sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    return;
  }
  sendSuccess(res, 200, "Session loaded.", {
    userId: req.auth.userId,
    organizationId: req.auth.organizationId,
    email: req.auth.email,
    role: req.auth.role,
    storeIds: req.auth.storeIds,
    salesmanId: req.auth.salesmanId,
    permissions: {
      allStores: canAccessAllStores(req.auth.role),
      manageStores: canManageStores(req.auth.role),
      manageSalesmen: canManageSalesmen(req.auth.role),
      storeSwitcher: canViewStoreSwitcher(req.auth.role),
    },
  });
};
