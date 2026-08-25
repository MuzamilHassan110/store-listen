import { Router } from "express";
import {
  getConversationAnalysisHandler,
  retryConversationAnalysisHandler,
} from "../controllers/conversation.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const conversationRouter = Router();

conversationRouter.get("/:id/analysis", requireAuth, getConversationAnalysisHandler);
conversationRouter.post("/:id/analyze", requireAuth, retryConversationAnalysisHandler);
