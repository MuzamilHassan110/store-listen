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
  token: string | null;
};

export type UploadRecordingResult =
  | { ok: true; status: number; conversationId?: string }
  | { ok: false; status: number; message: string };

const api = {
  getBackendUrl: (): Promise<string> => ipcRenderer.invoke("config:getBackendUrl"),
  uploadRecording: (payload: UploadRecordingPayload): Promise<UploadRecordingResult> =>
    ipcRenderer.invoke("recordings:upload", payload),
};

contextBridge.exposeInMainWorld("storelisten", api);

export type StoreListenAPI = typeof api;
