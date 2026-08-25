import type { RequestHandler } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { HttpError } from "../lib/http-error.js";
import {
  enqueueAndMaybeSend,
  listOutboundMessages,
  previewFollowUpMessage,
  sendFollowUpMessage,
} from "../services/communication.service.js";
import { TEMPLATE_CATALOG } from "../services/message-templates.js";
import {
  connectWhatsApp,
  getWhatsAppStatus,
  listWhatsAppTemplates,
  logoutWhatsApp,
} from "../services/whatsapp.service.js";

const sendSchema = z.object({
  to: z.string().min(5).optional(),
  phone: z.string().min(5).optional(),
  message: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  follow_up_id: z.string().uuid().optional(),
  channel: z.enum(["whatsapp", "sms"]).optional(),
});

export const whatsappStatusHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    sendSuccess(res, 200, "WhatsApp status loaded.", getWhatsAppStatus());
  } catch (err) {
    next(err);
  }
};

export const whatsappConnectHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const data = await connectWhatsApp();
    sendSuccess(res, 200, "WhatsApp connection started.", data);
  } catch (err) {
    next(err);
  }
};

export const whatsappLogoutHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const data = await logoutWhatsApp();
    sendSuccess(res, 200, "WhatsApp disconnected.", data);
  } catch (err) {
    next(err);
  }
};

export const whatsappTemplatesHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    sendSuccess(res, 200, "Templates loaded.", {
      templates: TEMPLATE_CATALOG,
      whatsapp: listWhatsAppTemplates(),
    });
  } catch (err) {
    next(err);
  }
};

export const whatsappHistoryHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const data = await listOutboundMessages(req.auth.organizationId);
    sendSuccess(res, 200, "Message history loaded.", data);
  } catch (err) {
    next(err);
  }
};

export const whatsappSendHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = sendSchema.parse(req.body);
    if (body.follow_up_id) {
      const data = await sendFollowUpMessage(req.auth.organizationId, body.follow_up_id, {
        channel: body.channel ?? "whatsapp",
        text: body.message ?? body.text,
      });
      sendSuccess(res, 200, "Message processed.", data);
      return;
    }
    const phone = body.to ?? body.phone;
    const text = body.message ?? body.text;
    if (!phone || !text) {
      throw new HttpError(400, "Phone and message are required.", "VALIDATION_ERROR");
    }
    const data = await enqueueAndMaybeSend({
      organizationId: req.auth.organizationId,
      phone,
      text,
      channel: body.channel ?? "whatsapp",
      skipQuietHours: true,
    });
    sendSuccess(res, 200, "Message processed.", data);
  } catch (err) {
    next(err);
  }
};

export const whatsappPreviewHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const followUpId = typeof req.query.follow_up_id === "string" ? req.query.follow_up_id : "";
    if (!followUpId) {
      sendError(res, 400, "follow_up_id is required.", "VALIDATION_ERROR");
      return;
    }
    const channel = req.query.channel === "sms" ? "sms" : "whatsapp";
    const data = await previewFollowUpMessage(req.auth.organizationId, followUpId, channel);
    sendSuccess(res, 200, "Preview ready.", data);
  } catch (err) {
    next(err);
  }
};
