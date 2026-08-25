import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";

function keyBytes(): Buffer | null {
  const raw = env.ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const fromB64 = Buffer.from(raw, "base64");
  if (fromB64.length === 32) return fromB64;
  const padded = Buffer.alloc(32);
  Buffer.from(raw, "utf8").copy(padded);
  return padded;
}

export function isEncrypted(value?: string | null): boolean {
  return Boolean(value?.startsWith(PREFIX));
}

export function encryptText(value?: string | null): string | null {
  if (!value) return value ?? null;
  if (isEncrypted(value)) return value;
  const key = keyBytes();
  if (!key) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptText(value?: string | null): string | null {
  if (!value) return value ?? null;
  if (!isEncrypted(value)) return value;
  const key = keyBytes();
  if (!key) return value;
  const packed = value.slice(PREFIX.length);
  const [ivPart, tagPart, dataPart] = packed.split(".");
  if (!ivPart || !tagPart || !dataPart) return value;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]);
  return plain.toString("utf8");
}

export function hashPhone(value?: string | null): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return createHash("sha256").update(digits).digest("hex");
}

export function encryptBackupBuffer(buffer: Buffer): Buffer {
  const key = keyBytes();
  if (!key) return buffer;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("SLB1"), iv, tag, encrypted]);
}

export function decryptBackupBuffer(buffer: Buffer): Buffer {
  if (buffer.length < 8 || buffer.subarray(0, 4).toString() !== "SLB1") return buffer;
  const key = keyBytes();
  if (!key) return buffer;
  const iv = buffer.subarray(4, 16);
  const tag = buffer.subarray(16, 32);
  const data = buffer.subarray(32);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
