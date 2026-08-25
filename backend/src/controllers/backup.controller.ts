import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { getBackupStatus, listBackups, restoreBackup, runOrganizationBackup } from "../services/backup.service.js";
import { writeAuditLog } from "../services/audit.service.js";
import { clientIp } from "../lib/sanitize.js";

export const runBackupHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const data = await runOrganizationBackup(req.auth.organizationId, "manual");
    await writeAuditLog({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      action: "backup_run",
      entityType: "report",
      entityId: data.id,
      ipAddress: clientIp(req),
    });
    sendSuccess(res, 200, "Backup completed.", data);
  } catch (err) {
    next(err);
  }
};

export const backupStatusHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    sendSuccess(res, 200, "Backup status loaded.", await getBackupStatus(req.auth.organizationId));
  } catch (err) {
    next(err);
  }
};

export const listBackupsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    sendSuccess(res, 200, "Backups loaded.", await listBackups(req.auth.organizationId));
  } catch (err) {
    next(err);
  }
};

export const restoreBackupHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const backupId = typeof req.body?.backup_id === "string" ? req.body.backup_id : "";
    if (!backupId) {
      sendError(res, 400, "backup_id is required.", "VALIDATION_ERROR");
      return;
    }
    const data = await restoreBackup(req.auth.organizationId, backupId);
    await writeAuditLog({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      action: "backup_restore",
      entityType: "report",
      entityId: backupId,
      ipAddress: clientIp(req),
    });
    sendSuccess(res, 200, "Backup restore applied for settings and rules.", data);
  } catch (err) {
    next(err);
  }
};
