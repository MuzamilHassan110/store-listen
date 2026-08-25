import type { RequestHandler } from "express";
import { sendSuccess } from "../lib/api-response.js";

export const getSyncStatusHandler: RequestHandler = (_req, res) => {
  sendSuccess(res, 200, "Backend reachable.", {
    reachable: true,
    serverTime: new Date().toISOString(),
    version: "1.0.0",
    features: {
      batchUpload: true,
      translation: true,
      recordingHash: true,
    },
  });
};
