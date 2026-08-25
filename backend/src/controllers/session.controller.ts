import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { getSupabase } from "../lib/supabase.js";
import { HttpError } from "../lib/http-error.js";
import { listSessions, revokeAllSessions, revokeSession } from "../services/session.service.js";

export const listSessionsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    sendSuccess(res, 200, "Sessions loaded.", await listSessions(req.auth.userId));
  } catch (err) {
    next(err);
  }
};

export const revokeSessionHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
    if (!id) {
      sendError(res, 400, "Session id is required.", "VALIDATION_ERROR");
      return;
    }
    await revokeSession(req.auth.userId, id);
    sendSuccess(res, 200, "Session revoked.", { id });
  } catch (err) {
    next(err);
  }
};

export const revokeAllSessionsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const count = await revokeAllSessions(req.auth.userId);
    sendSuccess(res, 200, "Sessions revoked.", { count });
  } catch (err) {
    next(err);
  }
};

export const changePasswordHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (password.length < 8) {
      sendError(res, 400, "Password must be at least 8 characters.", "VALIDATION_ERROR");
      return;
    }
    const { error } = await getSupabase().auth.admin.updateUserById(req.auth.userId, { password });
    if (error) throw new HttpError(500, "Failed to update password.", "PASSWORD_UPDATE_FAILED");
    sendSuccess(res, 200, "Password updated.", { updated: true });
  } catch (err) {
    next(err);
  }
};
