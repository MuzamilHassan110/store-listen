import { useEffect, useState } from "react";
import { isLicenseValid, readLicense } from "../lib/license";

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const license = readLicense();
  const [version, setVersion] = useState("1.0.0");
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [backendUrl, setBackendUrl] = useState("");
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void window.storelisten.getAppVersion().then(setVersion);
    void window.storelisten.getBackendUrl().then(setBackendUrl);
    void window.storelisten.getDesktopSettings().then(setSettings);
  }, []);

  async function saveUrl(): Promise<void> {
    await window.storelisten.setBackendUrl(backendUrl);
    setMessage("API URL saved.");
  }

  async function check(): Promise<void> {
    setChecking(true);
    const result = await window.storelisten.checkForUpdates();
    setChecking(false);
    setMessage(result.message || result.status);
  }

  const valid = isLicenseValid(license);

  return (
    <div className="settings-panel">
      <div className="settings-head">
        <h2>Settings</h2>
        <button type="button" onClick={onClose} aria-label="Close settings">
          ×
        </button>
      </div>
      <p className="settings-row">
        Version <strong>{version}</strong>
      </p>
      <label className="setup-field">
        API URL
        <input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} />
      </label>
      <button type="button" className="btn btn-secondary" onClick={() => void saveUrl()}>
        Save API URL
      </button>
      <label className="settings-check">
        <input
          type="checkbox"
          checked={settings?.autoUpdate !== false}
          onChange={(e) => {
            void window.storelisten.setAutoUpdate(e.target.checked).then(setSettings);
          }}
        />
        Auto-update
      </label>
      <label className="setup-field">
        Channel
        <select
          value={settings?.channel ?? "latest"}
          onChange={(e) => {
            const channel = e.target.value === "beta" ? "beta" : "latest";
            void window.storelisten.setUpdateChannel(channel).then(setSettings);
          }}
        >
          <option value="latest">Stable</option>
          <option value="beta">Beta</option>
        </select>
      </label>
      <button type="button" className="btn btn-secondary" disabled={checking} onClick={() => void check()}>
        {checking ? "Checking…" : "Check for updates"}
      </button>
      <div className="license-card">
        <p className="captions-label">License</p>
        <p>{license ? `${license.plan_type} · ${valid ? "active" : "inactive"}` : "Not activated"}</p>
        {license?.days_left != null ? <p>{license.days_left} days left</p> : null}
        {license?.license_key ? <p className="conversation-id">{license.license_key}</p> : null}
      </div>
      {message ? <p className="message">{message}</p> : null}
    </div>
  );
}
