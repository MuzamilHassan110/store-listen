import {
  localDb,
  pendingCount,
  pendingRecordings,
  readStoredAuthToken,
  saveAuthToken,
  type LocalRecording,
} from "../db/localDatabase";

export type SyncSnapshot = {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  lastError: string | null;
  message: string;
};

type Listener = (snapshot: SyncSnapshot) => void;

const listeners = new Set<Listener>();
let syncing = false;
let lastError: string | null = null;
let timer: number | null = null;
let started = false;

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function snapshot(): Promise<SyncSnapshot> {
  const pending = await pendingCount();
  const online = isOnline();
  let message = "All synced";
  if (!online) message = "Offline";
  else if (syncing) message = "Syncing…";
  else if (pending > 0) message = `${pending} pending upload${pending === 1 ? "" : "s"}`;
  return { online, pendingCount: pending, syncing, lastError, message };
}

async function emit(): Promise<void> {
  const current = await snapshot();
  for (const listener of listeners) listener(current);
}

export function subscribeSync(listener: Listener): () => void {
  listeners.add(listener);
  void emit();
  return () => {
    listeners.delete(listener);
  };
}

export async function getSyncSnapshot(): Promise<SyncSnapshot> {
  return snapshot();
}

export async function cacheAuthToken(token: string | null): Promise<void> {
  if (token) await saveAuthToken(token);
}

async function resolveToken(explicit?: string | null): Promise<string | null> {
  if (explicit) {
    await saveAuthToken(explicit);
    return explicit;
  }
  return readStoredAuthToken();
}

export async function saveRecordingLocally(input: {
  audioBlob: Blob;
  duration: number;
  transcript: string;
  language: string;
  deviceId: string;
  salesmanId: string | null;
  recordingHash: string;
  conversationId?: string | null;
}): Promise<number> {
  const id = await localDb.recordings.add({
    audioBlob: input.audioBlob,
    duration: input.duration,
    transcript: input.transcript,
    language: input.language,
    deviceId: input.deviceId,
    salesmanId: input.salesmanId,
    createdAt: new Date().toISOString(),
    uploadedAt: null,
    status: "pending",
    conversationId: input.conversationId ?? null,
    recordingHash: input.recordingHash,
    lastError: null,
  });
  await emit();
  return id;
}

async function uploadOne(row: LocalRecording, token: string): Promise<boolean> {
  if (row.id == null) return false;
  await localDb.recordings.update(row.id, { status: "uploading" });
  await emit();

  const bytes = await row.audioBlob.arrayBuffer();
  const result = await window.storelisten.uploadRecording({
    bytes,
    filename: `recording-${row.id}-${Date.parse(row.createdAt) || Date.now()}.webm`,
    mimeType: row.audioBlob.type || "audio/webm",
    duration: row.duration,
    transcript: row.transcript,
    language: row.language,
    deviceId: row.deviceId,
    salesmanId: row.salesmanId,
    recordingHash: row.recordingHash,
    conversationId: row.conversationId ?? undefined,
    token,
  });

  if (result.ok) {
    await localDb.recordings.update(row.id, {
      status: "synced",
      uploadedAt: new Date().toISOString(),
      conversationId: result.conversationId ?? row.conversationId ?? null,
      lastError: null,
    });
    lastError = null;
    await emit();
    return true;
  }

  await localDb.recordings.update(row.id, {
    status: "pending",
    lastError: result.message,
  });
  lastError = result.message;
  await emit();
  return false;
}

export async function syncPending(token?: string | null): Promise<SyncSnapshot> {
  if (syncing) return snapshot();
  if (!isOnline()) {
    lastError = null;
    await emit();
    return snapshot();
  }

  const auth = await resolveToken(token);
  if (!auth) {
    lastError = "No auth token. Sign in, then sync.";
    await emit();
    return snapshot();
  }

  syncing = true;
  await emit();
  try {
    const rows = await pendingRecordings();
    for (const row of rows) {
      const ok = await uploadOne(row, auth);
      if (!ok && !isOnline()) break;
    }
  } finally {
    syncing = false;
    await emit();
  }
  return snapshot();
}

export async function checkBackendReachable(): Promise<boolean> {
  try {
    const status = await window.storelisten.getSyncStatus();
    return status.ok && status.reachable;
  } catch {
    return false;
  }
}

export function startAutoSync(getToken: () => string | null): void {
  if (started) return;
  started = true;

  const tick = () => {
    if (!isOnline()) {
      void emit();
      return;
    }
    void syncPending(getToken());
  };

  window.addEventListener("online", () => {
    void emit();
    tick();
  });
  window.addEventListener("offline", () => {
    void emit();
  });

  timer = window.setInterval(tick, 30_000);
  tick();
}

export function stopAutoSync(): void {
  if (timer != null) {
    window.clearInterval(timer);
    timer = null;
  }
  started = false;
}
