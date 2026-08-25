import Dexie, { type Table } from "dexie";

export type LocalRecordingStatus = "pending" | "uploading" | "synced" | "failed";

export type LocalRecording = {
  id?: number;
  audioBlob: Blob;
  duration: number;
  transcript: string;
  language: string;
  deviceId: string;
  salesmanId: string | null;
  createdAt: string;
  uploadedAt: string | null;
  status: LocalRecordingStatus;
  conversationId: string | null;
  recordingHash: string;
  lastError: string | null;
};

export type LocalSetting = {
  key: string;
  value: string;
};

export type LocalAuthToken = {
  id: string;
  token: string;
  userId: string;
  expiresAt: string;
};

class StoreListenDatabase extends Dexie {
  recordings!: Table<LocalRecording, number>;
  settings!: Table<LocalSetting, string>;
  authToken!: Table<LocalAuthToken, string>;

  constructor() {
    super("storelisten-offline");
    this.version(1).stores({
      recordings: "++id, status, createdAt, recordingHash, uploadedAt",
      settings: "key",
      authToken: "id",
    });
  }
}

export const localDb = new StoreListenDatabase();

export async function getSetting(key: string): Promise<string | null> {
  const row = await localDb.settings.get(key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await localDb.settings.put({ key, value });
}

export async function saveAuthToken(token: string, userId = "", expiresAt = ""): Promise<void> {
  await localDb.authToken.put({ id: "current", token, userId, expiresAt });
}

export async function readStoredAuthToken(): Promise<string | null> {
  const row = await localDb.authToken.get("current");
  return row?.token ?? null;
}

export async function pendingRecordings(): Promise<LocalRecording[]> {
  return localDb.recordings.filter((row) => row.status === "pending" || row.status === "failed").toArray();
}

export async function pendingCount(): Promise<number> {
  return localDb.recordings.filter((row) => row.status === "pending" || row.status === "failed").count();
}
