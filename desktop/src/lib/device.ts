const DEVICE_KEY = "storelisten_device_id";
const SALESMAN_KEY = "storelisten_salesman_id";

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

export function getSalesmanId(): string | null {
  const value = localStorage.getItem(SALESMAN_KEY);
  return value && value.length > 0 ? value : null;
}
