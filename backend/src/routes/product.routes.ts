import { Router } from "express";
import {
  createProductHandler,
  deleteProductHandler,
  listProductsHandler,
  updateProductHandler,
} from "../controllers/insights.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const productRouter = Router();

productRouter.get("/", requireAuth, listProductsHandler);
productRouter.post("/", requireAuth, requireRole("manager"), createProductHandler);
productRouter.put("/:id", requireAuth, requireRole("manager"), updateProductHandler);
productRouter.delete("/:id", requireAuth, requireRole("manager"), deleteProductHandler);
