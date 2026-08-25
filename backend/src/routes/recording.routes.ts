import { Router } from "express";
import { createRecordingBatchHandler, createRecordingHandler } from "../controllers/recording.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadAudio, uploadAudioMany } from "../middleware/upload.middleware.js";

export const recordingRouter = Router();

recordingRouter.post("/", requireAuth, uploadAudio, createRecordingHandler);
recordingRouter.post("/batch", requireAuth, uploadAudioMany, createRecordingBatchHandler);
