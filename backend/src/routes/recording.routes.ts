import { Router } from "express";
import { createRecordingHandler } from "../controllers/recording.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadAudio } from "../middleware/upload.middleware.js";

export const recordingRouter = Router();

recordingRouter.post("/", requireAuth, uploadAudio, createRecordingHandler);
