import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import {
  exportConversationsToCSV,
  exportCustomersToCSV,
  exportFollowUpsToCSV,
  exportSalesmenToCSV,
} from "../services/export.service.js";

export const exportConversationsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    const file = await exportConversationsToCSV(req.auth.organizationId, {
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      salesmanId: typeof req.query.salesman_id === "string" ? req.query.salesman_id : undefined,
    });
    sendSuccess(res, 200, "Conversations exported.", file);
  } catch (err) {
    next(err);
  }
};

export const exportSalesmenHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    sendSuccess(res, 200, "Salesmen exported.", await exportSalesmenToCSV(req.auth.organizationId));
  } catch (err) {
    next(err);
  }
};

export const exportFollowUpsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    sendSuccess(res, 200, "Follow-ups exported.", await exportFollowUpsToCSV(req.auth.organizationId));
  } catch (err) {
    next(err);
  }
};

export const exportCustomersHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) return void sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    sendSuccess(res, 200, "Customers exported.", await exportCustomersToCSV(req.auth.organizationId));
  } catch (err) {
    next(err);
  }
};
