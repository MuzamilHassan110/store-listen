import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { exportAuditLogsCsv, getAuditLog, listAuditLogs } from "../services/audit.service.js";

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export const listAuditLogsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const data = await listAuditLogs(req.auth.organizationId, {
      userId: typeof req.query.user_id === "string" ? req.query.user_id : undefined,
      action: typeof req.query.action === "string" ? req.query.action : undefined,
      entityType: typeof req.query.entity_type === "string" ? req.query.entity_type : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
    });
    sendSuccess(res, 200, "Audit logs loaded.", data);
  } catch (err) {
    next(err);
  }
};

export const getAuditLogHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Audit log id is required.", "VALIDATION_ERROR");
      return;
    }
    sendSuccess(res, 200, "Audit log loaded.", await getAuditLog(req.auth.organizationId, id));
  } catch (err) {
    next(err);
  }
};

export const exportAuditLogsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    sendSuccess(
      res,
      200,
      "Audit export ready.",
      await exportAuditLogsCsv(req.auth.organizationId, {
        action: typeof req.query.action === "string" ? req.query.action : undefined,
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
      }),
    );
  } catch (err) {
    next(err);
  }
};
