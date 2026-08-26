import { Router } from "express";
import { insightOverviewHandler } from "../controllers/insights.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const insightRouter = Router();

insightRouter.get("/overview", requireAuth, insightOverviewHandler);
