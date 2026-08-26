import { useEffect, useState } from "react";

export default function UpdateBanner({ forceMessage }: { forceMessage?: string | null }) {
  const [payload, setPayload] = useState<UpdatePayload>({ status: "idle" });
  const [later, setLater] = useState(false);

  useEffect(() => {
    void window.storelisten.getUpdateStatus().then(setPayload);
    return window.storelisten.onUpdateEvent(setPayload);
  }, []);

  if (forceMessage) {
    return (
      <div className="update-banner force" role="alert">
        <p>{forceMessage}</p>
      </div>
    );
  }

  if (later || (payload.status !== "downloading" && payload.status !== "downloaded" && payload.status !== "available")) {
    return null;
  }

  const percent = Math.round(payload.percent ?? 0);

  return (
    <div className="update-banner" role="status">
      {payload.status === "downloading" ? (
        <>
          <p>Downloading update… {percent}%</p>
          <div className="update-bar">
            <span style={{ width: `${percent}%` }} />
          </div>
        </>
      ) : payload.status === "downloaded" ? (
        <>
          <p>Version {payload.version ?? ""} is ready.</p>
          <div className="update-actions">
            <button type="button" onClick={() => void window.storelisten.installUpdate()}>
              Restart to update
            </button>
            <button type="button" className="later" onClick={() => setLater(true)}>
              Later
            </button>
          </div>
        </>
      ) : (
        <p>Update {payload.version} is available and will download in the background.</p>
      )}
    </div>
  );
}
