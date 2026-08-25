export const FOLLOW_UP_TEMPLATE =
  "Dear {customer_name}, this is {salesman_name} from {store_name}. We discussed {product_name} on {date}. Would you like to proceed with the purchase? Reply YES for more details or call us at {phone}.";

export const DAILY_REPORT_TEMPLATE =
  "📊 StoreListen Daily Report - {date}\n📞 Total Conversations: {count}\n⭐ Top Salesman: {name} ({score}%)\n🔥 High Intent Leads: {leads}\n📋 Follow-ups Due: {followups}\nView full report: {link}";

export const HIGH_INTENT_TEMPLATE =
  "🔥 High-intent lead at {store_name}\nCustomer: {customer_name}\nProduct: {product_name}\nLead score: {score}\nOpen: {link}";

export const SMS_FOLLOW_UP_TEMPLATE =
  "Hi {customer_name}, {salesman_name} from {store_name} following up on {product_name}. Reply YES or call {phone}.";

export const SMS_DAILY_REPORT_TEMPLATE =
  "StoreListen {date}: {count} convos, top {name} ({score}%), {leads} high-intent, {followups} follow-ups. {link}";

export const SMS_HIGH_INTENT_TEMPLATE =
  "High-intent lead: {customer_name} / {product_name} ({score}). {link}";

export type TemplateName = "follow_up" | "daily_report" | "high_intent";
export type MessageChannel = "whatsapp" | "sms";

export const TEMPLATE_CATALOG: Array<{
  name: TemplateName;
  channel: MessageChannel;
  label: string;
  body: string;
}> = [
  { name: "follow_up", channel: "whatsapp", label: "Follow-up reminder", body: FOLLOW_UP_TEMPLATE },
  { name: "daily_report", channel: "whatsapp", label: "Daily report", body: DAILY_REPORT_TEMPLATE },
  { name: "high_intent", channel: "whatsapp", label: "High intent alert", body: HIGH_INTENT_TEMPLATE },
  { name: "follow_up", channel: "sms", label: "Follow-up SMS", body: SMS_FOLLOW_UP_TEMPLATE },
  { name: "daily_report", channel: "sms", label: "Daily report SMS", body: SMS_DAILY_REPORT_TEMPLATE },
  { name: "high_intent", channel: "sms", label: "High intent SMS", body: SMS_HIGH_INTENT_TEMPLATE },
];

export function renderMessageTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{([a-z_]+)\}/gi, (_match, key: string) => {
    const value = vars[key];
    if (value == null || value === "") return key === "link" ? "" : "—";
    return String(value);
  });
}

export function getDefaultTemplate(name: TemplateName, channel: MessageChannel = "whatsapp"): string {
  const match = TEMPLATE_CATALOG.find((item) => item.name === name && item.channel === channel);
  return match?.body ?? FOLLOW_UP_TEMPLATE;
}

/** Quiet hours are 10 PM–9 AM by default (wraps midnight). */
export function isQuietHours(
  now = new Date(),
  startHour = 22,
  endHour = 9,
  timeZone?: string,
): boolean {
  const hour = hourInZone(now, timeZone);
  if (startHour === endHour) return false;
  if (startHour > endHour) return hour >= startHour || hour < endHour;
  return hour >= startHour && hour < endHour;
}

export function hourInZone(now: Date, timeZone?: string): number {
  if (!timeZone) return now.getHours();
  try {
    const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone }).formatToParts(now);
    return Number(parts.find((part) => part.type === "hour")?.value ?? now.getHours());
  } catch {
    return now.getHours();
  }
}

export function normalizePhone(phone: string, defaultCountry = "92"): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith(defaultCountry)) return digits;
  if (digits.startsWith("0")) return `${defaultCountry}${digits.slice(1)}`;
  if (digits.length === 10) return `${defaultCountry}${digits}`;
  return digits;
}
