import { Router } from "express";
import {
  getSalesmanLeaderboardHandler,
  getSalesmanPerformanceHandler,
} from "../controllers/salesman.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const salesmanRouter = Router();

salesmanRouter.get("/leaderboard", requireAuth, getSalesmanLeaderboardHandler);
salesmanRouter.get("/:id/performance", requireAuth, getSalesmanPerformanceHandler);
