import { Router } from "express";
import {
  deviceStatusHandler,
  listDevicesHandler,
  registerDeviceHandler,
  syncDeviceHandler,
  updateDeviceHandler,
} from "../controllers/device.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const deviceRouter = Router();

deviceRouter.get("/", requireAuth, requireRole("manager"), listDevicesHandler);
deviceRouter.post("/register", requireAuth, registerDeviceHandler);
deviceRouter.put("/:id", requireAuth, requireRole("manager"), updateDeviceHandler);
deviceRouter.get("/:id/status", requireAuth, requireRole("manager"), deviceStatusHandler);
deviceRouter.post("/:id/sync", requireAuth, requireRole("manager"), syncDeviceHandler);
deviceRouter.post("/:id/restart", requireAuth, requireRole("admin"), syncDeviceHandler);
