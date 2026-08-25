export const CAPTION_LANGUAGES = [
  { code: "en", label: "EN", locale: "en-US" },
  { code: "ur", label: "UR", locale: "ur-PK" },
  { code: "pa", label: "PA", locale: "pa-IN" },
  { code: "ar", label: "AR", locale: "ar-SA" },
  { code: "hi", label: "HI", locale: "hi-IN" },
] as const;

export type CaptionLanguage = (typeof CAPTION_LANGUAGES)[number]["code"];

export function shortLanguageCode(tag: string | undefined): CaptionLanguage {
  const base = (tag ?? navigator.language ?? "en").toLowerCase().split("-")[0] ?? "en";
  if (base === "en" || base === "ur" || base === "pa" || base === "ar" || base === "hi") {
    return base;
  }
  return "en";
}

export function speechLocale(code: string | undefined): string {
  const match = CAPTION_LANGUAGES.find((item) => item.code === shortLanguageCode(code));
  return match?.locale ?? "en-US";
}

export function isRtlLanguage(code: string | undefined): boolean {
  const value = shortLanguageCode(code);
  return value === "ur" || value === "ar";
}
