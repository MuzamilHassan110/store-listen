import { Router } from "express";
import { getSyncStatusHandler } from "../controllers/sync.controller.js";

export const syncRouter = Router();

syncRouter.get("/status", getSyncStatusHandler);
