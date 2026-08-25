import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { createRecording, recordingBodySchema } from "../services/recording.service.js";

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
    const conversation = await createRecording({
      organizationId: req.auth.organizationId,
      body,
      file: req.file,
    });

    sendSuccess(res, 201, "Recording saved.", conversation);
  } catch (err) {
    next(err);
  }
};
