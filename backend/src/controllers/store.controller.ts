import type { RequestHandler } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { canAccessAllStores } from "../lib/rbac.js";
import {
  assignUserToStore,
  compareStores,
  createStore,
  deactivateStore,
  getOrganizationStores,
  getStoreOverview,
  listStoreUsers,
  removeStoreAssignment,
  storeBodySchema,
  updateStore,
} from "../services/store.service.js";

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export const listStoresHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const stores = await getOrganizationStores(req.auth.organizationId, req.auth.role, req.auth.storeIds);
    sendSuccess(res, 200, "Stores loaded.", {
      stores,
      role: req.auth.role,
      storeIds: canAccessAllStores(req.auth.role) ? stores.map((store) => store.id) : req.auth.storeIds,
    });
  } catch (err) {
    next(err);
  }
};

export const createStoreHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = storeBodySchema.parse(req.body);
    const store = await createStore(req.auth.organizationId, body);
    sendSuccess(res, 201, "Store created.", store);
  } catch (err) {
    next(err);
  }
};

export const updateStoreHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Store id is required.", "VALIDATION_ERROR");
      return;
    }
    const body = storeBodySchema.partial().parse(req.body);
    const store = await updateStore(req.auth.organizationId, id, body);
    sendSuccess(res, 200, "Store updated.", store);
  } catch (err) {
    next(err);
  }
};

export const deleteStoreHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Store id is required.", "VALIDATION_ERROR");
      return;
    }
    const store = await deactivateStore(req.auth.organizationId, id);
    sendSuccess(res, 200, "Store deactivated.", store);
  } catch (err) {
    next(err);
  }
};

export const storeOverviewHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Store id is required.", "VALIDATION_ERROR");
      return;
    }
    const overview = await getStoreOverview(req.auth.organizationId, id);
    sendSuccess(res, 200, "Store overview loaded.", overview);
  } catch (err) {
    next(err);
  }
};

export const compareStoresHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const ids = String(req.query.ids ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const comparison = await compareStores(req.auth.organizationId, ids, {
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
    });
    sendSuccess(res, 200, "Store comparison ready.", comparison);
  } catch (err) {
    next(err);
  }
};

const assignSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["manager", "viewer"]).default("viewer"),
});

export const assignStoreUserHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Store id is required.", "VALIDATION_ERROR");
      return;
    }
    const body = assignSchema.parse(req.body);
    const assignment = await assignUserToStore({
      organizationId: req.auth.organizationId,
      storeId: id,
      userId: body.userId,
      role: body.role,
    });
    sendSuccess(res, 201, "User assigned to store.", assignment);
  } catch (err) {
    next(err);
  }
};

export const removeStoreUserHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    const userId = routeId(req.params.userId);
    if (!id || !userId) {
      sendError(res, 400, "Store id and user id are required.", "VALIDATION_ERROR");
      return;
    }
    await removeStoreAssignment(id, userId);
    sendSuccess(res, 200, "Assignment removed.", { storeId: id, userId });
  } catch (err) {
    next(err);
  }
};

export const listStoreUsersHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Store id is required.", "VALIDATION_ERROR");
      return;
    }
    const users = await listStoreUsers(id);
    sendSuccess(res, 200, "Store users loaded.", users);
  } catch (err) {
    next(err);
  }
};
