import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyDueFollowUps,
} from "../services/notification.service.js";

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export const listNotificationsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    await notifyDueFollowUps(req.auth.organizationId);
    const data = await listNotifications(req.auth.organizationId, req.auth.userId);
    sendSuccess(res, 200, "Notifications loaded.", data);
  } catch (err) {
    next(err);
  }
};

export const markNotificationReadHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Notification id is required.", "VALIDATION_ERROR");
      return;
    }
    const data = await markNotificationRead(req.auth.organizationId, id);
    sendSuccess(res, 200, "Notification marked as read.", data);
  } catch (err) {
    next(err);
  }
};

export const markAllReadHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const count = await markAllNotificationsRead(req.auth.organizationId, req.auth.userId);
    sendSuccess(res, 200, "Notifications marked as read.", { count });
  } catch (err) {
    next(err);
  }
};

export const deleteNotificationHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Notification id is required.", "VALIDATION_ERROR");
      return;
    }
    await deleteNotification(req.auth.organizationId, id);
    sendSuccess(res, 200, "Notification deleted.", { id });
  } catch (err) {
    next(err);
  }
};
