import { useState } from "react";
import { getOrCreateDeviceId, setDeviceName, setStoreId } from "../lib/device";
import { saveLicense, type LicenseStatus } from "../lib/license";
import { markSetupComplete } from "../lib/setup";

type StoreRow = { id: string; name: string };

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await window.storelisten.getBackendUrl();
  const token = localStorage.getItem("storelisten_token");
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const json = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: T } | null;
  if (!response.ok) {
    throw new Error(json?.message || `Request failed (${response.status})`);
  }
  return (json?.data ?? json) as T;
}

export default function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [backendUrl, setBackendUrl] = useState("http://localhost:3000");
  const [licenseKey, setLicenseKey] = useState("");
  const [deviceName, setName] = useState("Front counter");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeId, setStore] = useState("");
  const [micOk, setMicOk] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveBackend(): Promise<void> {
    await window.storelisten.setBackendUrl(backendUrl);
    const status = await window.storelisten.getSyncStatus();
    if (!status.ok) throw new Error(status.message || "API is not reachable.");
  }

  async function activate(trial: boolean): Promise<void> {
    setBusy(true);
    setMessage("");
    try {
      await saveBackend();
      const data = await apiJson<LicenseStatus>("/api/license/activate", {
        method: "POST",
        body: JSON.stringify({
          trial,
          license_key: trial ? undefined : licenseKey,
          device_id: getOrCreateDeviceId(),
        }),
      });
      saveLicense(data);
      try {
        const list = await apiJson<StoreRow[]>("/api/stores");
        setStores(Array.isArray(list) ? list : []);
      } catch {
        setStores([]);
      }
      setStep(2);
    } catch (error) {
      if (trial) {
        const expires = new Date(Date.now() + 14 * 86_400_000).toISOString();
        saveLicense({
          license_key: "LOCAL-TRIAL",
          plan_type: "trial",
          max_stores: 1,
          max_users: 3,
          max_devices: 1,
          expires_at: expires,
          is_active: true,
          organization_id: null,
          days_left: 14,
          valid: true,
          expired: false,
        });
        setMessage(
          `${error instanceof Error ? error.message : "API unavailable."} A 14-day local trial is stored on this PC.`,
        );
        setStep(2);
      } else {
        setMessage(error instanceof Error ? error.message : "Activation failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function testMic(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicOk(true);
      setMessage("Microphone is working.");
    } catch {
      setMicOk(false);
      setMessage("Microphone access was denied.");
    }
  }

  function finish(): void {
    setDeviceName(deviceName);
    setStoreId(storeId || null);
    markSetupComplete();
    onDone();
  }

  const titles = ["Welcome", "License", "Store", "This device", "Microphone", "Ready"];

  return (
    <main className="shell setup">
      <p className="brand">StoreListen</p>
      <h1 className="status">{titles[step]}</h1>
      <p className="setup-step">Step {step + 1} of 6</p>

      {step === 0 ? (
        <>
          <p className="message">Record store conversations on this PC. AI analysis stays on your StoreListen server.</p>
          <label className="setup-field">
            API URL
            <input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary" onClick={() => setStep(1)}>
            <span>Next</span>
          </button>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <p className="message">Paste a license key from your organization owner, or start a 14-day trial.</p>
          <label className="setup-field">
            License key
            <input
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="SL-XXXX-XXXX-XXXX-XXXX"
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || licenseKey.trim().length < 8}
            onClick={() => void activate(false)}
          >
            <span>{busy ? "Activating…" : "Activate"}</span>
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void activate(true)}>
            Start 14-day trial
          </button>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <p className="message">
            {stores.length
              ? "Pick the store this recorder belongs to."
              : "No stores loaded (sign in on the dashboard later). You can skip this step."}
          </p>
          {stores.length ? (
            <label className="setup-field">
              Store
              <select value={storeId} onChange={(e) => setStore(e.target.value)}>
                <option value="">Select a store</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
            <span>Next</span>
          </button>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <p className="message">Name this recorder so managers can see it in Devices.</p>
          <label className="setup-field">
            Device name
            <input value={deviceName} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary" onClick={() => setStep(4)}>
            <span>Next</span>
          </button>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <p className="message">Allow microphone access so recordings can start.</p>
          <button type="button" className="btn btn-secondary" onClick={() => void testMic()}>
            Test microphone
          </button>
          <button type="button" className="btn btn-primary" disabled={micOk === false} onClick={() => setStep(5)}>
            <span>{micOk ? "Next" : "Skip for now"}</span>
          </button>
        </>
      ) : null}

      {step === 5 ? (
        <>
          <p className="message">You are ready to record. Sign in on the dashboard so this PC can upload with your token.</p>
          <button type="button" className="btn btn-primary" onClick={finish}>
            <span>Start recording</span>
          </button>
        </>
      ) : null}

      {message ? <p className="message">{message}</p> : null}
      {step > 0 && step < 5 ? (
        <button type="button" className="setup-back" onClick={() => setStep((value) => value - 1)}>
          Back
        </button>
      ) : null}
    </main>
  );
}
