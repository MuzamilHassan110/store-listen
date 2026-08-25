import { Router } from "express";
import {
  assignStoreUserHandler,
  compareStoresHandler,
  createStoreHandler,
  deleteStoreHandler,
  listStoreUsersHandler,
  listStoresHandler,
  removeStoreUserHandler,
  storeOverviewHandler,
  updateStoreHandler,
} from "../controllers/store.controller.js";
import { requireAuth, requireRole, requireStoreAccess } from "../middleware/auth.js";

export const storeRouter = Router();

storeRouter.get("/", requireAuth, listStoresHandler);
storeRouter.post("/", requireAuth, requireRole("admin"), createStoreHandler);
storeRouter.get("/compare", requireAuth, requireRole("manager"), compareStoresHandler);
storeRouter.get("/:id/overview", requireAuth, requireStoreAccess("id"), storeOverviewHandler);
storeRouter.get("/:id/users", requireAuth, requireStoreAccess("id"), listStoreUsersHandler);
storeRouter.post("/:id/assign", requireAuth, requireRole("admin"), requireStoreAccess("id"), assignStoreUserHandler);
storeRouter.delete(
  "/:id/assign/:userId",
  requireAuth,
  requireRole("admin"),
  requireStoreAccess("id"),
  removeStoreUserHandler,
);
storeRouter.put("/:id", requireAuth, requireRole("admin"), requireStoreAccess("id"), updateStoreHandler);
storeRouter.delete("/:id", requireAuth, requireRole("admin"), requireStoreAccess("id"), deleteStoreHandler);
