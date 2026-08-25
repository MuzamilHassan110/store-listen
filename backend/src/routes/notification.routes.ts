import { Router } from "express";
import {
  deleteNotificationHandler,
  listNotificationsHandler,
  markAllReadHandler,
  markNotificationReadHandler,
} from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationRouter = Router();

notificationRouter.get("/", requireAuth, listNotificationsHandler);
notificationRouter.put("/read-all", requireAuth, markAllReadHandler);
notificationRouter.put("/:id/read", requireAuth, markNotificationReadHandler);
notificationRouter.delete("/:id", requireAuth, deleteNotificationHandler);
