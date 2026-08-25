import { randomBytes, randomUUID, createHash } from "node:crypto";
import speakeasy from "speakeasy";
import { HttpError } from "../lib/http-error.js";
import { hashPassword, signToken, verifyPassword, verifyToken } from "../lib/auth.js";
import { decryptText, encryptText } from "./encryption.service.js";
import { getSupabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

export type TwoFactorSetup = {
  secret: string;
  qr_code_url: string;
  otpauth_url: string;
  backup_codes: string[];
};

type PendingPayload = { typ: "2fa_pending"; jti: string; sub: string };

async function toQrDataUrl(otpauth: string): Promise<string> {
  const qrcode = await import("qrcode");
  return qrcode.toDataURL(otpauth, { margin: 1, width: 240 });
}

function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function loadProfile(userId: string) {
  const { data, error } = await getSupabase().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new HttpError(500, "Failed to load profile.", "PROFILE_LOAD_FAILED");
  return data;
}

export async function ensureProfile(userId: string, organizationId?: string | null, email?: string | null) {
  await getSupabase().from("profiles").upsert(
    { id: userId, organization_id: organizationId ?? null, full_name: email ?? null },
    { onConflict: "id" },
  );
}

export async function getTwoFactorStatus(userId: string): Promise<{ enabled: boolean }> {
  const profile = await loadProfile(userId);
  return { enabled: Boolean(profile?.two_factor_enabled) };
}

export async function setupTwoFactor(userId: string, email?: string | null): Promise<TwoFactorSetup> {
  await ensureProfile(userId, null, email);
  const generated = speakeasy.generateSecret({
    name: `StoreListen (${email || userId.slice(0, 8)})`,
    length: 20,
  });
  if (!generated.base32 || !generated.otpauth_url) {
    throw new HttpError(500, "Could not generate a 2FA secret.", "TWO_FACTOR_SETUP_FAILED");
  }
  const backupCodes = Array.from({ length: 10 }, () => randomBytes(4).toString("hex"));
  const hashed = await Promise.all(backupCodes.map((code) => hashPassword(code)));
  const { error } = await getSupabase()
    .from("profiles")
    .update({
      two_factor_secret: generated.base32,
      two_factor_enabled: false,
      backup_codes: hashed,
    })
    .eq("id", userId);
  if (error) throw new HttpError(500, "Failed to save 2FA secret.", "TWO_FACTOR_SETUP_FAILED");
  return {
    secret: generated.base32,
    otpauth_url: generated.otpauth_url,
    qr_code_url: await toQrDataUrl(generated.otpauth_url),
    backup_codes: backupCodes,
  };
}

export function verifyTotp(secret: string, token: string): boolean {
  return speakeasy.totp.verify({ secret, encoding: "base32", token: token.replace(/\s/g, ""), window: 1 });
}

export async function enableTwoFactor(userId: string, code: string): Promise<{ enabled: true }> {
  const profile = await loadProfile(userId);
  const secret = profile?.two_factor_secret ? String(profile.two_factor_secret) : "";
  if (!secret) throw new HttpError(400, "Run 2FA setup first.", "TWO_FACTOR_NOT_STARTED");
  if (!verifyTotp(secret, code)) throw new HttpError(400, "Invalid authenticator code.", "TWO_FACTOR_INVALID");
  const { error } = await getSupabase().from("profiles").update({ two_factor_enabled: true }).eq("id", userId);
  if (error) throw new HttpError(500, "Failed to enable 2FA.", "TWO_FACTOR_ENABLE_FAILED");
  return { enabled: true };
}

export async function disableTwoFactor(userId: string, code: string): Promise<{ enabled: false }> {
  const profile = await loadProfile(userId);
  if (!profile?.two_factor_enabled) return { enabled: false };
  const secret = String(profile.two_factor_secret ?? "");
  const totpOk = secret ? verifyTotp(secret, code) : false;
  const backupOk = totpOk ? false : await consumeBackupCode(userId, code);
  if (!totpOk && !backupOk) throw new HttpError(400, "Invalid authenticator or backup code.", "TWO_FACTOR_INVALID");
  const { error } = await getSupabase()
    .from("profiles")
    .update({ two_factor_enabled: false, two_factor_secret: null, backup_codes: [] })
    .eq("id", userId);
  if (error) throw new HttpError(500, "Failed to disable 2FA.", "TWO_FACTOR_DISABLE_FAILED");
  return { enabled: false };
}

export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const profile = await loadProfile(userId);
  const codes = Array.isArray(profile?.backup_codes) ? profile.backup_codes.map(String) : [];
  for (const [index, hashed] of codes.entries()) {
    if (await verifyPassword(code.trim().toLowerCase(), hashed)) {
      const next = codes.filter((_code: string, i: number) => i !== index);
      await getSupabase().from("profiles").update({ backup_codes: next }).eq("id", userId);
      return true;
    }
  }
  return false;
}

