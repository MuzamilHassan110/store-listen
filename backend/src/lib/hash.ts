import { createHash } from "node:crypto";

export function hashRecordingBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
