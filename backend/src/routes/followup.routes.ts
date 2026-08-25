import { Router } from "express";
import {
  completeFollowUpHandler,
  createFollowUpHandler,
  deleteFollowUpHandler,
  listDueTodayHandler,
  listFollowUpsHandler,
  snoozeFollowUpHandler,
  suggestMessageHandler,
  updateFollowUpHandler,
} from "../controllers/followup.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const followupRouter = Router();

followupRouter.get("/due-today", requireAuth, listDueTodayHandler);
followupRouter.get("/", requireAuth, listFollowUpsHandler);
followupRouter.post("/", requireAuth, createFollowUpHandler);
followupRouter.put("/:id", requireAuth, updateFollowUpHandler);
followupRouter.delete("/:id", requireAuth, deleteFollowUpHandler);
followupRouter.post("/:id/complete", requireAuth, completeFollowUpHandler);
followupRouter.post("/:id/snooze", requireAuth, snoozeFollowUpHandler);
followupRouter.post("/:id/message", requireAuth, suggestMessageHandler);
