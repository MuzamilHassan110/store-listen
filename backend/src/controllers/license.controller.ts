import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import {
  activateLicense,
  activateSchema,
  deactivateLicense,
  generateLicense,
  generateSchema,
  getLicenseStatus,
  renewLicense,
} from "../services/license.service.js";

export const activateLicenseHandler: RequestHandler = async (req, res, next) => {
  try {
    const body = activateSchema.parse(req.body);
    const data = await activateLicense(body);
    sendSuccess(res, 200, body.trial ? "Trial started." : "License activated.", data);
  } catch (err) {
    next(err);
  }
};

export const licenseStatusHandler: RequestHandler = async (req, res, next) => {
  try {
    const key = typeof req.query.key === "string" ? req.query.key : "";
    if (!key) {
      sendError(res, 400, "Query parameter key is required.", "VALIDATION_ERROR");
      return;
    }
    const data = await getLicenseStatus(key);
    sendSuccess(res, 200, "License status loaded.", data);
  } catch (err) {
    next(err);
  }
};

export const deactivateLicenseHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const key = typeof req.body?.license_key === "string" ? req.body.license_key : "";
    if (!key) {
      sendError(res, 400, "license_key is required.", "VALIDATION_ERROR");
      return;
    }
    const data = await deactivateLicense(key, req.auth.organizationId);
    sendSuccess(res, 200, "License deactivated.", data);
  } catch (err) {
    next(err);
  }
};

export const renewLicenseHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const key = typeof req.body?.license_key === "string" ? req.body.license_key : "";
    if (!key) {
      sendError(res, 400, "license_key is required.", "VALIDATION_ERROR");
      return;
    }
    const data = await renewLicense(key, req.auth.organizationId);
    sendSuccess(res, 200, "License renewed.", data);
  } catch (err) {
    next(err);
  }
};

export const generateLicenseHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = generateSchema.parse(req.body ?? {});
    const data = await generateLicense(body, req.auth.organizationId);
    sendSuccess(res, 201, "License created.", data);
  } catch (err) {
    next(err);
  }
};
