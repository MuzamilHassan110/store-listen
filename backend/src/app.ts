import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { pinoHttp } from "pino-http";
import { responseTiming } from "./middleware/timing.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { apiRateLimit } from "./middleware/rate-limit.js";
import { router } from "./routes/index.js";

export const app = express();

app.disable("x-powered-by");
app.use(
  helmet({
    frameguard: { action: "deny" },
    noSniff: true,
    hidePoweredBy: true,
    hsts: { maxAge: 15_552_000, includeSubDomains: true },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);
const corsOrigins = env.CORS_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins, credentials: true }));
app.use(compression());
app.use(responseTiming);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else if (env.NODE_ENV !== "test") {
  app.use(pinoHttp({ logger }));
}

app.use("/api", apiRateLimit, router);
app.use(notFoundHandler);
app.use(errorHandler);
