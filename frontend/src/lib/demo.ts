const KEY = "storelisten_demo";

export function isDemoMode(): boolean {
  return localStorage.getItem(KEY) === "1";
}

export function setDemoMode(enabled: boolean): void {
  localStorage.setItem(KEY, enabled ? "1" : "0");
}

export function resetDemoData(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem("storelisten_onboarded");
}

export const DEMO_STATS = {
  todayCount: 12,
  highIntentCount: 3,
  followUpsDue: 4,
  topSalesman: "Ayesha Khan",
};
