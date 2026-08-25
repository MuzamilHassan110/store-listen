import { getSupabase } from "../lib/supabase.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { createNotification } from "./notification.service.js";

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function assertNotLocked(email: string): Promise<void> {
  const { data } = await getSupabase().from("account_lockouts").select("*").eq("email", email.toLowerCase()).maybeSingle();
  if (data?.locked_until && new Date(String(data.locked_until)).getTime() > Date.now()) {
    throw new HttpError(423, "Account locked after too many failed sign-ins. Try again in 15 minutes.", "ACCOUNT_LOCKED");
  }
}

export async function recordLoginAttempt(input: {
  email: string;
  ipAddress?: string | null;
  success: boolean;
  organizationId?: string | null;
}): Promise<void> {
  const email = input.email.toLowerCase();
  await getSupabase().from("login_attempts").insert({
    email,
    ip_address: input.ipAddress ?? null,
    success: input.success,
  });

  if (input.success) {
    await getSupabase()
      .from("account_lockouts")
      .upsert({ email, failed_count: 0, locked_until: null, updated_at: new Date().toISOString() });
    return;
  }

  const { data } = await getSupabase().from("account_lockouts").select("*").eq("email", email).maybeSingle();
  const failed = Number(data?.failed_count ?? 0) + 1;
  const lockedUntil = failed >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS).toISOString() : null;
  await getSupabase()
    .from("account_lockouts")
    .upsert({ email, failed_count: failed, locked_until: lockedUntil, updated_at: new Date().toISOString() });

  if (lockedUntil) {
    logger.warn({ email, ip: input.ipAddress }, "Account locked after failed logins");
    if (input.organizationId) {
      await createNotification({
        organizationId: input.organizationId,
        type: "security",
        title: "Account locked",
        message: `${email} was locked for 15 minutes after 5 failed sign-in attempts.`,
        metadata: { email, ip: input.ipAddress },
      }).catch((err) => logger.warn({ err }, "Could not notify lockout"));
    }
  }
}
