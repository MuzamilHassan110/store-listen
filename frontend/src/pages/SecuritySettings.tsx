import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changePassword,
  disableTwoFactor,
  fetchSessions,
  fetchTwoFactorStatus,
  revokeAllSessions,
  revokeSession,
  setupTwoFactor,
  verifyTwoFactorSetup,
} from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { ErrorState } from "../components/States";

function passwordScore(value: string): number {
  let score = 0;
  if (value.length >= 8) score += 25;
  if (value.length >= 12) score += 15;
  if (/[A-Z]/.test(value)) score += 20;
  if (/[0-9]/.test(value)) score += 20;
  if (/[^A-Za-z0-9]/.test(value)) score += 20;
  return Math.min(100, score);
}

export default function SecuritySettings() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const deviceToken = localStorage.getItem("storelisten_device_token");
  const status = useQuery({ queryKey: ["2fa-status"], queryFn: () => fetchTwoFactorStatus(deviceToken) });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: fetchSessions });
  const [step, setStep] = useState(0);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [password, setPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");

  const setup = useMutation({
    mutationFn: setupTwoFactor,
    onSuccess: (data) => {
      setQr(data.qr_code_url);
      setSecret(data.secret);
      setBackupCodes(data.backup_codes);
      setStep(2);
    },
  });
  const enable = useMutation({
    mutationFn: () => verifyTwoFactorSetup(code),
    onSuccess: () => {
      setStep(4);
      void queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
    },
  });
  const disable = useMutation({
    mutationFn: () => disableTwoFactor(disableCode),
    onSuccess: () => {
      setDisableCode("");
      void queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
    },
  });
  const savePassword = useMutation({ mutationFn: () => changePassword(password) });
  const revokeOne = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
  const revokeAll = useMutation({
    mutationFn: revokeAllSessions,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const score = useMemo(() => passwordScore(password), [password]);
  const securityScore = status.data?.enabled ? 80 : 45;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pages.security")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("pages.securityHint")}</p>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase text-slate-500">Security score</p>
            <p className="mt-1 text-3xl font-semibold">{securityScore}</p>
          </div>
          <p className="text-sm text-slate-400">
            {status.data?.enabled ? "2FA is on. Keep backup codes offline." : "Enable 2FA to raise this score."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {status.isError ? <ErrorState message={status.error.message} onRetry={() => void status.refetch()} /> : null}
          {status.data?.enabled ? (
            <>
              <p className="text-sm text-emerald-300">Authenticator app is enabled for this account.</p>
              <Input placeholder="Authenticator or backup code" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />
              <Button variant="danger" onClick={() => disable.mutate()} disabled={disable.isPending || !disableCode}>
                Disable 2FA
              </Button>
            </>
          ) : (
            <>
              {step === 0 ? (
                <Button onClick={() => { setStep(1); setup.mutate(); }}>Start 2FA setup</Button>
              ) : null}
              {step === 1 ? <Skeleton className="h-40" /> : null}
              {step >= 2 && qr ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-300">1. Scan this QR in Google Authenticator or 1Password.</p>
                  <img src={qr} alt="2FA QR" className="h-48 w-48 rounded-lg bg-white p-2" />
                  <p className="break-all text-xs text-slate-500">Manual key: {secret}</p>
                  <p className="text-sm text-slate-300">2. Enter the 6-digit code to enable 2FA.</p>
                  <Input placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
                  <Button onClick={() => enable.mutate()} disabled={enable.isPending || code.length < 6}>
                    Verify and enable
                  </Button>
                  {enable.isError ? <p className="text-sm text-red-300">{enable.error.message}</p> : null}
                </div>
              ) : null}
              {step === 4 ? (
                <div className="rounded-xl border border-amber-700 bg-amber-950/40 p-4 text-sm">
                  <p className="font-medium text-amber-200">Store these backup codes now. They are shown once.</p>
                  <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-amber-100">
                    {backupCodes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-emerald-400" style={{ width: `${score}%` }} />
          </div>
          <p className="text-xs text-slate-500">Strength {score}%. Use 12+ characters with numbers and symbols.</p>
          <Button onClick={() => savePassword.mutate()} disabled={password.length < 8 || savePassword.isPending}>
            Update password
          </Button>
          {savePassword.isSuccess ? <p className="text-sm text-emerald-300">Password updated.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.isLoading ? <Skeleton className="h-24" /> : null}
          {(sessions.data ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950 px-3 py-2 text-sm">
              <div>
                <p>{item.ip_address || "Unknown IP"}</p>
                <p className="text-xs text-slate-500">{item.user_agent || "Unknown device"}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => revokeOne.mutate(item.id)}>
                Revoke
              </Button>
            </div>
          ))}
          <Button variant="danger" onClick={() => revokeAll.mutate()}>
            Revoke all sessions
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
