import type { RequestHandler } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { env } from "../config/env.js";
import { isAllowedAudioBuffer } from "../lib/file-magic.js";
import { getSupabase } from "../lib/supabase.js";
import { enqueueAndWait } from "../services/analysis-queue.js";
import { processStreamChunk } from "../services/live-stream.service.js";
import {
  getConversationBundle,
  loadAudioForConversation,
  scoreExistingConversation,
  startConversation,
} from "../services/conversation.service.js";
import { getConversationRuleResults } from "../services/rules.service.js";

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

const startConversationSchema = z.object({
  salesmanId: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return null;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        ? value
        : null;
    }),
  storeId: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return null;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        ? value
        : null;
    }),
  language: z.string().optional().default("en"),
});

export const startConversationHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }

    const body = startConversationSchema.parse(req.body ?? {});
    const result = await startConversation(req.auth.organizationId, {
      salesmanId: body.salesmanId,
      storeId: body.storeId,
      language: body.language,
    });

    sendSuccess(res, 201, "Conversation started.", result);
  } catch (err) {
    next(err);
  }
};

export const streamChunkHandler: RequestHandler = async (req, res, next) => {
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

    if (!req.file) {
      sendError(res, 400, "Audio chunk file is required.", "AUDIO_REQUIRED");
      return;
    }
    if (!isAllowedAudioBuffer(req.file.buffer)) {
      sendError(res, 415, "Audio contents do not match a supported format.", "UNSUPPORTED_MEDIA_TYPE");
      return;
    }

    const { data: conversation, error } = await getSupabase()
      .from("conversations")
      .select("id")
      .eq("id", id)
      .eq("organization_id", req.auth.organizationId)
      .maybeSingle();

    if (error || !conversation) {
      sendError(res, 404, "Conversation not found.", "NOT_FOUND");
      return;
    }

    const bodyTranscript = typeof req.body?.transcriptContext === "string"
      ? req.body.transcriptContext
      : (typeof req.body?.transcript === "string" ? req.body.transcript : "");

    const result = await processStreamChunk({
      conversationId: id,
      audioBuffer: req.file.buffer,
      mimeType: req.file.mimetype || "audio/webm",
      transcriptContext: bodyTranscript,
    });

    sendSuccess(res, 200, "Chunk processed.", result);
  } catch (err) {
    next(err);
  }
};

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
