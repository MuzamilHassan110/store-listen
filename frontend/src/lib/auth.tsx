import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { confirmTwoFactor, fetchTwoFactorStatus } from "../services/api";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  twoFactorRequired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  completeTwoFactor: (code: string, rememberDevice: boolean) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);

  async function checkTwoFactor(next: Session | null): Promise<void> {
    if (!next) {
      setTwoFactorRequired(false);
      return;
    }
    try {
      const deviceToken = localStorage.getItem("storelisten_device_token");
      const status = await fetchTwoFactorStatus(deviceToken);
      setTwoFactorRequired(status.enabled && !status.trusted);
    } catch {
      setTwoFactorRequired(false);
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.access_token) {
        localStorage.setItem("storelisten_token", data.session.access_token);
      }
      await checkTwoFactor(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.access_token) localStorage.setItem("storelisten_token", next.access_token);
      else localStorage.removeItem("storelisten_token");
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      twoFactorRequired,
      signIn: async (email, password) => {
        if (!supabase) throw new Error("Supabase is not configured.");
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSession(data.session);
        if (data.session?.access_token) localStorage.setItem("storelisten_token", data.session.access_token);
        await checkTwoFactor(data.session);
      },
      completeTwoFactor: async (code, rememberDevice) => {
        const result = await confirmTwoFactor(code, rememberDevice);
        if (result.device_token) localStorage.setItem("storelisten_device_token", result.device_token);
        setTwoFactorRequired(false);
      },
      signOut: async () => {
        await supabase?.auth.signOut();
        setTwoFactorRequired(false);
      },
    }),
    [session, loading, twoFactorRequired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
