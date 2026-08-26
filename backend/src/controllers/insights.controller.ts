import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { generateCoachingTips, listCoachingSuggestions } from "../services/coaching.service.js";
import { predictChurn } from "../services/churn.service.js";
import { loadInsightOverview } from "../services/insights.service.js";
import {
  createProduct,
  deleteProduct,
  listProducts,
  productSchema,
  recommendProducts,
  updateProduct,
} from "../services/recommendation.service.js";
import {
  deleteScript,
  generateSalesScript,
  generateScriptSchema,
  listScripts,
  saveScript,
  saveScriptSchema,
  updateScript,
} from "../services/script.service.js";

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export const conversationCoachingHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Conversation id is required.", "VALIDATION_ERROR");
      return;
    }
    const stored = await listCoachingSuggestions(id);
    const data = stored.length
      ? {
          tips: stored
            .filter((row) => !String(row.trigger ?? "").startsWith("missed_"))
            .map((row) => ({
              trigger: String(row.trigger ?? ""),
              suggestion: String(row.suggestion ?? ""),
              priority: (row.priority ?? "medium") as "high" | "medium" | "low",
              timestamp: Number(row.timestamp ?? 0),
            })),
          missed_opportunities: stored
            .filter((row) => String(row.trigger ?? "").startsWith("missed_"))
            .map((row) => ({
              type: String(row.trigger ?? "").replace(/^missed_/, "") || "opportunity",
              description: String(row.suggestion ?? ""),
              timestamp: Number(row.timestamp ?? 0),
            })),
        }
      : await generateCoachingTips(id, req.auth.organizationId);
    sendSuccess(res, 200, "Coaching loaded.", data);
  } catch (err) {
    next(err);
  }
};

export const conversationRecommendationsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Conversation id is required.", "VALIDATION_ERROR");
      return;
    }
    const data = await recommendProducts(id, req.auth.organizationId);
    sendSuccess(res, 200, "Recommendations loaded.", data);
  } catch (err) {
    next(err);
  }
};

export const listProductsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    sendSuccess(res, 200, "Products loaded.", await listProducts(req.auth.organizationId));
  } catch (err) {
    next(err);
  }
};

export const createProductHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = productSchema.parse(req.body);
    sendSuccess(res, 201, "Product created.", await createProduct(req.auth.organizationId, body));
  } catch (err) {
    next(err);
  }
};

export const updateProductHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Product id is required.", "VALIDATION_ERROR");
      return;
    }
    const body = productSchema.parse(req.body);
    sendSuccess(res, 200, "Product updated.", await updateProduct(req.auth.organizationId, id, body));
  } catch (err) {
    next(err);
  }
};

export const deleteProductHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Product id is required.", "VALIDATION_ERROR");
      return;
    }
    await deleteProduct(req.auth.organizationId, id);
    sendSuccess(res, 200, "Product deleted.", { id });
  } catch (err) {
    next(err);
  }
};

export const customerChurnHandler: RequestHandler = async (req, res, next) => {
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
    sendSuccess(res, 200, "Churn prediction loaded.", await predictChurn(id, req.auth.organizationId));
  } catch (err) {
    next(err);
  }
};

export const listScriptsHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    sendSuccess(res, 200, "Scripts loaded.", await listScripts(req.auth.organizationId));
  } catch (err) {
    next(err);
  }
};

export const generateScriptHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = generateScriptSchema.parse(req.body ?? {});
    sendSuccess(res, 200, "Script generated.", await generateSalesScript(req.auth.organizationId, body));
  } catch (err) {
    next(err);
  }
};

export const saveScriptHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const body = saveScriptSchema.parse(req.body);
    sendSuccess(res, 201, "Script saved.", await saveScript(req.auth.organizationId, body));
  } catch (err) {
    next(err);
  }
};

export const updateScriptHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Script id is required.", "VALIDATION_ERROR");
      return;
    }
    const body = saveScriptSchema.parse(req.body);
    sendSuccess(res, 200, "Script updated.", await updateScript(req.auth.organizationId, id, body));
  } catch (err) {
    next(err);
  }
};

export const deleteScriptHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Script id is required.", "VALIDATION_ERROR");
      return;
    }
    await deleteScript(req.auth.organizationId, id);
    sendSuccess(res, 200, "Script deleted.", { id });
  } catch (err) {
    next(err);
  }
};

export const insightOverviewHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    sendSuccess(res, 200, "Insight overview loaded.", await loadInsightOverview(req.auth.organizationId));
  } catch (err) {
    next(err);
  }
};
