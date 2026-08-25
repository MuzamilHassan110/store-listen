import type { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/api-response.js";
import { getSalesmanLeaderboard, getSalesmanPerformance, type LeaderboardPeriod } from "../services/salesman.service.js";

function routeId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function asPeriod(value: unknown): LeaderboardPeriod {
  return value === "week" || value === "month" ? value : "all";
}

export const getSalesmanPerformanceHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const id = routeId(req.params.id);
    if (!id) {
      sendError(res, 400, "Salesman id is required.", "VALIDATION_ERROR");
      return;
    }
    const performance = await getSalesmanPerformance(req.auth.organizationId, id);
    sendSuccess(res, 200, "Salesman performance loaded.", performance);
  } catch (err) {
    next(err);
  }
};

export const getSalesmanLeaderboardHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) {
      sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
      return;
    }
    const leaderboard = await getSalesmanLeaderboard(req.auth.organizationId, asPeriod(req.query.period));
    sendSuccess(res, 200, "Leaderboard loaded.", leaderboard);
  } catch (err) {
    next(err);
  }
};
