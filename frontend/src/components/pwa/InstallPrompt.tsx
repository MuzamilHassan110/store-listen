import { useEffect, useState } from "react";
import { Button } from "../ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone));
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHelp, setIosHelp] = useState(false);
  const [hidden, setHidden] = useState(() => localStorage.getItem("storelisten_install_dismissed") === "1");

  useEffect(() => {
    function onPrompt(event: Event): void {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || isStandalone()) return null;
  if (!deferred && !isIos()) return null;

  return (
    <div className="mb-4 rounded-xl border border-blue-800 bg-blue-950/50 px-4 py-3 text-sm text-blue-100">
      <p className="font-medium">Install StoreListen</p>
      {isIos() ? (
        <p className="mt-1 text-xs text-blue-200">
          iPhone / iPad: tap Share in Safari, then <span className="font-semibold">Add to Home Screen</span>.
        </p>
      ) : (
        <p className="mt-1 text-xs text-blue-200">
          Android Chrome: install the app for offline access and a home-screen icon.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {deferred ? (
          <Button
            size="sm"
            onClick={async () => {
              await deferred.prompt();
              setDeferred(null);
            }}
          >
            Install app
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setIosHelp((value) => !value)}>
            How to install
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            localStorage.setItem("storelisten_install_dismissed", "1");
            setHidden(true);
          }}
        >
          Not now
        </Button>
      </div>
      {iosHelp ? (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-blue-200">
          <li>Open this dashboard in Safari (not Chrome on iOS).</li>
          <li>Tap the Share button.</li>
          <li>Choose Add to Home Screen, then Add.</li>
        </ol>
      ) : null}
    </div>
  );
}
