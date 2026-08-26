import { Router } from "express";
import {
  activateLicenseHandler,
  deactivateLicenseHandler,
  generateLicenseHandler,
  licenseStatusHandler,
  renewLicenseHandler,
} from "../controllers/license.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { authRateLimit } from "../middleware/rate-limit.js";

export const licenseRouter = Router();

licenseRouter.post("/activate", authRateLimit, activateLicenseHandler);
licenseRouter.get("/status", licenseStatusHandler);
licenseRouter.post("/deactivate", requireAuth, requireRole("manager"), deactivateLicenseHandler);
licenseRouter.post("/renew", requireAuth, requireRole("manager"), renewLicenseHandler);
licenseRouter.post("/generate", requireAuth, requireRole("owner"), generateLicenseHandler);
