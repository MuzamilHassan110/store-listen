import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import {
  generateConversationReport,
  generateDailyReport,
  generateMonthlyReport,
  generateSalesmanReport,
  generateStoreReport,
  generateWeeklyReport,
  listReports,
} from "../services/report.service.js";
import { listSchedules, upsertSchedule } from "../services/scheduler.service.js";

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function dateRange(req: { query: Record<string, unknown> }) {
  const start = typeof req.query.start_date === "string" ? req.query.start_date : new Date().toISOString().slice(0, 10);
  const end = typeof req.query.end_date === "string" ? req.query.end_date : new Date().toISOString().slice(0, 10);
  return { start, end };
}

export const listReportsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    sendSuccess(res, 200, "Reports loaded.", await listReports(req.auth.organizationId));
  } catch (err) {
    next(err);
  }
};

export const conversationReportHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    const id = routeId(req.params.id);
    if (!id) return void sendError(res, 400, "Conversation id is required.", "VALIDATION_ERROR");
    sendSuccess(res, 200, "Conversation report ready.", await generateConversationReport(req.auth.organizationId, id));
  } catch (err) {
    next(err);
  }
};

export const salesmanReportHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    const id = routeId(req.params.id);
    if (!id) return void sendError(res, 400, "Salesman id is required.", "VALIDATION_ERROR");
    sendSuccess(
      res,
      200,
      "Salesman report ready.",
      await generateSalesmanReport(req.auth.organizationId, id, dateRange(req)),
    );
  } catch (err) {
    next(err);
  }
};

export const storeReportHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    const period = typeof req.query.period === "string" ? req.query.period : "store";
    const organizationId = req.auth.organizationId;
    const report =
      period === "daily"
        ? await generateDailyReport(organizationId)
        : period === "weekly"
          ? await generateWeeklyReport(organizationId)
          : period === "monthly"
            ? await generateMonthlyReport(organizationId)
            : await generateStoreReport(organizationId, dateRange(req));
    sendSuccess(res, 200, "Store report ready.", report);
  } catch (err) {
    next(err);
  }
};

export const listSchedulesHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    sendSuccess(res, 200, "Schedules loaded.", await listSchedules(req.auth.organizationId));
  } catch (err) {
    next(err);
  }
};

export const upsertScheduleHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    const body = req.body as { id?: string; report_type?: string; recipient_email?: string; is_active?: boolean };
    if (!body.report_type) return void sendError(res, 400, "report_type is required.", "VALIDATION_ERROR");
    sendSuccess(
      res,
      200,
      "Schedule saved.",
      await upsertSchedule(req.auth.organizationId, {
        id: body.id,
        report_type: body.report_type,
        recipient_email: body.recipient_email,
        is_active: body.is_active,
      }),
    );
  } catch (err) {
    next(err);
  }
};
