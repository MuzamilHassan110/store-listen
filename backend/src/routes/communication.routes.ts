import { Router } from "express";
import {
  getCommunicationSettingsHandler,
  updateCommunicationSettingsHandler,
} from "../controllers/communication.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const communicationRouter = Router();

communicationRouter.get("/settings", requireAuth, getCommunicationSettingsHandler);
communicationRouter.put("/settings", requireAuth, requireRole("manager"), updateCommunicationSettingsHandler);
