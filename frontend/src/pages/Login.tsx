import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { LanguageSelector } from "../components/LanguageSelector";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

export default function Login() {
  const { session, signIn, completeTwoFactor, twoFactorRequired } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (session && !twoFactorRequired) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (twoFactorRequired) {
        await completeTwoFactor(code, remember);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">StoreListen</p>
            <LanguageSelector />
          </div>
          <CardTitle className="mt-2 text-2xl">{twoFactorRequired ? t("login.twoFactorTitle") : t("login.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!isSupabaseConfigured ? (
            <p className="text-sm text-amber-300">{t("login.missingEnv")}</p>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
              {twoFactorRequired ? (
                <>
                  <Input
                    inputMode="numeric"
                    placeholder={useBackup ? t("login.backupCode") : t("login.otp")}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    {t("login.rememberDevice")}
                  </label>
                  <button type="button" className="text-sm text-emerald-400" onClick={() => setUseBackup((value) => !value)}>
                    {useBackup ? t("login.useAuthenticator") : t("login.useBackup")}
                  </button>
                </>
              ) : (
                <>
                  <Input type="email" placeholder={t("login.email")} value={email} onChange={(e) => setEmail(e.target.value)} required />
                  <Input
                    type="password"
                    placeholder={t("login.password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </>
              )}
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? t("login.pending") : twoFactorRequired ? t("login.verify") : t("login.submit")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
