import { Router } from "express";
import {
  exportConversationsHandler,
  exportCustomersHandler,
  exportFollowUpsHandler,
  exportSalesmenHandler,
} from "../controllers/export.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { exportRateLimit } from "../middleware/rate-limit.js";

export const exportRouter = Router();
exportRouter.use(exportRateLimit);

exportRouter.get("/conversations", requireAuth, exportConversationsHandler);
exportRouter.get("/salesmen", requireAuth, exportSalesmenHandler);
exportRouter.get("/followups", requireAuth, exportFollowUpsHandler);
exportRouter.get("/customers", requireAuth, exportCustomersHandler);
