/// <reference types="vite/client" />

type UploadRecordingResult =
  | { ok: true; status: number; conversationId?: string }
  | { ok: false; status: number; message: string };

declare global {
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
      uploadRecording: (payload: {
        bytes: ArrayBuffer;
        filename: string;
        mimeType: string;
        duration: number;
        transcript: string;
        language: string;
        deviceId: string;
        salesmanId: string | null;
        token: string | null;
      }) => Promise<UploadRecordingResult>;
    };
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }

  interface ImportMetaEnv {
    readonly VITE_BACKEND_URL?: string;
  }
}

export {};
