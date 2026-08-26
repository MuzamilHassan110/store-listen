import { Router } from "express";
import { env } from "../config/env.js";

export const versionRouter = Router();

versionRouter.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Version loaded.",
    data: {
      latest: env.DESKTOP_LATEST_VERSION,
      minimum: env.DESKTOP_MINIMUM_VERSION,
      critical: env.DESKTOP_FORCE_UPDATE,
      download_url: env.DESKTOP_DOWNLOAD_URL,
      notes: "Installers and auto-updates ship from GitHub Releases.",
    },
  });
});
