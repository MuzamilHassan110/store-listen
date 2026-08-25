import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import {
  getDefaultTemplate,
  isQuietHours,
  normalizePhone,
  renderMessageTemplate,
  type MessageChannel,
  type TemplateName,
} from "./message-templates.js";
import { getSmsStatus, isSmsConfigured, sendSms } from "./sms.service.js";
import { sendWhatsAppMessage } from "./whatsapp.service.js";

export type CommunicationSettings = {
  whatsapp_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  timezone: string;
  manager_whatsapp: string | null;
  manager_sms: string | null;
  follow_up_template: string | null;
  daily_report_template: string | null;
  high_intent_template: string | null;
};

export type OutboundMessage = {
  id: string;
  organization_id: string;
  follow_up_id: string | null;
  customer_id: string | null;
  customer_phone: string | null;
  message_text: string;
  template_used: string | null;
  channel: MessageChannel;
  status: string;
  provider_id: string | null;
  error_text: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
};

const DEFAULT_SETTINGS: CommunicationSettings = {
  whatsapp_enabled: false,
  sms_enabled: false,
  push_enabled: true,
  quiet_hours_start: 22,
  quiet_hours_end: 9,
  timezone: "Asia/Karachi",
  manager_whatsapp: null,
  manager_sms: null,
  follow_up_template: null,
  daily_report_template: null,
  high_intent_template: null,
};

function mapSettings(row?: Record<string, unknown> | null): CommunicationSettings {
  return {
    whatsapp_enabled: Boolean(row?.whatsapp_enabled ?? DEFAULT_SETTINGS.whatsapp_enabled),
    sms_enabled: Boolean(row?.sms_enabled ?? DEFAULT_SETTINGS.sms_enabled),
    push_enabled: row?.push_enabled == null ? true : Boolean(row.push_enabled),
    quiet_hours_start: Number(row?.quiet_hours_start ?? 22),
    quiet_hours_end: Number(row?.quiet_hours_end ?? 9),
    timezone: row?.timezone ? String(row.timezone) : "Asia/Karachi",
    manager_whatsapp: row?.manager_whatsapp ? String(row.manager_whatsapp) : null,
    manager_sms: row?.manager_sms ? String(row.manager_sms) : null,
    follow_up_template: row?.follow_up_template ? String(row.follow_up_template) : null,
    daily_report_template: row?.daily_report_template ? String(row.daily_report_template) : null,
    high_intent_template: row?.high_intent_template ? String(row.high_intent_template) : null,
  };
}

