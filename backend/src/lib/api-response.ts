import type { Response } from "express";

export type ApiErrorBody = {
  success: false;
  message: string;
  error: { code: string };
};

export type ApiSuccessBody<T> = {
  success: true;
  message: string;
  data: T;
};

export function sendError(
  res: Response,
  status: number,
  message: string,
  code: string,
): Response {
  const body: ApiErrorBody = { success: false, message, error: { code } };
  return res.status(status).json(body);
}

export function sendSuccess<T>(
  res: Response,
  status: number,
  message: string,
  data: T,
): Response {
  const body: ApiSuccessBody<T> = { success: true, message, data };
  return res.status(status).json(body);
}
