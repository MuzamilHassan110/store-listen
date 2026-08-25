import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { normalizePhone } from "./message-templates.js";

export type WhatsAppConnectionStatus = "disconnected" | "connecting" | "qr" | "ready";

export type WhatsAppStatus = {
  enabled: boolean;
  status: WhatsAppConnectionStatus;
  ready: boolean;
  qr: string | null;
  qr_data_url: string | null;
};

type WhatsAppClient = {
  initialize: () => Promise<void>;
  destroy: () => Promise<void>;
  logout: () => Promise<void>;
  sendMessage: (chatId: string, content: string) => Promise<{ id?: { id?: string } }>;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  info?: { wid?: { user?: string } };
};

let client: WhatsAppClient | null = null;
let status: WhatsAppConnectionStatus = "disconnected";
let lastQr: string | null = null;
let lastQrDataUrl: string | null = null;
let starting: Promise<void> | null = null;

function authPath(): string {
  const dir = resolve(process.cwd(), ".wwebjs_auth");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function getWhatsAppStatus(): WhatsAppStatus {
  return {
    enabled: Boolean(env.WHATSAPP_ENABLED),
    status,
    ready: status === "ready",
    qr: lastQr,
    qr_data_url: lastQrDataUrl,
  };
}

export function listWhatsAppTemplates() {
  return [
    { name: "follow_up", label: "Follow-up reminder", channel: "whatsapp" },
    { name: "daily_report", label: "Daily report", channel: "whatsapp" },
    { name: "high_intent", label: "High intent alert", channel: "whatsapp" },
  ];
}

async function toDataUrl(qr: string): Promise<string | null> {
  try {
    const qrcode = await import("qrcode");
    return await qrcode.toDataURL(qr, { margin: 1, width: 280 });
  } catch (err) {
    logger.warn({ err }, "Could not render WhatsApp QR as an image");
    return null;
  }
}

async function ensureClient(): Promise<WhatsAppClient> {
  if (env.NODE_ENV === "test") {
    throw new Error("WhatsApp client is disabled in test.");
  }
  if (!env.WHATSAPP_ENABLED) {
    throw new Error("WhatsApp is disabled. Set WHATSAPP_ENABLED=true on the backend.");
  }
  if (client) return client;

  const { Client, LocalAuth } = await import("whatsapp-web.js");
  const qrTerminal = await import("qrcode-terminal");

  const next = new Client({
    authStrategy: new LocalAuth({ dataPath: authPath() }),
    puppeteer: {
      headless: true,
      executablePath: env.WHATSAPP_CHROME_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  }) as unknown as WhatsAppClient;

  next.on("qr", (qr) => {
    const value = String(qr ?? "");
    lastQr = value;
    status = "qr";
    qrTerminal.default.generate(value, { small: true });
    void toDataUrl(value).then((url) => {
      lastQrDataUrl = url;
    });
    logger.info("WhatsApp QR ready — scan from the dashboard");
  });
  next.on("ready", () => {
    status = "ready";
    lastQr = null;
    lastQrDataUrl = null;
    logger.info("WhatsApp client ready");
  });
  next.on("authenticated", () => {
    status = "connecting";
  });
  next.on("auth_failure", (message) => {
    status = "disconnected";
    logger.error({ message }, "WhatsApp authentication failed");
  });
  next.on("disconnected", (reason) => {
    status = "disconnected";
    client = null;
    logger.warn({ reason }, "WhatsApp disconnected");
  });

  client = next;
  return next;
}

export async function connectWhatsApp(): Promise<WhatsAppStatus> {
  if (status === "ready") return getWhatsAppStatus();
  if (starting) {
    await starting.catch(() => undefined);
    return getWhatsAppStatus();
  }

  starting = (async () => {
    status = "connecting";
    const instance = await ensureClient();
    await instance.initialize();
  })();

  try {
    await starting;
  } catch (err) {
    status = "disconnected";
    client = null;
    logger.error({ err }, "WhatsApp connect failed");
    throw err;
  } finally {
    starting = null;
  }
  return getWhatsAppStatus();
}

export async function sendWhatsAppMessage(phone: string, text: string): Promise<{ providerId: string | null }> {
  const digits = normalizePhone(phone);
  if (!digits) throw new Error("A valid phone number is required.");
  if (status !== "ready" || !client) {
    throw new Error("WhatsApp is not connected. Scan the QR code first.");
  }
  const result = await client.sendMessage(`${digits}@c.us`, text);
  return { providerId: result?.id?.id ?? null };
}

export async function logoutWhatsApp(): Promise<WhatsAppStatus> {
  if (client) {
    try {
      await client.logout();
    } catch {
      await client.destroy().catch(() => undefined);
    }
  }
  client = null;
  status = "disconnected";
  lastQr = null;
  lastQrDataUrl = null;
  return getWhatsAppStatus();
}
