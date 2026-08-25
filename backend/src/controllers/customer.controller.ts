import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { getCustomerDetail, listCustomers, updateCustomer } from "../services/customer.service.js";

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export const listCustomersHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const data = await listCustomers(req.auth.organizationId, search);
    sendSuccess(res, 200, "Customers loaded.", data);
  } catch (err) {
    next(err);
  }
};

export const getCustomerHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Customer id is required.", "VALIDATION_ERROR");
      return;
    }
    const data = await getCustomerDetail(req.auth.organizationId, id);
    sendSuccess(res, 200, "Customer loaded.", data);
  } catch (err) {
    next(err);
  }
};

export const updateCustomerHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Customer id is required.", "VALIDATION_ERROR");
      return;
    }
    const body = req.body as Record<string, unknown>;
    const data = await updateCustomer(req.auth.organizationId, id, {
      notes: typeof body.notes === "string" ? body.notes : undefined,
      whatsapp_number: typeof body.whatsapp_number === "string" ? body.whatsapp_number : undefined,
      sms_number: typeof body.sms_number === "string" ? body.sms_number : undefined,
      preferred_contact: body.preferred_contact === "sms" || body.preferred_contact === "whatsapp" ? body.preferred_contact : undefined,
      contact_consent: typeof body.contact_consent === "boolean" ? body.contact_consent : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
    });
    sendSuccess(res, 200, "Customer updated.", data);
  } catch (err) {
    next(err);
  }
};