function mapMessage(row: Record<string, unknown>): OutboundMessage {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    follow_up_id: row.follow_up_id ? String(row.follow_up_id) : null,
    customer_id: row.customer_id ? String(row.customer_id) : null,
    customer_phone: row.customer_phone ? String(row.customer_phone) : null,
    message_text: String(row.message_text ?? ""),
    template_used: row.template_used ? String(row.template_used) : null,
    channel: row.channel === "sms" ? "sms" : "whatsapp",
    status: String(row.status ?? "queued"),
    provider_id: row.provider_id ? String(row.provider_id) : null,
    error_text: row.error_text ? String(row.error_text) : null,
    sent_at: row.sent_at ? String(row.sent_at) : null,
    delivered_at: row.delivered_at ? String(row.delivered_at) : null,
    read_at: row.read_at ? String(row.read_at) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function getCommunicationSettings(organizationId: string): Promise<CommunicationSettings> {
  const { data } = await getSupabase()
    .from("organization_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return mapSettings(data as Record<string, unknown> | null);
}

export async function updateCommunicationSettings(
  organizationId: string,
  input: Partial<CommunicationSettings>,
): Promise<CommunicationSettings> {
  const current = await getCommunicationSettings(organizationId);
  const next = { ...current, ...input };
  const { error } = await getSupabase().from("organization_settings").upsert({
    organization_id: organizationId,
    ...next,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new HttpError(500, "Failed to save communication settings.", "COMMUNICATION_SAVE_FAILED");
  return next;
}

export function settingsAreQuiet(settings: CommunicationSettings, now = new Date()): boolean {
  return isQuietHours(now, settings.quiet_hours_start, settings.quiet_hours_end, settings.timezone);
}

export function resolveTemplate(
  settings: CommunicationSettings,
  name: TemplateName,
  channel: MessageChannel,
): string {
  if (name === "follow_up" && settings.follow_up_template) return settings.follow_up_template;
  if (name === "daily_report" && settings.daily_report_template) return settings.daily_report_template;
  if (name === "high_intent" && settings.high_intent_template) return settings.high_intent_template;
  return getDefaultTemplate(name, channel);
}

async function insertMessage(input: {
  organizationId: string;
  followUpId?: string | null;
  customerId?: string | null;
  phone: string;
  text: string;
  template?: string | null;
  channel: MessageChannel;
  status: string;
}): Promise<OutboundMessage> {
  const { data, error } = await getSupabase()
    .from("whatsapp_messages")
    .insert({
      organization_id: input.organizationId,
      follow_up_id: input.followUpId ?? null,
      customer_id: input.customerId ?? null,
      customer_phone: input.phone,
      message_text: input.text,
      template_used: input.template ?? null,
      channel: input.channel,
      status: input.status,
    })
    .select()
    .single();
  if (error || !data) {
    logger.error({ error }, "Failed to record outbound message");
    throw new HttpError(500, "Failed to queue the message.", "MESSAGE_QUEUE_FAILED");
  }
  return mapMessage(data as Record<string, unknown>);
}

async function markMessage(
  id: string,
  patch: Record<string, unknown>,
): Promise<OutboundMessage | null> {
  const { data, error } = await getSupabase().from("whatsapp_messages").update(patch).eq("id", id).select().maybeSingle();
  if (error) {
    logger.error({ error, id }, "Failed to update outbound message");
    return null;
  }
  return data ? mapMessage(data as Record<string, unknown>) : null;
}

export async function listOutboundMessages(
  organizationId: string,
  limit = 50,
): Promise<OutboundMessage[]> {
  const { data, error } = await getSupabase()
    .from("whatsapp_messages")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new HttpError(500, "Failed to load message history.", "MESSAGE_HISTORY_FAILED");
  return (data ?? []).map((row) => mapMessage(row as Record<string, unknown>));
}

export async function getOutboundMessage(organizationId: string, id: string): Promise<OutboundMessage> {
  const { data, error } = await getSupabase()
    .from("whatsapp_messages")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new HttpError(500, "Failed to load message.", "MESSAGE_LOAD_FAILED");
  if (!data) throw new HttpError(404, "Message not found.", "NOT_FOUND");
  return mapMessage(data as Record<string, unknown>);
}

async function deliver(row: OutboundMessage, settings: CommunicationSettings): Promise<OutboundMessage> {
  const preferred = row.channel;
  const phone = row.customer_phone ?? "";
  const attempts: MessageChannel[] =
    preferred === "whatsapp" ? ["whatsapp", "sms"] : ["sms", "whatsapp"];

  let lastError = "No delivery channel available.";
  for (const channel of attempts) {
    const allowed = channel === "whatsapp" ? settings.whatsapp_enabled : settings.sms_enabled;
    if (!allowed) continue;
    if (channel === "sms" && !isSmsConfigured()) continue;
    try {
      const result =
        channel === "whatsapp"
          ? await sendWhatsAppMessage(phone, row.message_text)
          : await sendSms(phone, row.message_text);
      const updated = await markMessage(row.id, {
        channel,
        status: "sent",
        provider_id: result.providerId,
        sent_at: new Date().toISOString(),
        error_text: null,
      });
      return updated ?? { ...row, channel, status: "sent", provider_id: result.providerId };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Send failed";
      logger.warn({ err, channel, id: row.id }, "Outbound send attempt failed");
    }
  }

  const failed = await markMessage(row.id, { status: "failed", error_text: lastError });
  return failed ?? { ...row, status: "failed", error_text: lastError };
}

export async function enqueueAndMaybeSend(input: {
  organizationId: string;
  phone: string;
  text: string;
  template?: string | null;
  channel?: MessageChannel;
  followUpId?: string | null;
  customerId?: string | null;
  skipQuietHours?: boolean;
  requireConsent?: boolean;
}): Promise<OutboundMessage> {
  const settings = await getCommunicationSettings(input.organizationId);
  const phone = normalizePhone(input.phone) || input.phone;
  if (!phone) throw new HttpError(400, "A phone number is required.", "VALIDATION_ERROR");

  if (input.requireConsent) {
    const { data: customer } = input.customerId
      ? await getSupabase()
          .from("customers")
          .select("contact_consent")
          .eq("id", input.customerId)
          .eq("organization_id", input.organizationId)
          .maybeSingle()
      : await getSupabase()
          .from("customers")
          .select("contact_consent")
          .eq("organization_id", input.organizationId)
          .or(`phone.eq.${phone},whatsapp_number.eq.${phone},sms_number.eq.${phone}`)
          .maybeSingle();
    if (!customer?.contact_consent) {
      throw new HttpError(403, "Customer has not consented to messages.", "CONSENT_REQUIRED");
    }
  }

  const quiet = !input.skipQuietHours && settingsAreQuiet(settings);
  const queued = await insertMessage({
    organizationId: input.organizationId,
    followUpId: input.followUpId,
    customerId: input.customerId,
    phone,
    text: input.text,
    template: input.template,
    channel: input.channel ?? "whatsapp",
    status: quiet ? "queued" : "queued",
  });

  if (quiet) {
    logger.info({ id: queued.id }, "Message queued for after quiet hours");
    return queued;
  }
  return deliver(queued, settings);
}

export async function flushQueuedMessages(): Promise<number> {
  const { data, error } = await getSupabase()
    .from("whatsapp_messages")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error || !data?.length) return 0;

  let sent = 0;
  for (const row of data) {
    const mapped = mapMessage(row as Record<string, unknown>);
    const settings = await getCommunicationSettings(mapped.organization_id);
    if (settingsAreQuiet(settings)) continue;
    const result = await deliver(mapped, settings);
    if (result.status === "sent") sent += 1;
  }
  return sent;
}

export async function previewFollowUpMessage(
  organizationId: string,
  followUpId: string,
  channel: MessageChannel = "whatsapp",
): Promise<{ text: string; template: TemplateName; phone: string | null; consented: boolean }> {
  const settings = await getCommunicationSettings(organizationId);
  const { data: followUp, error } = await getSupabase()
    .from("follow_ups")
    .select("*, salesmen (name), conversations (recorded_at, stores (name, phone))")
    .eq("id", followUpId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Failed to load follow-up.", "FOLLOWUP_LOAD_FAILED");
  if (!followUp) throw new HttpError(404, "Follow-up not found.", "NOT_FOUND");

  const salesman = Array.isArray(followUp.salesmen) ? followUp.salesmen[0] : followUp.salesmen;
  const conversation = Array.isArray(followUp.conversations) ? followUp.conversations[0] : followUp.conversations;
  const store =
    conversation && typeof conversation === "object"
      ? Array.isArray((conversation as { stores?: unknown }).stores)
        ? (conversation as { stores: Array<{ name?: string; phone?: string }> }).stores[0]
        : (conversation as { stores?: { name?: string; phone?: string } }).stores
      : null;

  let consented = false;
  let whatsappNumber: string | null = followUp.customer_phone ? String(followUp.customer_phone) : null;
  if (followUp.customer_id) {
    const { data: customer } = await getSupabase()
      .from("customers")
      .select("contact_consent, whatsapp_number, sms_number, phone, preferred_contact")
      .eq("id", followUp.customer_id)
      .maybeSingle();
    consented = Boolean(customer?.contact_consent);
    whatsappNumber =
      (channel === "sms" ? customer?.sms_number : customer?.whatsapp_number) ||
      customer?.phone ||
      whatsappNumber;
  }

  const template = resolveTemplate(settings, "follow_up", channel);
  const recordedAt =
    conversation && typeof conversation === "object"
      ? String((conversation as { recorded_at?: string }).recorded_at ?? "").slice(0, 10)
      : "";
  const text = renderMessageTemplate(template, {
    customer_name: followUp.customer_name,
    salesman_name: salesman && typeof salesman === "object" ? salesman.name : "our team",
    store_name: store?.name ?? "our store",
    product_name: followUp.product_interest,
    date: recordedAt || new Date().toISOString().slice(0, 10),
    phone: store?.phone ?? "",
  });

  return { text, template: "follow_up", phone: whatsappNumber, consented };
}

export async function sendFollowUpMessage(
  organizationId: string,
  followUpId: string,
  input: { channel?: MessageChannel; text?: string },
): Promise<OutboundMessage> {
  const preview = await previewFollowUpMessage(organizationId, followUpId, input.channel ?? "whatsapp");
  if (!preview.consented) {
    throw new HttpError(403, "Customer has not consented to messages.", "CONSENT_REQUIRED");
  }
  if (!preview.phone) {
    throw new HttpError(400, "This follow-up has no phone number.", "VALIDATION_ERROR");
  }
  const { data: followUp } = await getSupabase()
    .from("follow_ups")
    .select("customer_id, contact_method")
    .eq("id", followUpId)
    .maybeSingle();

  const message = await enqueueAndMaybeSend({
    organizationId,
    phone: preview.phone,
    text: input.text?.trim() || preview.text,
    template: preview.template,
    channel: input.channel ?? "whatsapp",
    followUpId,
    customerId: followUp?.customer_id ? String(followUp.customer_id) : null,
    skipQuietHours: true,
    requireConsent: true,
  });

  if (message.status === "sent") {
    await getSupabase()
      .from("follow_ups")
      .update({ message_sent: true, contact_method: message.channel })
      .eq("id", followUpId);
  }
  return message;
}

export async function queueFollowUpIfConsented(organizationId: string, followUpId: string): Promise<void> {
  try {
    const preview = await previewFollowUpMessage(organizationId, followUpId, "whatsapp");
    if (!preview.consented || !preview.phone) return;
    await enqueueAndMaybeSend({
      organizationId,
      phone: preview.phone,
      text: preview.text,
      template: "follow_up",
      channel: "whatsapp",
      followUpId,
      requireConsent: true,
    });
  } catch (err) {
    logger.warn({ err, followUpId }, "Auto-queue follow-up WhatsApp skipped");
  }
}

export async function queueHighIntentAlert(
  organizationId: string,
  vars: Record<string, string | number | null | undefined>,
): Promise<void> {
  try {
    const settings = await getCommunicationSettings(organizationId);
    const phone = settings.manager_whatsapp || settings.manager_sms;
    if (!phone) return;
    const channel: MessageChannel = settings.manager_whatsapp ? "whatsapp" : "sms";
    const text = renderMessageTemplate(resolveTemplate(settings, "high_intent", channel), vars);
    await enqueueAndMaybeSend({
      organizationId,
      phone,
      text,
      template: "high_intent",
      channel,
      skipQuietHours: false,
    });
  } catch (err) {
    logger.warn({ err, organizationId }, "High-intent WhatsApp alert skipped");
  }
}

export async function queueDailyReportMessage(
  organizationId: string,
  vars: Record<string, string | number | null | undefined>,
): Promise<void> {
  try {
    const settings = await getCommunicationSettings(organizationId);
    const phone = settings.manager_whatsapp || settings.manager_sms;
    if (!phone) return;
    const channel: MessageChannel = settings.manager_whatsapp ? "whatsapp" : "sms";
    const text = renderMessageTemplate(resolveTemplate(settings, "daily_report", channel), vars);
    await enqueueAndMaybeSend({
      organizationId,
      phone,
      text,
      template: "daily_report",
      channel,
    });
  } catch (err) {
    logger.warn({ err, organizationId }, "Daily report WhatsApp skipped");
  }
}

export async function refreshSmsDelivery(organizationId: string, messageId: string): Promise<OutboundMessage> {
  const row = await getOutboundMessage(organizationId, messageId);
  if (!row.provider_id || row.channel !== "sms") return row;
  const remote = await getSmsStatus(row.provider_id);
  const status =
    remote.status === "delivered"
      ? "delivered"
      : remote.status === "read"
        ? "read"
        : remote.status === "failed" || remote.status === "undelivered"
          ? "failed"
          : row.status;
  const updated = await markMessage(row.id, {
    status,
    delivered_at: status === "delivered" ? new Date().toISOString() : row.delivered_at,
    error_text: remote.error ?? row.error_text,
  });
  return updated ?? { ...row, status };
}

export async function buildDailyReportVars(organizationId: string, fileUrl?: string | null) {
  const supabase = getSupabase();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const from = start.toISOString();

  const [{ count }, { data: scores }, { count: leads }, { data: due }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("recorded_at", from),
    supabase
      .from("conversations")
      .select("salesmen (name), conversation_analyses (overall_score)")
      .eq("organization_id", organizationId)
      .gte("recorded_at", from)
      .limit(200),
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("priority", "high")
      .eq("status", "pending"),
    supabase
      .from("follow_ups")
      .select("id")
      .eq("organization_id", organizationId)
      .in("status", ["pending", "snoozed"])
      .lte("follow_up_date", new Date(start.getTime() + 86_400_000).toISOString())
      .gte("follow_up_date", from),
  ]);

  const bySalesman = new Map<string, { name: string; total: number; count: number }>();
  for (const row of scores ?? []) {
    const salesman = Array.isArray(row.salesmen) ? row.salesmen[0] : row.salesmen;
    const analyses = Array.isArray(row.conversation_analyses)
      ? row.conversation_analyses
      : row.conversation_analyses
        ? [row.conversation_analyses]
        : [];
    const overall = Number((analyses[0] as { overall_score?: number } | undefined)?.overall_score ?? 0);
    if (!overall) continue;
    const name = salesman && typeof salesman === "object" ? String(salesman.name ?? "Unknown") : "Unknown";
    const current = bySalesman.get(name) ?? { name, total: 0, count: 0 };
    current.total += overall;
    current.count += 1;
    bySalesman.set(name, current);
  }
  const top = [...bySalesman.values()].sort((a, b) => b.total / Math.max(1, b.count) - a.total / Math.max(1, a.count))[0];

  return {
    date: new Date().toISOString().slice(0, 10),
    count: count ?? 0,
    name: top?.name ?? "—",
    score: top ? Math.round(top.total / top.count) : 0,
    leads: leads ?? 0,
    followups: due?.length ?? 0,
    link: fileUrl ?? "",
  };
}
