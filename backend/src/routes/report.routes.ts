import { Router } from "express";
import {
  conversationReportHandler,
  listReportsHandler,
  listSchedulesHandler,
  salesmanReportHandler,
  storeReportHandler,
  upsertScheduleHandler,
} from "../controllers/report.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const reportRouter = Router();

reportRouter.get("/", requireAuth, listReportsHandler);
reportRouter.get("/conversation/:id", requireAuth, conversationReportHandler);
reportRouter.get("/salesman/:id", requireAuth, salesmanReportHandler);
reportRouter.get("/store", requireAuth, storeReportHandler);
reportRouter.get("/schedules", requireAuth, listSchedulesHandler);
reportRouter.post("/schedules", requireAuth, upsertScheduleHandler);