export async function createPendingLogin(input: {
  userId: string;
  email?: string | null;
  accessToken: string;
  refreshToken?: string | null;
}): Promise<string> {
  const id = randomUUID();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await getSupabase().from("pending_2fa_logins").insert({
    id,
    user_id: input.userId,
    email: input.email ?? null,
    access_token: encryptText(input.accessToken),
    refresh_token: encryptText(input.refreshToken ?? null),
    expires_at: expires,
  });
  if (error) {
    logger.error({ error }, "Failed to store pending 2FA login");
    throw new HttpError(500, "Could not start 2FA challenge.", "TWO_FACTOR_PENDING_FAILED");
  }
  return signToken({ typ: "2fa_pending", jti: id, sub: input.userId });
}

export async function completePendingLogin(
  tempToken: string,
  code: string,
  useBackup = false,
): Promise<{ access_token: string; refresh_token: string | null; user_id: string }> {
  let payload: PendingPayload;
  try {
    payload = verifyToken<PendingPayload>(tempToken);
  } catch {
    throw new HttpError(401, "2FA session expired. Sign in again.", "TWO_FACTOR_EXPIRED");
  }
  if (payload.typ !== "2fa_pending" || !payload.jti) {
    throw new HttpError(401, "Invalid 2FA token.", "TWO_FACTOR_INVALID");
  }
  const { data, error } = await getSupabase().from("pending_2fa_logins").select("*").eq("id", payload.jti).maybeSingle();
  if (error || !data) throw new HttpError(401, "2FA session not found.", "TWO_FACTOR_EXPIRED");
  if (new Date(String(data.expires_at)).getTime() < Date.now()) {
    throw new HttpError(401, "2FA session expired. Sign in again.", "TWO_FACTOR_EXPIRED");
  }

  const profile = await loadProfile(String(data.user_id));
  const secret = String(profile?.two_factor_secret ?? "");
  const ok = useBackup ? await consumeBackupCode(String(data.user_id), code) : verifyTotp(secret, code);
  if (!ok) throw new HttpError(400, "Invalid code.", "TWO_FACTOR_INVALID");

  await getSupabase().from("pending_2fa_logins").delete().eq("id", payload.jti);
  return {
    access_token: decryptText(String(data.access_token)) ?? "",
    refresh_token: data.refresh_token ? decryptText(String(data.refresh_token)) : null,
    user_id: String(data.user_id),
  };
}

export async function issueTrustedDevice(userId: string, label?: string | null): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await getSupabase().from("trusted_devices").insert({
    user_id: userId,
    token_hash: hashDeviceToken(token),
    label: label ?? "Remembered device",
    expires_at: expires,
  });
  return token;
}

export async function isTrustedDevice(userId: string, token?: string | null): Promise<boolean> {
  if (!token) return false;
  const { data } = await getSupabase()
    .from("trusted_devices")
    .select("id, expires_at")
    .eq("user_id", userId)
    .eq("token_hash", hashDeviceToken(token))
    .maybeSingle();
  if (!data) return false;
  return new Date(String(data.expires_at)).getTime() > Date.now();
}
