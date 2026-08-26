const DEVICE_KEY = "storelisten_device_id";
const SALESMAN_KEY = "storelisten_salesman_id";
const NAME_KEY = "storelisten_device_name";
const STORE_KEY = "storelisten_store_id";

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

export function getDeviceName(): string {
  return localStorage.getItem(NAME_KEY) || "StoreListen recorder";
}

export function setDeviceName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim() || "StoreListen recorder");
}

export function getStoreId(): string | null {
  const value = localStorage.getItem(STORE_KEY);
  return value && value.length > 0 ? value : null;
}

export function setStoreId(id: string | null): void {
  if (id) localStorage.setItem(STORE_KEY, id);
  else localStorage.removeItem(STORE_KEY);
}
