import { Router } from "express";
import {
  whatsappConnectHandler,
  whatsappHistoryHandler,
  whatsappLogoutHandler,
  whatsappPreviewHandler,
  whatsappSendHandler,
  whatsappStatusHandler,
  whatsappTemplatesHandler,
} from "../controllers/whatsapp.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const whatsappRouter = Router();

whatsappRouter.get("/status", requireAuth, whatsappStatusHandler);
whatsappRouter.post("/connect", requireAuth, requireRole("manager"), whatsappConnectHandler);
whatsappRouter.post("/logout", requireAuth, requireRole("manager"), whatsappLogoutHandler);
whatsappRouter.post("/send", requireAuth, requireRole("manager"), whatsappSendHandler);
whatsappRouter.get("/templates", requireAuth, whatsappTemplatesHandler);
whatsappRouter.get("/history", requireAuth, whatsappHistoryHandler);
whatsappRouter.get("/preview", requireAuth, whatsappPreviewHandler);
