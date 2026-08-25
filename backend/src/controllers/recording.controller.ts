import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { createRecording, recordingBodySchema } from "../services/recording.service.js";
import { enqueueAndWait } from "../services/analysis-queue.js";
import { env } from "../config/env.js";

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

    const body = recordingBodySchema.parse(req.body);
    const saved = await createRecording({
      organizationId: req.auth.organizationId,
      body,
      file: req.file,
    });

    const liveTranscript = saved.transcript?.text ?? body.transcript ?? "";
    const analysisResult = await enqueueAndWait(
      {
        conversationId: saved.id,
        liveTranscript,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype || "audio/webm",
      },
      env.GEMINI_TIMEOUT_MS + 5_000,
    );

    if (analysisResult.ok && analysisResult.bundle) {
      sendSuccess(res, 201, "Recording saved and analyzed.", {
        conversation: analysisResult.bundle.conversation,
        transcript: analysisResult.bundle.transcript,
        analysis: analysisResult.bundle.analysis,
        segments: analysisResult.bundle.segments,
      });
      return;
    }

    sendSuccess(res, 201, "Recording saved. Analysis did not complete.", {
      conversation: saved,
      transcript: saved.transcript,
      analysis: null,
      segments: [],
      analysisError: analysisResult.error ?? { message: "Analysis is still running.", code: "ANALYSIS_PENDING" },
    });
  } catch (err) {
    next(err);
  }
};
