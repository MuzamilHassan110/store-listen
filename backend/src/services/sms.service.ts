import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { normalizePhone } from "./message-templates.js";

export type SmsSendResult = {
  providerId: string;
  status: string;
  to: string;
};

export function isSmsConfigured(): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER);
}

export async function sendSms(phone: string, text: string): Promise<SmsSendResult> {
  if (!isSmsConfigured()) {
    throw new Error("Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.");
  }
  const digits = normalizePhone(phone);
  if (!digits) throw new Error("A valid phone number is required.");

  const twilio = (await import("twilio")).default;
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  const message = await client.messages.create({
    to: `+${digits}`,
    from: env.TWILIO_PHONE_NUMBER,
    body: text,
  });
  logger.info({ sid: message.sid, to: digits }, "SMS sent");
  return {
    providerId: message.sid,
    status: message.status ?? "sent",
    to: digits,
  };
}

export async function getSmsStatus(messageSid: string): Promise<{ status: string; error?: string | null }> {
  if (!isSmsConfigured()) {
    throw new Error("Twilio is not configured.");
  }
  const twilio = (await import("twilio")).default;
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  const message = await client.messages(messageSid).fetch();
  return {
    status: message.status ?? "unknown",
    error: message.errorMessage ?? null,
  };
}
