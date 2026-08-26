import type { RequestHandler } from "express";

export const responseTiming: RequestHandler = (_req, res, next) => {
  const started = Date.now();
  const writeHead = res.writeHead.bind(res);
  res.writeHead = ((...args: Parameters<typeof res.writeHead>) => {
    if (!res.headersSent) {
      res.setHeader("X-Response-Time", `${Date.now() - started}ms`);
    }
    return writeHead(...args);
  }) as typeof res.writeHead;
  next();
};
