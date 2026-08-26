import { randomBytes } from "node:crypto";
import { z } from "zod";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";

export const PLAN_LIMITS = {
  trial: { max_stores: 1, max_users: 3, max_devices: 1, days: 14 },
  basic: { max_stores: 2, max_users: 10, max_devices: 3, days: 365 },
  pro: { max_stores: 10, max_users: 50, max_devices: 20, days: 365 },
  enterprise: { max_stores: 999, max_users: 999, max_devices: 999, days: 365 },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

export const activateSchema = z
  .object({
    license_key: z.string().min(8).optional(),
    device_id: z.string().min(1),
    trial: z.boolean().optional(),
  })
  .refine((value) => value.trial === true || Boolean(value.license_key), {
    message: "Provide a license key or start a trial.",
  });

export const generateSchema = z.object({
  organization_id: z.string().uuid().optional(),
  plan_type: z.enum(["trial", "basic", "pro", "enterprise"]).default("basic"),
  max_stores: z.number().int().positive().optional(),
  max_users: z.number().int().positive().optional(),
  max_devices: z.number().int().positive().optional(),
  expires_at: z.string().optional(),
});

export function generateLicenseKey(): string {
  const block = () => randomBytes(2).toString("hex").toUpperCase();
  return `SL-${block()}-${block()}-${block()}-${block()}`;
}

export function normalizeLicenseKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000);
}

function asStatus(row: {
  license_key: string;
  plan_type: string;
  max_stores: number;
  max_users: number;
  max_devices: number;
  expires_at: string | null;
  is_active: boolean;
  organization_id: string | null;
}) {
  const remaining = daysLeft(row.expires_at);
  const expired = remaining != null && remaining < 0;
  const valid = row.is_active && !expired;
  return {
    license_key: row.license_key,
    plan_type: row.plan_type,
    max_stores: row.max_stores,
    max_users: row.max_users,
    max_devices: row.max_devices,
    expires_at: row.expires_at,
    is_active: row.is_active,
    organization_id: row.organization_id,
    days_left: remaining,
    valid,
    expired,
  };
}

export async function activateLicense(input: z.infer<typeof activateSchema>) {
  const supabase = getSupabase();
  if (input.trial) {
    const key = generateLicenseKey();
    const limits = PLAN_LIMITS.trial;
    const expires = new Date(Date.now() + limits.days * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("licenses")
      .insert({
        license_key: key,
        plan_type: "trial",
        max_stores: limits.max_stores,
        max_users: limits.max_users,
        max_devices: limits.max_devices,
        expires_at: expires,
        is_active: true,
        last_device_id: input.device_id,
        activated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error || !data) {
      logger.error({ error }, "Failed to create trial license");
      throw new HttpError(500, "Could not start a trial. Apply migration 012.", "LICENSE_ACTIVATE_FAILED");
    }
    return asStatus(data);
  }

  const key = normalizeLicenseKey(input.license_key ?? "");
  const { data, error } = await supabase.from("licenses").select("*").eq("license_key", key).maybeSingle();
  if (error) {
    logger.error({ error }, "Failed to look up license");
    throw new HttpError(500, "Could not look up license. Apply migration 012.", "LICENSE_LOOKUP_FAILED");
  }
  if (!data) {
    throw new HttpError(404, "License key not found.", "LICENSE_NOT_FOUND");
  }
  const status = asStatus(data);
  if (!status.valid) {
    throw new HttpError(403, status.expired ? "This license has expired." : "This license is inactive.", "LICENSE_INVALID");
  }
  await supabase
    .from("licenses")
    .update({ last_device_id: input.device_id, activated_at: new Date().toISOString() })
    .eq("id", data.id);
  return status;
}

export async function getLicenseStatus(licenseKey: string) {
  const key = normalizeLicenseKey(licenseKey);
  const { data, error } = await getSupabase().from("licenses").select("*").eq("license_key", key).maybeSingle();
  if (error) {
    throw new HttpError(500, "Could not look up license.", "LICENSE_LOOKUP_FAILED");
  }
  if (!data) {
    throw new HttpError(404, "License key not found.", "LICENSE_NOT_FOUND");
  }
  return asStatus(data);
}

export async function deactivateLicense(licenseKey: string, organizationId: string) {
  const key = normalizeLicenseKey(licenseKey);
  const { data, error } = await getSupabase()
    .from("licenses")
    .update({ is_active: false })
    .eq("license_key", key)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw new HttpError(404, "License not found for this organization.", "LICENSE_NOT_FOUND");
  }
  return asStatus(data);
}

export async function renewLicense(licenseKey: string, organizationId: string) {
  const current = await getLicenseStatus(licenseKey);
  const plan = (current.plan_type in PLAN_LIMITS ? current.plan_type : "basic") as PlanType;
  const days = PLAN_LIMITS[plan].days;
  const base = current.expires_at && Date.parse(current.expires_at) > Date.now() ? Date.parse(current.expires_at) : Date.now();
  const expires = new Date(base + days * 86_400_000).toISOString();
  const { data, error } = await getSupabase()
    .from("licenses")
    .update({ expires_at: expires, is_active: true })
    .eq("license_key", normalizeLicenseKey(licenseKey))
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw new HttpError(404, "License not found for this organization.", "LICENSE_NOT_FOUND");
  }
  return asStatus(data);
}

export async function generateLicense(input: z.infer<typeof generateSchema>, organizationId: string) {
  const plan = input.plan_type;
  const limits = PLAN_LIMITS[plan];
  const key = generateLicenseKey();
  const expires =
    input.expires_at ?? new Date(Date.now() + limits.days * 86_400_000).toISOString();
  const { data, error } = await getSupabase()
    .from("licenses")
    .insert({
      license_key: key,
      organization_id: input.organization_id ?? organizationId,
      plan_type: plan,
      max_stores: input.max_stores ?? limits.max_stores,
      max_users: input.max_users ?? limits.max_users,
      max_devices: input.max_devices ?? limits.max_devices,
      expires_at: expires,
      is_active: true,
    })
    .select("*")
    .single();
  if (error || !data) {
    logger.error({ error }, "Failed to generate license");
    throw new HttpError(500, "Could not generate a license. Apply migration 012.", "LICENSE_GENERATE_FAILED");
  }
  return asStatus(data);
}
