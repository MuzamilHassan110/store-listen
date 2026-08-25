import { Router } from "express";
import { healthRouter } from "./health.js";
import { conversationRouter } from "./conversation.routes.js";
import { recordingRouter } from "./recording.routes.js";

export const router = Router();

router.use(healthRouter);
router.use("/recordings", recordingRouter);
router.use("/conversations", conversationRouter);
