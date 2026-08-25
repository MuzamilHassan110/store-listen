import { Router } from "express";
import {
  exportConversationsHandler,
  exportCustomersHandler,
  exportFollowUpsHandler,
  exportSalesmenHandler,
} from "../controllers/export.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const exportRouter = Router();

exportRouter.get("/conversations", requireAuth, exportConversationsHandler);
exportRouter.get("/salesmen", requireAuth, exportSalesmenHandler);
exportRouter.get("/followups", requireAuth, exportFollowUpsHandler);
exportRouter.get("/customers", requireAuth, exportCustomersHandler);
