import { useCallback, useEffect, useRef, useState } from "react";
import { shortLanguageCode } from "../lib/language";
import { sendStreamChunkApi } from "../services/api.service";

const CHUNK_DURATION_MS = 4000;
const SUGGESTION_AUTODISMISS_MS = 20000;

function pickMimeType(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm"];
  return types.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) ?? "audio/webm";
}

export function useStreamingCaptions(preferredLanguage?: string) {
  const [supported, setSupported] = useState(true);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState(() => shortLanguageCode(preferredLanguage ?? (typeof navigator !== "undefined" ? navigator.language : "en")));

  const finalTextRef = useRef("");
  const suggestionTimerRef = useRef<number | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const isRunningRef = useRef(false);
  const activeRecorderRef = useRef<MediaRecorder | null>(null);
  const loopTimeoutRef = useRef<number | null>(null);

  const clearSuggestionTimer = useCallback(() => {
    if (suggestionTimerRef.current != null) {
      window.clearTimeout(suggestionTimerRef.current);
      suggestionTimerRef.current = null;
    }
  }, []);

  const dismissSuggestion = useCallback(() => {
    clearSuggestionTimer();
    setSuggestion(null);
  }, [clearSuggestionTimer]);

  const showSuggestion = useCallback((text: string) => {
    clearSuggestionTimer();
    setSuggestion(text);
    suggestionTimerRef.current = window.setTimeout(() => {
      setSuggestion(null);
      suggestionTimerRef.current = null;
    }, SUGGESTION_AUTODISMISS_MS);
  }, [clearSuggestionTimer]);

  const stopActiveChunk = useCallback(() => {
    if (loopTimeoutRef.current != null) {
      window.clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    if (activeRecorderRef.current && activeRecorderRef.current.state !== "inactive") {
      try {
        activeRecorderRef.current.stop();
      } catch {
        // ignore
      }
      activeRecorderRef.current = null;
    }
  }, []);

  const recordAndSendOneChunk = useCallback(() => {
    if (!isRunningRef.current || !activeStreamRef.current) return;

    const stream = activeStreamRef.current;
    const mimeType = pickMimeType();
    const chunks: Blob[] = [];

    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      setSupported(false);
      return;
    }

    activeRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = async () => {
      if (!isRunningRef.current) return;
      const chunkBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });

      if (chunkBlob.size > 0 && conversationIdRef.current) {
        try {
          const result = await sendStreamChunkApi({
            conversationId: conversationIdRef.current,
            chunkBlob,
            transcriptContext: finalTextRef.current,
            token: tokenRef.current,
          });

          if (result && !result.error) {
            setSupported(true);
            if (result.transcriptDelta) {
              const delta = result.transcriptDelta.trim();
              if (delta) {
                finalTextRef.current = finalTextRef.current
                  ? `${finalTextRef.current} ${delta}`
                  : delta;
                setFinalText(finalTextRef.current);
              }
            }
            if (result.suggestion) {
              showSuggestion(result.suggestion);
            }
          }
        } catch {
          // Transient chunk error: continue streaming next chunk
        }
      }

      // Schedule next chunk if still running
      if (isRunningRef.current) {
        loopTimeoutRef.current = window.setTimeout(() => {
          recordAndSendOneChunk();
        }, 300);
      }
    };

    try {
      recorder.start();
      loopTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, CHUNK_DURATION_MS);
    } catch {
      setSupported(false);
    }
  }, [showSuggestion]);

  const start = useCallback(
    (stream: MediaStream, conversationId: string | null, token: string | null, lang?: string) => {
      stopActiveChunk();
      isRunningRef.current = true;
      activeStreamRef.current = stream;
      conversationIdRef.current = conversationId;
      tokenRef.current = token;
      if (lang) setLanguage(shortLanguageCode(lang));
      setListening(true);
      setSupported(true);
      setInterimText("");

      if (conversationId) {
        // Start streaming chunks
        recordAndSendOneChunk();
      } else {
        setSupported(false);
      }
    },
    [recordAndSendOneChunk, stopActiveChunk],
  );

  const pause = useCallback(() => {
    isRunningRef.current = false;
    stopActiveChunk();
    setListening(false);
  }, [stopActiveChunk]);

  const resume = useCallback(
    (stream: MediaStream, conversationId: string | null, token: string | null) => {
      stopActiveChunk();
      isRunningRef.current = true;
      activeStreamRef.current = stream;
      conversationIdRef.current = conversationId;
      tokenRef.current = token;
      setListening(true);
      if (conversationId) {
        recordAndSendOneChunk();
      }
    },
    [recordAndSendOneChunk, stopActiveChunk],
  );

  const stop = useCallback(() => {
    isRunningRef.current = false;
    stopActiveChunk();
    setListening(false);
    activeStreamRef.current = null;
  }, [stopActiveChunk]);

  const reset = useCallback(() => {
    stop();
    clearSuggestionTimer();
    finalTextRef.current = "";
    setFinalText("");
    setInterimText("");
    setSuggestion(null);
    setSupported(true);
  }, [clearSuggestionTimer, stop]);

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      stopActiveChunk();
      clearSuggestionTimer();
    };
  }, [clearSuggestionTimer, stopActiveChunk]);

  return {
    supported,
    listening,
    finalText,
    interimText,
    suggestion,
    language,
    transcript: finalText,
    start,
    pause,
    resume,
    stop,
    reset,
    dismissSuggestion,
    getTranscript: () => finalTextRef.current,
  };
}
