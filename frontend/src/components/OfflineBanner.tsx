import { useEffect, useState } from "react";
import { flushOfflineQueue } from "../lib/offline-queue";

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      void flushOfflineQueue();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div role="status" className="mb-4 rounded-lg border border-amber-800 bg-amber-950/70 px-4 py-2 text-sm text-amber-100">
      You are offline. Cached pages still work; new recordings will sync when you reconnect.
    </div>
  );
}
