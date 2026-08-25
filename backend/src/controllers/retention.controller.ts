import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { cleanupOldRecordings, getRetentionStatus, updateRetentionDays } from "../services/retention.service.js";

export const retentionStatusHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    sendSuccess(res, 200, "Retention status loaded.", await getRetentionStatus(req.auth.organizationId));
  } catch (err) {
    next(err);
  }
};

export const retentionCleanupHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    const days = typeof req.body?.days === "number" ? req.body.days : undefined;
    sendSuccess(res, 200, "Cleanup complete.", await cleanupOldRecordings(req.auth.organizationId, days));
  } catch (err) {
    next(err);
  }
};

export const retentionSettingsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    const days = Number(req.body?.retention_days ?? 90);
    sendSuccess(res, 200, "Retention settings saved.", {
      retention_days: await updateRetentionDays(req.auth.organizationId, days),
    });
  } catch (err) {
    next(err);
  }
};
