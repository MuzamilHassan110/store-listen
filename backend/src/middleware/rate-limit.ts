import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { getSupabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

const test = env.NODE_ENV === "test";

function limiter(windowMs: number, limit: number, message: string) {
  return rateLimit({
    windowMs,
    limit: test ? Math.max(limit, 1000) : limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message, error: { code: "RATE_LIMITED" } },
    handler: (req, res, _next, options) => {
      void recordBlock(req.ip, req.originalUrl).catch((err) => logger.warn({ err }, "rate limit log failed"));
      res.status(options.statusCode).json(options.message);
    },
  });
}

async function recordBlock(ip: string | undefined, endpoint: string): Promise<void> {
  if (test || !env.SUPABASE_URL) return;
  try {
    await getSupabase().from("rate_limit_logs").insert({
      ip_address: ip ?? null,
      endpoint,
      request_count: 1,
      window_start: new Date().toISOString(),
      blocked_until: new Date(Date.now() + 60_000).toISOString(),
    });
  } catch {
    // ignore missing table in early environments
  }
}

export const apiRateLimit = limiter(60_000, 100, "Too many requests. Try again in a minute.");
export const authRateLimit = limiter(60_000, 5, "Too many authentication attempts.");
export const uploadRateLimit = limiter(60_000, 10, "Too many uploads.");
export const streamChunkRateLimit = limiter(60_000, 60, "Too many stream chunk requests.");
export const reportRateLimit = limiter(60_000, 5, "Too many report requests.");
export const exportRateLimit = limiter(60_000, 5, "Too many export requests.");
