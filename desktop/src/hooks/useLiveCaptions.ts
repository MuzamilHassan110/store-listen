import { useCallback, useEffect, useRef, useState } from "react";
import { shortLanguageCode } from "../lib/language";

type SpeechCtor = new () => SpeechRecognition;

function getSpeechCtor(): SpeechCtor | null {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function useLiveCaptions() {
  const [supported] = useState(() => getSpeechCtor() != null);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState(() => shortLanguageCode(navigator.language));

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRunRef = useRef(false);
  const finalTextRef = useRef("");

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    setListening(false);
    setInterimText("");
    try {
      recognitionRef.current?.stop();
    } catch {
      // already stopped
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    finalTextRef.current = "";
    setFinalText("");
    setInterimText("");
  }, [stop]);

  const start = useCallback(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;

    shouldRunRef.current = true;
    const lang = navigator.language || "en-US";
    setLanguage(shortLanguageCode(lang));

    if (!recognitionRef.current) {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = lang;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let appended = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const piece = result?.[0]?.transcript ?? "";
          if (result?.isFinal) appended += `${piece} `;
          else interim += piece;
        }
        if (appended) {
          finalTextRef.current = `${finalTextRef.current}${appended}`.replace(/\s+/g, " ").trim();
          setFinalText(finalTextRef.current);
        }
        setInterimText(interim.trim());
      };

      recognition.onerror = () => {
        setListening(false);
      };

      recognition.onend = () => {
        if (shouldRunRef.current) {
          try {
            recognition.start();
            setListening(true);
          } catch {
            setListening(false);
          }
        } else {
          setListening(false);
        }
      };

      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
      setListening(true);
    } catch {
      // start() throws if already started
    }
  }, []);

  useEffect(() => {
    return () => {
      shouldRunRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  return {
    supported,
    listening,
    finalText,
    interimText,
    language,
    transcript: finalText,
    start,
    stop,
    reset,
    getTranscript: () => finalTextRef.current,
  };
}
