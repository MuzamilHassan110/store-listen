import { app, BrowserWindow, ipcMain, Menu, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readDesktopConfig, writeDesktopConfig } from "./config.js";
import {
  checkForUpdates,
  getUpdateStatus,
  initUpdater,
  installUpdate,
  setAutoUpdateEnabled,
  setUpdateChannel,
} from "./updater.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
const BUILT_IN_BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

let win: BrowserWindow | null = null;

function backendUrl(): string {
  const stored = readDesktopConfig().backendUrl?.trim();
  return (stored || BUILT_IN_BACKEND).replace(/\/$/, "");
}

function createWindow(): void {
  const iconPath = path.join(process.env.APP_ROOT ?? __dirname, "build", "icon.ico");
  win = new BrowserWindow({
    title: "StoreListen",
    width: 500,           // Initial width
    height: 750,          // Initial height
    minWidth: 450,        // Can shrink to 450
    minHeight: 650,       // Can shrink to 650
    resizable: true,      // Allow resizing
    maximizable: true,    // Allow maximize
    fullscreenable: false,
    minimizable: true,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  win.on("closed", () => {
    win = null;
  });
}

function allowMicrophone(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === "media");
  });

  session.defaultSession.setPermissionCheckHandler((_contents, permission) => {
    return permission === "media" || permission === "audioCapture";
  });
}

ipcMain.handle("config:getBackendUrl", () => backendUrl());
ipcMain.handle("config:setBackendUrl", (_event, url: string) => {
  const next = String(url ?? "").trim().replace(/\/$/, "");
  writeDesktopConfig({ backendUrl: next });
  return next || backendUrl();
});
ipcMain.handle("app:getVersion", () => app.getVersion());
ipcMain.handle("app:isPackaged", () => app.isPackaged);
ipcMain.handle("update:status", () => getUpdateStatus());
ipcMain.handle("update:check", () => {
  checkForUpdates();
  return getUpdateStatus();
});
ipcMain.handle("update:install", () => {
  installUpdate();
});
ipcMain.handle("update:setAuto", (_event, enabled: boolean) => {
  setAutoUpdateEnabled(Boolean(enabled));
  return readDesktopConfig();
});
ipcMain.handle("update:setChannel", (_event, channel: "latest" | "beta") => {
  setUpdateChannel(channel === "beta" ? "beta" : "latest");
  return readDesktopConfig();
});
ipcMain.handle("update:getSettings", () => readDesktopConfig());

ipcMain.handle("sync:status", async () => {
  try {
    const response = await fetch(`${backendUrl()}/api/sync/status`);
    const json = (await response.json().catch(() => null)) as {
      success?: boolean;
      data?: { reachable?: boolean; serverTime?: string; version?: string };
    } | null;
    if (!response.ok) {
      return { ok: false, reachable: false, message: `Sync check failed (${response.status})` };
    }
    return {
      ok: true,
      reachable: Boolean(json?.data?.reachable ?? json?.success ?? true),
      serverTime: json?.data?.serverTime,
      version: json?.data?.version,
    };
  } catch (error) {
    return {
      ok: false,
      reachable: false,
      message: error instanceof Error ? error.message : "Backend unreachable",
    };
  }
});

ipcMain.handle(
  "recordings:upload",
  async (
    _event,
    payload: {
      bytes: ArrayBuffer;
      filename: string;
      mimeType: string;
      duration: number;
      transcript: string;
      language: string;
      deviceId: string;
      salesmanId: string | null;
      recordingHash?: string;
      conversationId?: string | null;
      token: string | null;
    },
  ): Promise<
    { ok: true; status: number; conversationId?: string } | { ok: false; status: number; message: string }
  > => {
    try {
      const form = new FormData();
      form.append("audio", new Blob([payload.bytes], { type: payload.mimeType }), payload.filename);
      form.append("duration", String(payload.duration));
      form.append("transcript", payload.transcript);
      form.append("language", payload.language);
      form.append("deviceId", payload.deviceId);
      form.append("salesmanId", payload.salesmanId ?? "");
      if (payload.recordingHash) form.append("recordingHash", payload.recordingHash);
      if (payload.conversationId) form.append("conversationId", payload.conversationId);

      const headers = new Headers();
      if (payload.token) {
        headers.set("Authorization", `Bearer ${payload.token}`);
      }

      const response = await fetch(`${backendUrl()}/api/recordings`, {
        method: "POST",
        headers,
        body: form,
      });

      const json = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        data?: { id?: string; conversation?: { id?: string } };
      } | null;

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          message: json?.message || `Upload failed (${response.status})`,
        };
      }

      return {
        ok: true,
        status: response.status,
        conversationId: json?.data?.conversation?.id ?? json?.data?.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      return { ok: false, status: 0, message };
    }
  },
);

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  allowMicrophone();
  createWindow();
  initUpdater(() => win);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
