import type { RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env } from "../config/env.js";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { HttpError } from "../lib/http-error.js";
import { clientIp } from "../lib/sanitize.js";
import { writeAuditLog } from "../services/audit.service.js";
import {
  completePendingLogin,
  createPendingLogin,
  disableTwoFactor,
  enableTwoFactor,
  ensureProfile,
  getTwoFactorStatus,
  isTrustedDevice,
  issueTrustedDevice,
  setupTwoFactor,
  consumeBackupCode,
  verifyTotp,
} from "../services/2fa.service.js";
import { getSupabase } from "../lib/supabase.js";
import { assertNotLocked, recordLoginAttempt } from "../services/login-guard.service.js";
import { startSession } from "../services/session.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember_device: z.boolean().optional(),
  device_token: z.string().optional(),
});

const codeSchema = z.object({
  code: z.string().min(4).max(16),
  temp_token: z.string().optional(),
  remember_device: z.boolean().optional(),
});

function anonClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new HttpError(500, "Supabase anon key is not configured.", "SUPABASE_NOT_CONFIGURED");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const loginHandler: RequestHandler = async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    await assertNotLocked(body.email);
    const { data, error } = await anonClient().auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error || !data.session || !data.user) {
      await recordLoginAttempt({ email: body.email, ipAddress: clientIp(req), success: false });
      throw new HttpError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }
    await recordLoginAttempt({ email: body.email, ipAddress: clientIp(req), success: true });
    await ensureProfile(data.user.id, null, data.user.email);
    const status = await getTwoFactorStatus(data.user.id);
    const trusted = await isTrustedDevice(data.user.id, body.device_token);
    if (status.enabled && !trusted) {
      const tempToken = await createPendingLogin({
        userId: data.user.id,
        email: data.user.email,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      });
      sendSuccess(res, 200, "Two-factor authentication required.", {
        status: "2fa_required",
        temp_token: tempToken,
      });
      return;
    }
    await startSession({
      userId: data.user.id,
      ipAddress: clientIp(req),
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    });
    sendSuccess(res, 200, "Signed in.", {
      status: "authenticated",
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    next(err);
  }
};

export const twoFactorSetupHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const data = await setupTwoFactor(req.auth.userId, req.auth.email);
    sendSuccess(res, 200, "Scan the QR code, then verify a code to enable 2FA.", data);
  } catch (err) {
    next(err);
  }
};

export const twoFactorVerifyHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = codeSchema.parse(req.body);
    const data = await enableTwoFactor(req.auth.userId, body.code);
    await writeAuditLog({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      action: "2fa_enabled",
      entityType: "user",
      entityId: req.auth.userId,
      ipAddress: clientIp(req),
    });
    sendSuccess(res, 200, "Two-factor authentication enabled.", data);
  } catch (err) {
    next(err);
  }
};

export const twoFactorDisableHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = codeSchema.parse(req.body);
    const data = await disableTwoFactor(req.auth.userId, body.code);
    await writeAuditLog({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      action: "2fa_disabled",
      entityType: "user",
      entityId: req.auth.userId,
      ipAddress: clientIp(req),
    });
    sendSuccess(res, 200, "Two-factor authentication disabled.", data);
  } catch (err) {
    next(err);
  }
};

export const twoFactorLoginHandler: RequestHandler = async (req, res, next) => {
  try {
    const body = codeSchema.parse(req.body);
    if (!body.temp_token) throw new HttpError(400, "temp_token is required.", "VALIDATION_ERROR");
    const session = await completePendingLogin(body.temp_token, body.code, false);
    let deviceToken: string | null = null;
    if (body.remember_device) deviceToken = await issueTrustedDevice(session.user_id);
    await startSession({
      userId: session.user_id,
      ipAddress: clientIp(req),
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    });
    sendSuccess(res, 200, "Signed in.", { ...session, device_token: deviceToken, status: "authenticated" });
  } catch (err) {
    next(err);
  }
};

export const twoFactorBackupHandler: RequestHandler = async (req, res, next) => {
  try {
    const body = codeSchema.parse(req.body);
    if (!body.temp_token) throw new HttpError(400, "temp_token is required.", "VALIDATION_ERROR");
    const session = await completePendingLogin(body.temp_token, body.code, true);
    sendSuccess(res, 200, "Signed in with a backup code.", { ...session, status: "authenticated" });
  } catch (err) {
    next(err);
  }
};

export const twoFactorConfirmHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = codeSchema.parse(req.body);
    const status = await getTwoFactorStatus(req.auth.userId);
    if (!status.enabled) {
      sendSuccess(res, 200, "2FA is not enabled.", { status: "authenticated", device_token: null });
      return;
    }
    const { data } = await getSupabase()
      .from("profiles")
      .select("two_factor_secret")
      .eq("id", req.auth.userId)
      .maybeSingle();
    const secret = String(data?.two_factor_secret ?? "");
    const ok = verifyTotp(secret, body.code) || (await consumeBackupCode(req.auth.userId, body.code));
    if (!ok) throw new HttpError(400, "Invalid code.", "TWO_FACTOR_INVALID");
    const deviceToken = body.remember_device ? await issueTrustedDevice(req.auth.userId) : null;
    await startSession({
      userId: req.auth.userId,
      organizationId: req.auth.organizationId,
      ipAddress: clientIp(req),
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    });
    sendSuccess(res, 200, "Two-factor challenge passed.", { status: "authenticated", device_token: deviceToken });
  } catch (err) {
    next(err);
  }
};

export const twoFactorStatusHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const status = await getTwoFactorStatus(req.auth.userId);
    const deviceToken = typeof req.query.device_token === "string" ? req.query.device_token : null;
    const trusted = await isTrustedDevice(req.auth.userId, deviceToken);
    sendSuccess(res, 200, "2FA status loaded.", { ...status, trusted });
  } catch (err) {
    next(err);
  }
};
