import { useEffect, useRef, useState } from "react";
import LiveCaptions from "./components/LiveCaptions";
import { useLiveCaptions } from "./hooks/useLiveCaptions";
import { getOrCreateDeviceId, getSalesmanId } from "./lib/device";
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

export default function App() {
  const [state, setState] = useState<AppState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [message, setMessage] = useState("Ready to record a sales conversation.");
  const [conversationId, setConversationId] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const mimeTypeRef = useRef("audio/webm");
  const startedAtRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const deviceIdRef = useRef("");

  const captions = useLiveCaptions();

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
    return () => {
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
      await uploadBlob(blob, durationMs);
    } catch (error) {
      stopStream(streamRef.current);
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not save the recording.");
    }
  }

  async function uploadBlob(blob: Blob, durationMs: number): Promise<void> {
    const token = readAuthToken();
    if (!token) {
      setState("error");
      setMessage("No auth token. Sign in, then retry.");
      return;
    }

    setState("uploading");
    setMessage("Sending the recording to StoreListen…");

    const bytes = await blob.arrayBuffer();
    const result = await window.storelisten.uploadRecording({
      bytes,
      filename: `recording-${Date.now()}.webm`,
      mimeType: blob.type || mimeTypeRef.current,
      duration: Math.round(durationMs / 1000),
      transcript: captions.getTranscript(),
      language: captions.language,
      deviceId: deviceIdRef.current || getOrCreateDeviceId(),
      salesmanId: getSalesmanId(),
      token,
    });

    if (result.ok) {
      setConversationId(result.conversationId ?? null);
      setState("done");
      setMessage(
        result.conversationId
          ? `Recording uploaded (${result.conversationId.slice(0, 8)}).`
          : "Recording uploaded.",
      );
      return;
    }

    setState("error");
    if (result.status === 0) {
      setMessage("The backend is not reachable. Start it, then retry.");
      return;
    }
    if (result.status === 401) {
      setMessage("Auth token was rejected. Sign in again, then retry.");
      return;
    }
    if (result.status === 413) {
      setMessage("Recording is too large to upload.");
      return;
    }
    setMessage(result.message);
  }

  async function retryUpload(): Promise<void> {
    if (!blobRef.current) {
      setState("idle");
      setMessage("No recording to retry. Start a new one.");
      return;
    }
    await uploadBlob(blobRef.current, elapsedMs);
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

  return (
    <main className={`shell state-${state}`}>
      <p className="brand">StoreListen</p>
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
