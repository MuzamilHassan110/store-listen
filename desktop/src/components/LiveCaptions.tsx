import { useEffect, useRef } from "react";

type LiveCaptionsProps = {
  supported: boolean;
  listening: boolean;
  finalText: string;
  interimText: string;
  active: boolean;
};

export default function LiveCaptions({
  supported,
  listening,
  finalText,
  interimText,
  active,
}: LiveCaptionsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [finalText, interimText]);

  let body = "Captions will appear here.";
  if (!supported) {
    body = "Live captions are not supported on this device. Recording still works.";
  } else if (finalText || interimText) {
    body = "";
  } else if (listening) {
    body = "Listening...";
  } else if (active) {
    body = "Paused";
  }

  return (
    <section className="captions" aria-live="polite" aria-label="Live captions">
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
    </section>
  );
}
