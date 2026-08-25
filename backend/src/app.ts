import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { apiRateLimit } from "./middleware/rate-limit.js";
import { router } from "./routes/index.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
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
