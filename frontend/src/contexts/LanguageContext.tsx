import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ar } from "../i18n/ar";
import { en, type Messages } from "../i18n/en";
import { ur } from "../i18n/ur";

export type UiLanguage = "en" | "ur" | "ar";

const dictionaries: Record<UiLanguage, Messages> = { en, ur, ar };

const STORAGE_KEY = "storelisten_language";

function lookup(messages: Messages, key: string): string {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof current === "string" ? current : key;
}

function detectBrowserLanguage(): UiLanguage {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "ur" || saved === "ar") return saved;
  const browser = (navigator.language || "en").toLowerCase().split("-")[0];
  if (browser === "ur" || browser === "ar") return browser;
  return "en";
}

type LanguageContextValue = {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
  dir: "ltr" | "rtl";
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UiLanguage>(() =>
    typeof window === "undefined" ? "en" : detectBrowserLanguage(),
  );
  const dir = language === "en" ? "ltr" : "rtl";

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
    document.documentElement.classList.toggle("font-urdu", language === "ur");
    document.documentElement.classList.toggle("font-arabic", language === "ar");
  }, [dir, language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      dir,
      t: (key: string) => lookup(dictionaries[language], key) || lookup(en, key),
    }),
    [dir, language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
