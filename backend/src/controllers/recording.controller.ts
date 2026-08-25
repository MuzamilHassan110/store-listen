import type { RequestHandler } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { createRecording, recordingBodySchema } from "../services/recording.service.js";
import { getConversationBundle } from "../services/conversation.service.js";
import { enqueueAndWait } from "../services/analysis-queue.js";
import { env } from "../config/env.js";
import { isAllowedAudioBuffer } from "../lib/file-magic.js";

const batchManifestSchema = z.array(recordingBodySchema);

async function saveAndAnalyze(input: {
  organizationId: string;
  body: z.infer<typeof recordingBodySchema>;
  file: Express.Multer.File;
}) {
  const saved = await createRecording(input);
  if (saved.duplicate) {
    const bundle = await getConversationBundle(saved.id, input.organizationId);
    return {
      saved,
      duplicate: true,
      analysisResult: bundle
        ? { ok: true as const, bundle }
        : { ok: false as const, error: { message: "Duplicate recording found.", code: "DUPLICATE_RECORDING" } },
    };
  }

  const liveTranscript = saved.transcript?.text ?? input.body.transcript ?? "";
  const analysisResult = await enqueueAndWait(
    {
      conversationId: saved.id,
      liveTranscript,
      buffer: input.file.buffer,
      mimeType: input.file.mimetype || "audio/webm",
      hintLanguage: input.body.language,
    },
    env.GEMINI_TIMEOUT_MS + 5_000,
  );
  return { saved, duplicate: false, analysisResult };
}

export const createRecordingHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }

    if (!req.file) {
      sendError(res, 400, "Audio file is required.", "AUDIO_REQUIRED");
      return;
    }
    if (!isAllowedAudioBuffer(req.file.buffer)) {
      sendError(res, 415, "Audio contents do not match a supported format.", "UNSUPPORTED_MEDIA_TYPE");
      return;
    }

    const body = recordingBodySchema.parse(req.body);
    const { saved, duplicate, analysisResult } = await saveAndAnalyze({
      organizationId: req.auth.organizationId,
      body,
      file: req.file,
    });

    if (analysisResult.ok && analysisResult.bundle) {
      sendSuccess(res, 201, duplicate ? "Recording already exists." : "Recording saved and analyzed.", {
        conversation: analysisResult.bundle.conversation,
        transcript: analysisResult.bundle.transcript,
        analysis: analysisResult.bundle.analysis,
        segments: analysisResult.bundle.segments,
        duplicate,
      });
      return;
    }

    sendSuccess(res, 201, duplicate ? "Recording already exists." : "Recording saved. Analysis did not complete.", {
      conversation: saved,
      transcript: saved.transcript,
      analysis: null,
      segments: [],
      duplicate,
      analysisError: analysisResult.error ?? { message: "Analysis is still running.", code: "ANALYSIS_PENDING" },
    });
  } catch (err) {
    next(err);
  }
};

export const createRecordingBatchHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      sendError(res, 400, "At least one audio file is required.", "AUDIO_REQUIRED");
      return;
    }

    let items: z.infer<typeof recordingBodySchema>[] = [];
    try {
      const raw = typeof req.body.manifest === "string" ? JSON.parse(req.body.manifest) : req.body.manifest;
      items = batchManifestSchema.parse(Array.isArray(raw) ? raw : []);
    } catch {
      sendError(res, 400, "manifest must be a JSON array matching the audio files.", "VALIDATION_ERROR");
      return;
    }

    const results = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const body = items[index] ?? items[items.length - 1];
      if (!file || !body) {
        results.push({
          index,
          ok: false,
          error: { message: "Missing file or manifest row.", code: "VALIDATION_ERROR" },
        });
        continue;
      }
      if (!isAllowedAudioBuffer(file.buffer)) {
        results.push({
          index,
          ok: false,
          error: { message: "Audio contents do not match a supported format.", code: "UNSUPPORTED_MEDIA_TYPE" },
        });
        continue;
      }
      try {
        const { saved, duplicate, analysisResult } = await saveAndAnalyze({
          organizationId: req.auth.organizationId,
          body,
          file,
        });
        results.push({
          index,
          ok: true,
          duplicate,
          conversationId: saved.id,
          status: analysisResult.ok ? "analyzed" : saved.status,
          conversation: analysisResult.bundle?.conversation ?? saved,
          transcript: analysisResult.bundle?.transcript ?? saved.transcript,
          analysis: analysisResult.bundle?.analysis ?? null,
          analysisError: analysisResult.ok ? undefined : analysisResult.error,
        });
      } catch (err) {
        results.push({
          index,
          ok: false,
          error: {
            message: err instanceof Error ? err.message : "Upload failed.",
            code: "BATCH_ITEM_FAILED",
          },
        });
      }
    }

    sendSuccess(res, 201, "Batch upload processed.", { results });
  } catch (err) {
    next(err);
  }
};
