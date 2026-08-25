import { Router } from "express";
import { exportAuditLogsHandler, getAuditLogHandler, listAuditLogsHandler } from "../controllers/audit.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { exportRateLimit } from "../middleware/rate-limit.js";

export const auditRouter = Router();

auditRouter.get("/", requireAuth, requireRole("manager"), listAuditLogsHandler);
auditRouter.get("/export", requireAuth, requireRole("manager"), exportRateLimit, exportAuditLogsHandler);
auditRouter.get("/:id", requireAuth, requireRole("manager"), getAuditLogHandler);
