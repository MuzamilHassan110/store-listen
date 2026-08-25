import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import LiveCaptions from "./components/LiveCaptions";
import { localDb } from "./db/localDatabase";
import { useLiveCaptions } from "./hooks/useLiveCaptions";
import { getOrCreateDeviceId, getSalesmanId } from "./lib/device";
import { CAPTION_LANGUAGES, isRtlLanguage, shortLanguageCode, type CaptionLanguage } from "./lib/language";
import {
  cacheAuthToken,
  saveRecordingLocally,
  startAutoSync,
  subscribeSync,
  syncPending,
  type SyncSnapshot,
} from "./services/sync.service";
import "./App.css";

type AppState = "idle" | "recording" | "paused" | "uploading" | "done" | "error";

const AUTH_KEYS = ["storelisten_token", "access_token", "token"] as const;

const STATUS_LABEL: Record<AppState, string> = {
  idle: "Idle",
  recording: "Recording",
  paused: "Paused",
  uploading: "Uploading",
  done: "Saved",
  error: "Upload failed",
};

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readAuthToken(): string | null {
  for (const key of AUTH_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

function pickMimeType(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function App() {
  const [state, setState] = useState<AppState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [message, setMessage] = useState("Ready to record a sales conversation.");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [captionLanguage, setCaptionLanguage] = useState<CaptionLanguage>(() =>
    shortLanguageCode(navigator.language),
  );
  const [sync, setSync] = useState<SyncSnapshot>({
    online: navigator.onLine,
    pendingCount: 0,
    syncing: false,
    lastError: null,
    message: navigator.onLine ? "All synced" : "Offline",
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const mimeTypeRef = useRef("audio/webm");
  const startedAtRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const deviceIdRef = useRef("");

  const captions = useLiveCaptions(captionLanguage);
  const pending = useLiveQuery(
    () => localDb.recordings.where("status").anyOf(["pending", "failed"]).count(),
    [],
  ) ?? sync.pendingCount;

  function clearTimer(): void {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer(fromMs: number): void {
    clearTimer();
    startedAtRef.current = Date.now() - fromMs;
    setElapsedMs(fromMs);
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
  }

  useEffect(() => {
    deviceIdRef.current = getOrCreateDeviceId();
    const token = readAuthToken();
    void cacheAuthToken(token);
    startAutoSync(readAuthToken);
    const unsubscribe = subscribeSync(setSync);
    return () => {
      unsubscribe();
      clearTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      stopStream(streamRef.current);
    };
  }, []);

  async function startRecording(): Promise<void> {
    setMessage("");
    setConversationId(null);
    chunksRef.current = [];
    blobRef.current = null;
    captions.reset();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mimeTypeRef.current = recorder.mimeType || "audio/webm";
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.start(1000);
      elapsedBeforePauseRef.current = 0;
      startTimer(0);
      captions.start();
      setState("recording");
      setMessage("Recording. Pause or stop when the conversation ends.");
    } catch (error) {
      setState("idle");
      setMessage(
        error instanceof Error ? error.message : "Microphone access was denied.",
      );
    }
  }

  function pauseRecording(): void {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    captions.stop();
    elapsedBeforePauseRef.current = Date.now() - startedAtRef.current;
    clearTimer();
    setElapsedMs(elapsedBeforePauseRef.current);
    setState("paused");
    setMessage("Paused. Resume to continue, or stop to upload.");
  }

  function resumeRecording(): void {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    captions.start();
    startTimer(elapsedBeforePauseRef.current);
    setState("recording");
    setMessage("Recording. Pause or stop when the conversation ends.");
  }

  function waitForStop(recorder: MediaRecorder): Promise<Blob> {
    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: mimeTypeRef.current }));
      };
      recorder.onerror = () => reject(new Error("Recording failed."));
      if (recorder.state === "inactive") {
        resolve(new Blob(chunksRef.current, { type: mimeTypeRef.current }));
        return;
      }
      recorder.stop();
    });
  }

  async function stopRecording(): Promise<void> {
    const recorder = recorderRef.current;
    captions.stop();
    clearTimer();
    const durationMs = recorder?.state === "paused" ? elapsedBeforePauseRef.current : elapsedMs;

    try {
      const blob = recorder ? await waitForStop(recorder) : blobRef.current;
      stopStream(streamRef.current);
      streamRef.current = null;
      recorderRef.current = null;
      if (!blob || blob.size === 0) {
        setState("idle");
        setMessage("Nothing was recorded. Try again.");
        return;
      }
      blobRef.current = blob;
      setElapsedMs(durationMs);
      await persistAndUpload(blob, durationMs);
    } catch (error) {
      stopStream(streamRef.current);
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not save the recording.");
    }
  }

  async function persistAndUpload(blob: Blob, durationMs: number): Promise<void> {
    const token = readAuthToken();
    void cacheAuthToken(token);
    const bytes = await blob.arrayBuffer();
    const recordingHash = await sha256Hex(bytes);
    const duration = Math.round(durationMs / 1000);
    const transcript = captions.getTranscript();

    await saveRecordingLocally({
      audioBlob: blob,
      duration,
      transcript,
      language: captionLanguage || captions.language,
      deviceId: deviceIdRef.current || getOrCreateDeviceId(),
      salesmanId: getSalesmanId(),
      recordingHash,
    });

    if (!navigator.onLine) {
      setState("done");
      setMessage("Saved locally (offline). It will upload when you are back online.");
      return;
    }

    if (!token) {
      setState("error");
      setMessage("Saved locally. Sign in, then tap Sync Now.");
      return;
    }

    setState("uploading");
    setMessage("Sending the recording to StoreListen…");
    const result = await syncPending(token);
    if (result.pendingCount === 0 && !result.lastError) {
      setState("done");
      setMessage("Recording uploaded.");
      return;
    }

    setState("done");
    setMessage(
      result.lastError
        ? `Saved locally (offline). ${result.lastError}`
        : "Saved locally. Sync is still pending.",
    );
  }

  async function retryUpload(): Promise<void> {
    setState("uploading");
    const result = await syncPending(readAuthToken());
    if (result.pendingCount === 0 && !result.lastError) {
      setState("done");
      setMessage("Recording uploaded.");
      return;
    }
    setState("error");
    setMessage(result.lastError ?? "Saved locally. Sync is still pending.");
  }

  async function handleSyncNow(): Promise<void> {
    const result = await syncPending(readAuthToken());
    if (result.pendingCount === 0) {
      setMessage("All recordings synced.");
      return;
    }
    setMessage(result.lastError ?? `${result.pendingCount} pending uploads.`);
  }

  function reset(): void {
    chunksRef.current = [];
    blobRef.current = null;
    setElapsedMs(0);
    setConversationId(null);
    captions.reset();
    setState("idle");
    setMessage("Ready to record a sales conversation.");
  }

  const primary =
    state === "idle"
      ? { label: "Start", action: () => void startRecording(), disabled: false }
      : state === "recording"
        ? { label: "Stop", action: () => void stopRecording(), disabled: false }
        : state === "paused"
          ? { label: "Resume", action: resumeRecording, disabled: false }
          : state === "uploading"
            ? { label: "Uploading…", action: () => undefined, disabled: true }
            : state === "done"
              ? { label: "New recording", action: reset, disabled: false }
              : { label: "Retry upload", action: () => void retryUpload(), disabled: false };

  const secondary =
    state === "recording"
      ? { label: "Pause", action: pauseRecording }
      : state === "paused"
        ? { label: "Stop", action: () => void stopRecording() }
        : null;

  const captionsActive = state === "recording" || state === "paused";
  const syncTone = !sync.online ? "offline" : pending > 0 || sync.syncing ? "pending" : "synced";

  return (
    <main className={`shell state-${state}`}>
      <header className="topbar">
        <p className="brand">StoreListen</p>
        <div className="topbar-actions">
          <span className={`net-dot ${sync.online ? "online" : "offline"}`} title={sync.online ? "Online" : "Offline"} />
          <span className={`sync-status tone-${syncTone}`}>
            {!sync.online ? "Offline" : sync.syncing ? "Syncing" : pending > 0 ? `${pending} pending` : "All synced"}
          </span>
          {pending > 0 ? <span className="pending-badge">{pending}</span> : null}
          <button
            type="button"
            className="sync-btn"
            disabled={sync.syncing || !sync.online}
            onClick={() => void handleSyncNow()}
          >
            {sync.syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
      </header>
      <label className="lang-row">
        <span>Language</span>
        <select
          value={captionLanguage}
          disabled={captionsActive}
          onChange={(event) => setCaptionLanguage(shortLanguageCode(event.target.value))}
        >
          {CAPTION_LANGUAGES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <h1 className="status">{STATUS_LABEL[state]}</h1>
      <p className="timer" aria-live="polite">
        {formatTime(elapsedMs)}
      </p>
      <div className={`dot${state === "recording" ? " recording" : ""}`} aria-hidden="true" />
      <LiveCaptions
        supported={captions.supported}
        listening={captions.listening}
        finalText={captions.finalText}
        interimText={captions.interimText}
        active={captionsActive}
        rtl={isRtlLanguage(captionLanguage)}
      />
      <p className="message">{message}</p>
      {conversationId ? <p className="conversation-id">{conversationId}</p> : null}
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={primary.disabled}
          onClick={primary.action}
        >
          <span>{primary.label}</span>
        </button>
        {secondary ? (
          <button type="button" className="btn btn-secondary" onClick={secondary.action}>
            {secondary.label}
          </button>
        ) : null}
      </div>
    </main>
  );
}
