import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import {
  getDeviceStatus,
  listDevices,
  registerDevice,
  registerDeviceSchema,
  syncDevice,
  updateDevice,
  updateDeviceSchema,
} from "../services/device.service.js";

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export const listDevicesHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const storeId = typeof req.query.storeId === "string" ? req.query.storeId : null;
    const devices = await listDevices(req.auth.organizationId, storeId);
    sendSuccess(res, 200, "Devices loaded.", devices);
  } catch (err) {
    next(err);
  }
};

export const registerDeviceHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = registerDeviceSchema.parse(req.body);
    const device = await registerDevice(req.auth.organizationId, body, req.auth.userId);
    sendSuccess(res, 201, "Device registered.", device);
  } catch (err) {
    next(err);
  }
};

export const updateDeviceHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Device id is required.", "VALIDATION_ERROR");
      return;
    }
    const body = updateDeviceSchema.parse(req.body);
    const device = await updateDevice(req.auth.organizationId, id, body);
    sendSuccess(res, 200, "Device updated.", device);
  } catch (err) {
    next(err);
  }
};

export const deviceStatusHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Device id is required.", "VALIDATION_ERROR");
      return;
    }
    const status = await getDeviceStatus(req.auth.organizationId, id);
    sendSuccess(res, 200, "Device status loaded.", status);
  } catch (err) {
    next(err);
  }
};

export const syncDeviceHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Device id is required.", "VALIDATION_ERROR");
      return;
    }
    const device = await syncDevice(req.auth.organizationId, id, req.auth.userId);
    sendSuccess(res, 200, "Device sync requested.", device);
  } catch (err) {
    next(err);
  }
};
