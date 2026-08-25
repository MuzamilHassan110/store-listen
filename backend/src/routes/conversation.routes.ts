import { Router } from "express";
import {
  getConversationAnalysisHandler,
  getConversationRulesHandler,
  retryConversationAnalysisHandler,
  scoreConversationHandler,
} from "../controllers/conversation.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const conversationRouter = Router();

conversationRouter.get("/:id/analysis", requireAuth, getConversationAnalysisHandler);
conversationRouter.post("/:id/analyze", requireAuth, retryConversationAnalysisHandler);
conversationRouter.get("/:id/rules", requireAuth, getConversationRulesHandler);
conversationRouter.post("/:id/score", requireAuth, scoreConversationHandler);
