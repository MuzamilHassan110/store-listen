import { useEffect, useRef } from "react";

type LiveCaptionsProps = {
  supported: boolean;
  listening: boolean;
  finalText: string;
  interimText: string;
  active: boolean;
  rtl?: boolean;
  suggestion?: string | null;
  onDismissSuggestion?: () => void;
};

export default function LiveCaptions({
  supported,
  listening,
  finalText,
  interimText,
  active,
  rtl = false,
  suggestion,
  onDismissSuggestion,
}: LiveCaptionsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [finalText, interimText]);

  let body = "Captions will appear here.";
  if (!supported) {
    body = "Live preview unavailable. Recording still works.";
  } else if (finalText || interimText) {
    body = "";
  } else if (listening) {
    body = "Listening...";
  } else if (active) {
    body = "Paused";
  }

  return (
    <section className={`captions${rtl ? " rtl" : ""}`} aria-live="polite" aria-label="Live captions">
      <p className="captions-label">Live captions</p>
      <div className="captions-scroll" ref={scrollerRef}>
        {body ? <p className="captions-placeholder">{body}</p> : null}
        {finalText || interimText ? (
          <p className="captions-text">
            {finalText}
            {interimText ? <span className="captions-interim"> {interimText}</span> : null}
          </p>
        ) : null}
      </div>
      {suggestion ? (
        <div className="suggestion-panel" role="alert">
          <div className="suggestion-content">
            <span className="suggestion-badge">AI Sales Tip</span>
            <p className="suggestion-text">{suggestion}</p>
          </div>
          {onDismissSuggestion ? (
            <button
              type="button"
              className="suggestion-dismiss"
              onClick={onDismissSuggestion}
              aria-label="Dismiss suggestion"
            >
              ✕
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
