import { Router } from "express";
import {
  loginHandler,
  twoFactorBackupHandler,
  twoFactorDisableHandler,
  twoFactorLoginHandler,
  twoFactorSetupHandler,
  twoFactorConfirmHandler,
  twoFactorStatusHandler,
  twoFactorVerifyHandler,
} from "../controllers/two-factor.controller.js";
import {
  changePasswordHandler,
  listSessionsHandler,
  revokeAllSessionsHandler,
  revokeSessionHandler,
} from "../controllers/session.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { authRateLimit } from "../middleware/rate-limit.js";

export const authRouter = Router();

authRouter.post("/login", authRateLimit, loginHandler);
authRouter.post("/2fa/setup", requireAuth, twoFactorSetupHandler);
authRouter.post("/2fa/verify", requireAuth, twoFactorVerifyHandler);
authRouter.post("/2fa/disable", requireAuth, twoFactorDisableHandler);
authRouter.post("/2fa/login", authRateLimit, twoFactorLoginHandler);
authRouter.post("/2fa/backup", authRateLimit, twoFactorBackupHandler);
authRouter.get("/2fa/status", requireAuth, twoFactorStatusHandler);
authRouter.post("/2fa/confirm", requireAuth, twoFactorConfirmHandler);
authRouter.get("/sessions", requireAuth, listSessionsHandler);
authRouter.delete("/sessions", requireAuth, revokeAllSessionsHandler);
authRouter.delete("/sessions/:id", requireAuth, revokeSessionHandler);
authRouter.post("/password", requireAuth, changePasswordHandler);
