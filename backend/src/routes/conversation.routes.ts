import { Router } from "express";
import { detectLeadHandler } from "../controllers/followup.controller.js";
import {
  getConversationAnalysisHandler,
  getConversationRulesHandler,
  retryConversationAnalysisHandler,
  scoreConversationHandler,
  startConversationHandler,
  streamChunkHandler,
} from "../controllers/conversation.controller.js";
import {
  conversationCoachingHandler,
  conversationRecommendationsHandler,
} from "../controllers/insights.controller.js";
import { translateConversationHandler } from "../controllers/translation.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { streamChunkRateLimit } from "../middleware/rate-limit.js";
import { uploadAudio } from "../middleware/upload.middleware.js";

export const conversationRouter = Router();

conversationRouter.post("/start", requireAuth, startConversationHandler);
conversationRouter.post("/:id/stream-chunk", requireAuth, streamChunkRateLimit, uploadAudio, streamChunkHandler);
conversationRouter.get("/:id/recommendations", requireAuth, conversationRecommendationsHandler);
conversationRouter.get("/:id/coaching", requireAuth, conversationCoachingHandler);
conversationRouter.get("/:id/analysis", requireAuth, getConversationAnalysisHandler);
conversationRouter.get("/:id/translate", requireAuth, translateConversationHandler);
conversationRouter.post("/:id/analyze", requireAuth, retryConversationAnalysisHandler);
conversationRouter.get("/:id/rules", requireAuth, getConversationRulesHandler);
conversationRouter.post("/:id/score", requireAuth, scoreConversationHandler);
conversationRouter.post("/:id/detect-leads", requireAuth, detectLeadHandler);
