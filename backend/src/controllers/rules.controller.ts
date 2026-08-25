import type { RequestHandler } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { createRule, listRules, softDeleteRule, updateRule } from "../services/rules.service.js";

const ruleBodySchema = z.object({
  rule_type: z.string().min(1),
  description: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  is_active: z.boolean().optional(),
});

const ruleUpdateSchema = ruleBodySchema.partial();

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export const listRulesHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const rules = await listRules(req.auth.organizationId, true);
    sendSuccess(res, 200, "Rules loaded.", rules);
  } catch (err) {
    next(err);
  }
};

export const createRuleHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = ruleBodySchema.parse(req.body);
    const rule = await createRule(req.auth.organizationId, body);
    sendSuccess(res, 201, "Rule created.", rule);
  } catch (err) {
    next(err);
  }
};

export const updateRuleHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Rule id is required.", "VALIDATION_ERROR");
      return;
    }
    const body = ruleUpdateSchema.parse(req.body);
    const rule = await updateRule(req.auth.organizationId, id, body);
    sendSuccess(res, 200, "Rule updated.", rule);
  } catch (err) {
    next(err);
  }
};

export const deleteRuleHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Rule id is required.", "VALIDATION_ERROR");
      return;
    }
    const rule = await softDeleteRule(req.auth.organizationId, id);
    sendSuccess(res, 200, "Rule deactivated.", rule);
  } catch (err) {
    next(err);
  }
};
