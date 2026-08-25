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

const api = {
  getBackendUrl: (): Promise<string> => ipcRenderer.invoke("config:getBackendUrl"),
  getSyncStatus: (): Promise<SyncStatusResult> => ipcRenderer.invoke("sync:status"),
  uploadRecording: (payload: UploadRecordingPayload): Promise<UploadRecordingResult> =>
    ipcRenderer.invoke("recordings:upload", payload),
};

contextBridge.exposeInMainWorld("storelisten", api);

export type StoreListenAPI = typeof api;
