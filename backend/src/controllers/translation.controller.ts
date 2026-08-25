import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { isSupportedLanguage, normalizeLanguage } from "../services/language.js";
import { translateConversation } from "../services/translation.service.js";

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export const translateConversationHandler: RequestHandler = async (req, res, next) => {
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

    const language = normalizeLanguage(typeof req.query.language === "string" ? req.query.language : "en");
    if (!isSupportedLanguage(language)) {
      sendError(res, 400, "Unsupported language.", "UNSUPPORTED_LANGUAGE");
      return;
    }

    const translation = await translateConversation(id, req.auth.organizationId, language);
    sendSuccess(res, 200, "Translation ready.", translation);
  } catch (err) {
    next(err);
  }
};
