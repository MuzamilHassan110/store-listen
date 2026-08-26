import { Router } from "express";
import {
  deleteScriptHandler,
  generateScriptHandler,
  listScriptsHandler,
  saveScriptHandler,
  updateScriptHandler,
} from "../controllers/insights.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const scriptRouter = Router();

scriptRouter.get("/", requireAuth, listScriptsHandler);
scriptRouter.post("/generate", requireAuth, generateScriptHandler);
scriptRouter.post("/", requireAuth, requireRole("manager"), saveScriptHandler);
scriptRouter.put("/:id", requireAuth, requireRole("manager"), updateScriptHandler);
scriptRouter.delete("/:id", requireAuth, requireRole("manager"), deleteScriptHandler);
