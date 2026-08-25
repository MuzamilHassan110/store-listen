import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { Button } from "../ui/button";

const KEY = "storelisten_push_asked";

export function PushPermission() {
  const { session } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification === "undefined" ? "denied" : Notification.permission,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!session || typeof Notification === "undefined") return;
    if (Notification.permission === "granted" || localStorage.getItem(KEY) === "1") return;
    setVisible(true);
  }, [session]);

  if (!visible || permission === "granted" || permission === "denied") return null;

  return (
    <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
      <p className="font-medium">Enable push notifications</p>
      <p className="mt-1 text-xs text-slate-400">Get alerts for high-intent leads and follow-ups due.</p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={async () => {
            const next = await Notification.requestPermission();
            setPermission(next);
            localStorage.setItem(KEY, "1");
            setVisible(false);
          }}
        >
          Allow
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            localStorage.setItem(KEY, "1");
            setVisible(false);
          }}
        >
          Later
        </Button>
      </div>
    </div>
  );
}
