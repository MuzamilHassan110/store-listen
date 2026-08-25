import type { RequestHandler } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { HttpError } from "../lib/http-error.js";
import { enqueueAndMaybeSend, refreshSmsDelivery } from "../services/communication.service.js";
import { isSmsConfigured } from "../services/sms.service.js";

const sendSchema = z.object({
  to: z.string().min(5),
  message: z.string().min(1),
  follow_up_id: z.string().uuid().optional(),
});

export const smsSendHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    if (!isSmsConfigured()) {
      throw new HttpError(400, "Twilio is not configured on this server.", "SMS_NOT_CONFIGURED");
    }
    const body = sendSchema.parse(req.body);
    const data = await enqueueAndMaybeSend({
      organizationId: req.auth.organizationId,
      phone: body.to,
      text: body.message,
      channel: "sms",
      followUpId: body.follow_up_id,
      skipQuietHours: true,
    });
    sendSuccess(res, 200, "SMS processed.", data);
  } catch (err) {
    next(err);
  }
};

export const smsStatusHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = typeof req.params.messageId === "string" ? req.params.messageId : req.params.messageId?.[0];
    if (!id) {
      sendError(res, 400, "messageId is required.", "VALIDATION_ERROR");
      return;
    }
    const data = await refreshSmsDelivery(req.auth.organizationId, id);
    sendSuccess(res, 200, "SMS status loaded.", data);
  } catch (err) {
    next(err);
  }
};
