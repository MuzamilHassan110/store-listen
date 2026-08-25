import { Router } from "express";
import {
  retentionCleanupHandler,
  retentionSettingsHandler,
  retentionStatusHandler,
} from "../controllers/retention.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const retentionRouter = Router();

retentionRouter.get("/status", requireAuth, retentionStatusHandler);
retentionRouter.post("/cleanup", requireAuth, retentionCleanupHandler);
retentionRouter.put("/settings", requireAuth, retentionSettingsHandler);
