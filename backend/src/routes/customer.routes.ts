import { Router } from "express";
import {
  getCustomerHandler,
  listCustomersHandler,
  updateCustomerHandler,
} from "../controllers/customer.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const customerRouter = Router();

customerRouter.get("/", requireAuth, listCustomersHandler);
customerRouter.get("/:id", requireAuth, getCustomerHandler);
customerRouter.put("/:id", requireAuth, updateCustomerHandler);
