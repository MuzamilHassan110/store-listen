import { contextBridge, ipcRenderer } from "electron";

export type UploadRecordingPayload = {
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
};

export type UploadRecordingResult =
  | { ok: true; status: number; conversationId?: string }
  | { ok: false; status: number; message: string };

export type SyncStatusResult =
  | { ok: true; reachable: boolean; serverTime?: string; version?: string }
  | { ok: false; reachable: false; message: string };

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

export type DesktopSettings = {
  backendUrl: string;
  autoUpdate: boolean;
  channel: "latest" | "beta";
  installOnQuit: boolean;
};

const api = {
  getBackendUrl: (): Promise<string> => ipcRenderer.invoke("config:getBackendUrl"),
  setBackendUrl: (url: string): Promise<string> => ipcRenderer.invoke("config:setBackendUrl", url),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
  isPackaged: (): Promise<boolean> => ipcRenderer.invoke("app:isPackaged"),
  getSyncStatus: (): Promise<SyncStatusResult> => ipcRenderer.invoke("sync:status"),
  uploadRecording: (payload: UploadRecordingPayload): Promise<UploadRecordingResult> =>
    ipcRenderer.invoke("recordings:upload", payload),
  getUpdateStatus: (): Promise<UpdatePayload> => ipcRenderer.invoke("update:status"),
  checkForUpdates: (): Promise<UpdatePayload> => ipcRenderer.invoke("update:check"),
  installUpdate: (): Promise<void> => ipcRenderer.invoke("update:install"),
  setAutoUpdate: (enabled: boolean): Promise<DesktopSettings> => ipcRenderer.invoke("update:setAuto", enabled),
  setUpdateChannel: (channel: "latest" | "beta"): Promise<DesktopSettings> =>
    ipcRenderer.invoke("update:setChannel", channel),
  getDesktopSettings: (): Promise<DesktopSettings> => ipcRenderer.invoke("update:getSettings"),
  onUpdateEvent: (listener: (payload: UpdatePayload) => void): (() => void) => {
    const handler = (_event: unknown, payload: UpdatePayload) => listener(payload);
    ipcRenderer.on("update:event", handler);
    return () => ipcRenderer.removeListener("update:event", handler);
  },
};

contextBridge.exposeInMainWorld("storelisten", api);

export type StoreListenAPI = typeof api;
