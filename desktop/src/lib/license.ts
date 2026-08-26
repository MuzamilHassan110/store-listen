const KEY = "storelisten_license";

export type LicenseStatus = {
  license_key: string;
  plan_type: string;
  max_stores: number;
  max_users: number;
  max_devices: number;
  expires_at: string | null;
  is_active: boolean;
  organization_id: string | null;
  days_left: number | null;
  valid: boolean;
  expired: boolean;
};

export function readLicense(): LicenseStatus | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LicenseStatus) : null;
  } catch {
    return null;
  }
}

export function saveLicense(status: LicenseStatus): void {
  localStorage.setItem(KEY, JSON.stringify(status));
}

export function clearLicense(): void {
  localStorage.removeItem(KEY);
}

export function isLicenseValid(status: LicenseStatus | null = readLicense()): boolean {
  if (!status) {
    return Boolean(localStorage.getItem("storelisten_device_id"));
  }
  if (!status.valid || status.expired || !status.is_active) return false;
  if (status.expires_at && Date.parse(status.expires_at) < Date.now()) return false;
  return true;
}
