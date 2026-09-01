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
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes("*") || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (env.NODE_ENV === "development" && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      callback(null, true);
    },
    credentials: true,
  }),
);
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
