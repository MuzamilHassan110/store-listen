import { app, BrowserWindow, ipcMain, Menu, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

let win: BrowserWindow | null = null;

function createWindow(): void {
  win = new BrowserWindow({
    title: "StoreListen",
    width: 420,
    height: 640,
    minWidth: 420,
    maxWidth: 420,
    minHeight: 640,
    maxHeight: 640,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    minimizable: true,
    autoHideMenuBar: true,
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

ipcMain.handle("config:getBackendUrl", () => BACKEND_URL);

ipcMain.handle("sync:status", async () => {
  try {
    const response = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/api/sync/status`);
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

      const headers = new Headers();
      if (payload.token) {
        headers.set("Authorization", `Bearer ${payload.token}`);
      }

      const response = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/api/recordings`, {
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
