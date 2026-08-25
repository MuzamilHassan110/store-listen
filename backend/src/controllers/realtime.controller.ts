import type { RequestHandler } from "express";
import { sendError } from "../lib/api-response.js";
import { getSupabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

export const streamConversationsHandler: RequestHandler = async (req, res) => {
  if (!req.auth) {
    sendError(res, 401, "Authentication required.", "UNAUTHENTICATED");
    return;
  }

  const organizationId = req.auth.organizationId;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`event: ready\ndata: ${JSON.stringify({ organizationId, serverTime: new Date().toISOString() })}\n\n`);

  let cursor = new Date().toISOString();
  const timer = setInterval(() => {
    void (async () => {
      const { data, error } = await getSupabase()
        .from("conversations")
        .select("id, store_id, status, recorded_at, created_at, duration_seconds")
        .eq("organization_id", organizationId)
        .gt("created_at", cursor)
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) {
        logger.warn({ error }, "Realtime conversation poll failed");
        return;
      }
      if (data?.length) {
        cursor = String(data[data.length - 1]?.created_at ?? cursor);
        res.write(`event: conversation\ndata: ${JSON.stringify(data)}\n\n`);
      } else {
        res.write(`event: ping\ndata: ${JSON.stringify({ serverTime: new Date().toISOString() })}\n\n`);
      }
    })();
  }, 4000);

  req.on("close", () => {
    clearInterval(timer);
    res.end();
  });
};
