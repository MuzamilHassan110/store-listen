import { useEffect, useState } from "react";
import { isLicenseValid, readLicense } from "../lib/license";
import { cacheAuthToken } from "../services/sync.service";

const AUTH_KEYS = ["storelisten_token", "access_token", "token"] as const;

function getStoredToken(): string | null {
  for (const key of AUTH_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const license = readLicense();
  const [version, setVersion] = useState("1.0.0");
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [backendUrl, setBackendUrl] = useState("");
  const [authToken, setAuthToken] = useState(() => getStoredToken() ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
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

  async function handleLogin(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    if (!email.trim() || !password) {
      setAuthError("Please enter both email and password.");
      return;
    }
    setAuthBusy(true);
    try {
      const base = (backendUrl.trim() || "http://localhost:3000").replace(/\/+$/, "");
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        data?: { access_token?: string; token?: string; status?: string; temp_token?: string };
      } | null;

      const token = json?.data?.access_token || json?.data?.token;

      if (!res.ok || !token) {
        throw new Error(json?.message || `Login failed (Status: ${res.status})`);
      }

      localStorage.setItem("storelisten_token", token);
      await cacheAuthToken(token);
      setAuthToken(token);
      setEmail("");
      setPassword("");
      setAuthSuccess("✓ Signed in successfully! Closing settings…");
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSaveToken(): Promise<void> {
    setAuthError("");
    setAuthSuccess("");
    const trimmed = authToken.trim();
    if (trimmed) {
      localStorage.setItem("storelisten_token", trimmed);
      await cacheAuthToken(trimmed);
      setAuthSuccess("Auth token saved!");
      setTimeout(() => {
        onClose();
      }, 600);
    } else {
      for (const key of AUTH_KEYS) {
        localStorage.removeItem(key);
      }
      await cacheAuthToken(null);
      setAuthToken("");
      setMessage("Auth token cleared.");
    }
  }

  async function handleSignOut(): Promise<void> {
    for (const key of AUTH_KEYS) {
      localStorage.removeItem(key);
    }
    await cacheAuthToken(null);
    setAuthToken("");
    setAuthSuccess("");
    setAuthError("");
    setMessage("Signed out.");
  }

  async function check(): Promise<void> {
    setChecking(true);
    const result = await window.storelisten.checkForUpdates();
    setChecking(false);
    setMessage(result.message || result.status);
  }

  const valid = isLicenseValid(license);
  const isSignedIn = Boolean(authToken.trim());

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

      {/* Account / Authentication */}
      <div className="license-card">
        <p className="captions-label">Account & Login</p>
        {isSignedIn ? (
          <div>
            <p style={{ color: "#34d399", fontWeight: 600, margin: "4px 0" }}>✓ Signed In (Token active)</p>
            <p className="conversation-id" style={{ margin: "4px 0 10px", wordBreak: "break-all" }}>
              {authToken.slice(0, 16)}...{authToken.slice(-8)}
            </p>
            <button type="button" className="btn btn-secondary" onClick={() => void handleSignOut()}>
              Sign Out
            </button>
          </div>
        ) : (
          <div>
            <form onSubmit={(e) => void handleLogin(e)} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label className="setup-field">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sales@store.com"
                  autoComplete="email"
                />
              </label>
              <label className="setup-field">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={authBusy}>
                <span>{authBusy ? "Signing in…" : "Sign In"}</span>
              </button>
            </form>

            {authError ? (
              <div
                style={{
                  marginTop: "8px",
                  padding: "8px 10px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "6px",
                  color: "#fca5a5",
                  fontSize: "12px",
                  lineHeight: "1.4",
                }}
              >
                <strong>Error:</strong> {authError}
              </div>
            ) : null}

            {authSuccess ? (
              <div
                style={{
                  marginTop: "8px",
                  padding: "8px 10px",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  borderRadius: "6px",
                  color: "#6ee7b7",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {authSuccess}
              </div>
            ) : null}

            <div style={{ marginTop: "12px", borderTop: "1px solid #333", paddingTop: "8px" }}>
              <label className="setup-field">
                Or Paste User JWT Token
                <input
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="eyJhbGciOi..."
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: "4px" }}
                onClick={() => void handleSaveToken()}
              >
                Save Token
              </button>
            </div>
          </div>
        )}
      </div>

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
