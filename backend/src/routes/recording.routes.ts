import { Router } from "express";
import { createRecordingBatchHandler, createRecordingHandler } from "../controllers/recording.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadRateLimit } from "../middleware/rate-limit.js";
import { uploadAudio, uploadAudioMany } from "../middleware/upload.middleware.js";

export const recordingRouter = Router();

recordingRouter.post("/", requireAuth, uploadRateLimit, uploadAudio, createRecordingHandler);
recordingRouter.post("/batch", requireAuth, uploadRateLimit, uploadAudioMany, createRecordingBatchHandler);
