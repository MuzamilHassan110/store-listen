import type { Request, Response } from "express";
import { sendError } from "../lib/api-response.js";

export function notFoundHandler(_req: Request, res: Response): void {
  sendError(res, 404, "Not found.", "NOT_FOUND");
}
