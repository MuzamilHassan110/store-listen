/// <reference types="vite/client" />

type UploadRecordingResult =
  | { ok: true; status: number; conversationId?: string }
  | { ok: false; status: number; message: string };

declare global {
  type UpdatePayload = {
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

  type DesktopSettings = {
    backendUrl: string;
    autoUpdate: boolean;
    channel: "latest" | "beta";
    installOnQuit: boolean;
  };

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }

  interface Window {
    storelisten: {
      getBackendUrl: () => Promise<string>;
      setBackendUrl: (url: string) => Promise<string>;
      getAppVersion: () => Promise<string>;
      isPackaged: () => Promise<boolean>;
      getSyncStatus: () => Promise<
        | { ok: true; reachable: boolean; serverTime?: string; version?: string }
        | { ok: false; reachable: false; message: string }
      >;
      uploadRecording: (payload: {
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
      }) => Promise<UploadRecordingResult>;
      getUpdateStatus: () => Promise<UpdatePayload>;
      checkForUpdates: () => Promise<UpdatePayload>;
      installUpdate: () => Promise<void>;
      setAutoUpdate: (enabled: boolean) => Promise<DesktopSettings>;
      setUpdateChannel: (channel: "latest" | "beta") => Promise<DesktopSettings>;
      getDesktopSettings: () => Promise<DesktopSettings>;
      onUpdateEvent: (listener: (payload: UpdatePayload) => void) => () => void;
    };
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }

  interface ImportMetaEnv {
    readonly VITE_BACKEND_URL?: string;
  }
}

export {};
