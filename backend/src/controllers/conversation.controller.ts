import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { env } from "../config/env.js";
import { enqueueAndWait } from "../services/analysis-queue.js";
import {
  getConversationBundle,
  loadAudioForConversation,
  scoreExistingConversation,
} from "../services/conversation.service.js";
import { getConversationRuleResults } from "../services/rules.service.js";

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export const getConversationAnalysisHandler: RequestHandler = async (req, res, next) => {
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

    const bundle = await getConversationBundle(id, req.auth.organizationId);
    if (!bundle) {
      sendError(res, 404, "Conversation not found.", "NOT_FOUND");
      return;
    }

    sendSuccess(res, 200, "Conversation loaded.", bundle);
  } catch (err) {
    next(err);
  }
};

export const retryConversationAnalysisHandler: RequestHandler = async (req, res, next) => {
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

    const bundle = await getConversationBundle(id, req.auth.organizationId);
    if (!bundle) {
      sendError(res, 404, "Conversation not found.", "NOT_FOUND");
      return;
    }

    const status = String(bundle.conversation.status ?? "");
    if (status === "processing" || status === "queued") {
      sendError(res, 409, "This conversation is already being analyzed.", "ANALYSIS_IN_PROGRESS");
      return;
    }

    const liveTranscript = String(bundle.transcript?.original_text ?? bundle.transcript?.text ?? "");
    const result = await enqueueAndWait(
      {
        conversationId: id,
        liveTranscript,
        hintLanguage: String(bundle.conversation.language ?? bundle.transcript?.language ?? ""),
        mimeType: "audio/webm",
        loadAudio: () =>
          loadAudioForConversation({
            id: String(bundle.conversation.id),
            organization_id: String(bundle.conversation.organization_id),
            store_id: bundle.conversation.store_id ? String(bundle.conversation.store_id) : null,
            recording_path: bundle.conversation.recording_path
              ? String(bundle.conversation.recording_path)
              : null,
            recorded_at: bundle.conversation.recorded_at ? String(bundle.conversation.recorded_at) : null,
            created_at: bundle.conversation.created_at ? String(bundle.conversation.created_at) : null,
          }),
      },
      env.GEMINI_TIMEOUT_MS + 5_000,
    );

    if (result.ok && result.bundle) {
      sendSuccess(res, 200, "Conversation analyzed.", result.bundle);
      return;
    }

    sendError(
      res,
      result.timedOut ? 202 : 502,
      result.error?.message ?? "Analysis failed.",
      result.error?.code ?? "GEMINI_FAILED",
    );
  } catch (err) {
    next(err);
  }
};

export const getConversationRulesHandler: RequestHandler = async (req, res, next) => {
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
    const results = await getConversationRuleResults(id, req.auth.organizationId);
    sendSuccess(res, 200, "Rule results loaded.", results);
  } catch (err) {
    next(err);
  }
};

export const scoreConversationHandler: RequestHandler = async (req, res, next) => {
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
    const bundle = await scoreExistingConversation(id, req.auth.organizationId);
    sendSuccess(res, 200, "Conversation scored.", bundle);
  } catch (err) {
    next(err);
  }
};
