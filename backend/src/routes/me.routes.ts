import { Router } from "express";
import { getMeHandler } from "../controllers/me.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const meRouter = Router();

meRouter.get("/", requireAuth, getMeHandler);
