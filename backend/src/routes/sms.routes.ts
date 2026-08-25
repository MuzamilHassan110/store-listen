import { Router } from "express";
import { smsSendHandler, smsStatusHandler } from "../controllers/sms.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const smsRouter = Router();

smsRouter.post("/send", requireAuth, requireRole("manager"), smsSendHandler);
smsRouter.get("/status/:messageId", requireAuth, smsStatusHandler);
