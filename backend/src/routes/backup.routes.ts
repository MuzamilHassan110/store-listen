import { Router } from "express";
import {
  backupStatusHandler,
  listBackupsHandler,
  restoreBackupHandler,
  runBackupHandler,
} from "../controllers/backup.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const backupRouter = Router();

backupRouter.post("/run", requireAuth, requireRole("admin"), runBackupHandler);
backupRouter.get("/status", requireAuth, requireRole("manager"), backupStatusHandler);
backupRouter.get("/list", requireAuth, requireRole("manager"), listBackupsHandler);
backupRouter.post("/restore", requireAuth, requireRole("owner"), restoreBackupHandler);
