import { Router } from "express";
import { streamConversationsHandler } from "../controllers/realtime.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const realtimeRouter = Router();

realtimeRouter.get("/conversations", requireAuth, streamConversationsHandler);
