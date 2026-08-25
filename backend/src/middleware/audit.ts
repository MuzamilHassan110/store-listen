import type { RequestHandler } from "express";
import { writeAuditLog } from "../services/audit.service.js";
import { clientIp, sanitizeText } from "../lib/sanitize.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function classify(path: string): { action: string; entityType: string | null } {
  if (path.includes("/auth")) return { action: "auth", entityType: "user" };
  if (path.includes("/export")) return { action: "export", entityType: "report" };
  if (path.includes("/backup")) return { action: "backup", entityType: "report" };
  if (path.includes("/settings") || path.includes("/retention") || path.includes("/communication")) {
    return { action: "settings_change", entityType: "user" };
  }
  if (path.includes("/customers")) return { action: "customer_write", entityType: "customer" };
  if (path.includes("/rules")) return { action: "rule_write", entityType: "rule" };
  if (path.includes("/reports")) return { action: "report_write", entityType: "report" };
  if (path.includes("/followups")) return { action: "followup_write", entityType: "conversation" };
  if (path.includes("/recordings")) return { action: "recording_write", entityType: "conversation" };
  return { action: "write", entityType: null };
}

export const auditMutations: RequestHandler = (req, res, next) => {
  if (!WRITE_METHODS.has(req.method) || req.path === "/health") {
    next();
    return;
  }
  res.on("finish", () => {
    if (!req.auth || res.statusCode >= 500) return;
    const { action, entityType } = classify(req.originalUrl);
    void writeAuditLog({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      action: `${req.method} ${action}`,
      entityType,
      ipAddress: clientIp(req),
      userAgent: typeof req.headers["user-agent"] === "string" ? sanitizeText(req.headers["user-agent"], 300) : null,
      metadata: { path: req.originalUrl, status: res.statusCode },
    });
  });
  next();
};
