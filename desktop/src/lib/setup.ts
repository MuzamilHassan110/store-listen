const SETUP_KEY = "storelisten_setup_complete";
const DEVICE_KEY = "storelisten_device_id";

export function isSetupComplete(): boolean {
  if (localStorage.getItem(SETUP_KEY) === "1") return true;
  if (localStorage.getItem(DEVICE_KEY)) {
    localStorage.setItem(SETUP_KEY, "1");
    return true;
  }
  return false;
}

export function isSetupComplete(): boolean {
  return localStorage.getItem(SETUP_KEY) === "1";
}

export function markSetupComplete(): void {
  localStorage.setItem(SETUP_KEY, "1");
}

export function resetSetup(): void {
  localStorage.removeItem(SETUP_KEY);
}
