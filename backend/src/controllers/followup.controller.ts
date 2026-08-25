import type { RequestHandler } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../lib/api-response.js";
import {
  cancelFollowUp,
  completeFollowUp,
  createFollowUp,
  listDueToday,
  listFollowUps,
  snoozeFollowUp,
  suggestFollowUpMessage,
  updateFollowUp,
} from "../services/followup.service.js";
import { detectLeads } from "../services/lead.service.js";
import { notifyDueFollowUps } from "../services/notification.service.js";

const createSchema = z.object({
  conversation_id: z.string().uuid(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  product_interest: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  follow_up_date: z.string().optional(),
  notes: z.string().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
});

const updateSchema = z.object({
  status: z.enum(["pending", "completed", "cancelled", "snoozed"]).optional(),
  follow_up_date: z.string().optional(),
  notes: z.string().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  product_interest: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
});

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export const listFollowUpsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const data = await listFollowUps(req.auth.organizationId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      priority: typeof req.query.priority === "string" ? req.query.priority : undefined,
      assignedTo: typeof req.query.assigned_to === "string" ? req.query.assigned_to : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
    });
    sendSuccess(res, 200, "Follow-ups loaded.", data);
  } catch (err) {
    next(err);
  }
};

export const listDueTodayHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    await notifyDueFollowUps(req.auth.organizationId);
    const data = await listDueToday(req.auth.organizationId);
    sendSuccess(res, 200, "Due follow-ups loaded.", data);
  } catch (err) {
    next(err);
  }
};

export const createFollowUpHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = createSchema.parse(req.body);
    const data = await createFollowUp(req.auth.organizationId, body);
    sendSuccess(res, 201, "Follow-up created.", data);
  } catch (err) {
    next(err);
  }
};

export const updateFollowUpHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Follow-up id is required.", "VALIDATION_ERROR");
      return;
    }
    const body = updateSchema.parse(req.body);
    const data = await updateFollowUp(req.auth.organizationId, id, body);
    sendSuccess(res, 200, "Follow-up updated.", data);
  } catch (err) {
    next(err);
  }
};

export const deleteFollowUpHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Follow-up id is required.", "VALIDATION_ERROR");
      return;
    }
    const data = await cancelFollowUp(req.auth.organizationId, id);
    sendSuccess(res, 200, "Follow-up cancelled.", data);
  } catch (err) {
    next(err);
  }
};

export const completeFollowUpHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Follow-up id is required.", "VALIDATION_ERROR");
      return;
    }
    const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
    const data = await completeFollowUp(req.auth.organizationId, id, notes);
    sendSuccess(res, 200, "Follow-up completed.", data);
  } catch (err) {
    next(err);
  }
};

export const snoozeFollowUpHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Follow-up id is required.", "VALIDATION_ERROR");
      return;
    }
    const date = typeof req.body?.follow_up_date === "string" ? req.body.follow_up_date : "";
    if (!date) {
      sendError(res, 400, "follow_up_date is required.", "VALIDATION_ERROR");
      return;
    }
    const data = await snoozeFollowUp(req.auth.organizationId, id, date);
    sendSuccess(res, 200, "Follow-up snoozed.", data);
  } catch (err) {
    next(err);
  }
};

export const suggestMessageHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Follow-up id is required.", "VALIDATION_ERROR");
      return;
    }
    const data = await suggestFollowUpMessage(req.auth.organizationId, id);
    sendSuccess(res, 200, "Suggested message ready.", data);
  } catch (err) {
    next(err);
  }
};

export const detectLeadHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Conversation id is required.", "VALIDATION_ERROR");
      return;
    }
    const data = await detectLeads(id, req.auth.userId);
    sendSuccess(res, 200, data ? "Lead created." : "No lead detected.", data);
  } catch (err) {
    next(err);
  }
};
