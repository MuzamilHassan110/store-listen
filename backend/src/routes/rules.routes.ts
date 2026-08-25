import { Router } from "express";
import {
  createRuleHandler,
  deleteRuleHandler,
  listRulesHandler,
  updateRuleHandler,
} from "../controllers/rules.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const rulesRouter = Router();

rulesRouter.get("/", requireAuth, listRulesHandler);
rulesRouter.post("/", requireAuth, createRuleHandler);
rulesRouter.put("/:id", requireAuth, updateRuleHandler);
rulesRouter.delete("/:id", requireAuth, deleteRuleHandler);
