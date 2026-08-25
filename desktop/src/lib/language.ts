export function shortLanguageCode(tag: string | undefined): string {
  const base = (tag ?? navigator.language ?? "en").toLowerCase().split("-")[0] ?? "en";
  if (base === "en" || base === "ur" || base === "pa" || base === "ar") {
    return base;
  }
  return base || "en";
}
