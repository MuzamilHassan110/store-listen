import type { RequestHandler } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../lib/api-response.js";
import {
  getCommunicationSettings,
  updateCommunicationSettings,
} from "../services/communication.service.js";

const settingsSchema = z.object({
  whatsapp_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  quiet_hours_start: z.number().int().min(0).max(23).optional(),
  quiet_hours_end: z.number().int().min(0).max(23).optional(),
  timezone: z.string().optional(),
  manager_whatsapp: z.string().nullable().optional(),
  manager_sms: z.string().nullable().optional(),
  follow_up_template: z.string().nullable().optional(),
  daily_report_template: z.string().nullable().optional(),
  high_intent_template: z.string().nullable().optional(),
});

export const getCommunicationSettingsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const data = await getCommunicationSettings(req.auth.organizationId);
    sendSuccess(res, 200, "Communication settings loaded.", data);
  } catch (err) {
    next(err);
  }
};

export const updateCommunicationSettingsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = settingsSchema.parse(req.body);
    const data = await updateCommunicationSettings(req.auth.organizationId, body);
    sendSuccess(res, 200, "Communication settings saved.", data);
  } catch (err) {
    next(err);
  }
};
