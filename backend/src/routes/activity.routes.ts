import { Router } from "express";
import { listActivityHandler } from "../controllers/activity.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const activityRouter = Router();

activityRouter.get("/", requireAuth, listActivityHandler);
