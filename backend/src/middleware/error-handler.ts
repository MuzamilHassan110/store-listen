import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { sendError } from "../lib/api-response.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";

export { HttpError } from "../lib/http-error.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    sendError(res, 400, "Validation failed.", "VALIDATION_ERROR");
    return;
  }

  if (err instanceof HttpError) {
    sendError(res, err.statusCode, err.message, err.code);
    return;
  }

  logger.error({ err }, "Unhandled error");
  sendError(res, 500, "Internal server error.", "INTERNAL_ERROR");
}
