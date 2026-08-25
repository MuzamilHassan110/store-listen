import { env } from "./config/env.js";
import { app } from "./app.js";
import { logger } from "./lib/logger.js";
import { startReportScheduler } from "./services/scheduler.service.js";

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "API server listening");
  if (env.NODE_ENV !== "test") startReportScheduler();
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down");
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
