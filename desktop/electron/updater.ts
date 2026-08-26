import { app } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import type { BrowserWindow } from "electron";
import { readDesktopConfig, writeDesktopConfig } from "./config.js";

export type UpdatePayload = {
  status:
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error";
  version?: string;
  percent?: number;
  message?: string;
};

let latest: UpdatePayload = { status: "idle" };
let timer: ReturnType<typeof setInterval> | null = null;

function emit(getWindow: () => BrowserWindow | null, payload: UpdatePayload): void {
  latest = payload;
  getWindow()?.webContents.send("update:event", payload);
}

export function getUpdateStatus(): UpdatePayload {
  return latest;
}

export function initUpdater(getWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) {
    log.info("Updates skipped in development");
    return;
  }

  const settings = readDesktopConfig();
  log.transports.file.level = "info";
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = settings.installOnQuit !== false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.channel = settings.channel === "beta" ? "beta" : "latest";

  autoUpdater.on("checking-for-update", () => {
    emit(getWindow, { status: "checking" });
  });
  autoUpdater.on("update-available", (info) => {
    emit(getWindow, { status: "available", version: info.version });
  });
  autoUpdater.on("update-not-available", (info) => {
    emit(getWindow, { status: "not-available", version: info.version });
  });
  autoUpdater.on("download-progress", (progress) => {
    emit(getWindow, { status: "downloading", percent: progress.percent });
  });
  autoUpdater.on("update-downloaded", (info) => {
    emit(getWindow, { status: "downloaded", version: info.version });
  });
  autoUpdater.on("error", (error) => {
    emit(getWindow, { status: "error", message: error.message });
  });

  if (settings.autoUpdate !== false) {
    void autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      log.warn(error);
    });
    timer = setInterval(
      () => {
        void autoUpdater.checkForUpdates().catch((error) => log.warn(error));
      },
      4 * 60 * 60 * 1000,
    );
  }
}

export function checkForUpdates(): void {
  if (!app.isPackaged) {
    latest = { status: "not-available", message: "Updates run on installed builds." };
    return;
  }
  void autoUpdater.checkForUpdates().catch((error) => {
    latest = { status: "error", message: error instanceof Error ? error.message : "Update check failed" };
  });
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}

export function setAutoUpdateEnabled(enabled: boolean): void {
  writeDesktopConfig({ autoUpdate: enabled });
  if (!enabled && timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function setUpdateChannel(channel: "latest" | "beta"): void {
  writeDesktopConfig({ channel });
  if (app.isPackaged) autoUpdater.channel = channel;
}
