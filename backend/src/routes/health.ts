import { Router } from "express";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import { cacheSize } from "../services/cache.service.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "store-listien-api",
    timestamp: new Date().toISOString(),
  });
});

healthRouter.post("/health/client-error", (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.slice(0, 500) : "unknown";
  const stack = typeof req.body?.stack === "string" ? req.body.stack.slice(0, 2000) : undefined;
  logger.warn({ message, stack, source: "frontend" }, "Client UI error");
  res.status(204).end();
});

healthRouter.get("/health/detailed", async (_req, res) => {
  let database: "ok" | "error" | "unconfigured" = "unconfigured";
  let storage: "ok" | "error" | "unconfigured" = "unconfigured";
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { error } = await getSupabase().from("organizations").select("id").limit(1);
      database = error ? "error" : "ok";
    } catch {
      database = "error";
    }
    try {
      const { error } = await getSupabase().storage.getBucket("recordings");
      storage = error ? "error" : "ok";
    } catch {
      storage = "error";
    }
  }

  const memory = process.memoryUsage();
  res.json({
    ok: database !== "error",
    service: "store-listien-api",
    timestamp: new Date().toISOString(),
    checks: {
      database,
      storage,
      ai: env.GEMINI_API_KEY ? "configured" : "unconfigured",
      cache_entries: cacheSize(),
    },
    process: {
      uptime_seconds: Math.round(process.uptime()),
      memory_rss_mb: Math.round(memory.rss / 1024 / 1024),
      memory_heap_mb: Math.round(memory.heapUsed / 1024 / 1024),
    },
  });
});
