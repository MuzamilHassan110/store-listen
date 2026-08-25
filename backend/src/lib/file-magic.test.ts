import { describe, expect, it } from "vitest";
import { isAllowedAudioBuffer } from "./file-magic.js";

describe("isAllowedAudioBuffer", () => {
  it("accepts WebM and WAV signatures and rejects empty or script files", () => {
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]);
    const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE")]);
    expect(isAllowedAudioBuffer(webm)).toBe(true);
    expect(isAllowedAudioBuffer(wav)).toBe(true);
    expect(isAllowedAudioBuffer(Buffer.from("<script>"))).toBe(false);
    expect(isAllowedAudioBuffer(Buffer.alloc(0))).toBe(false);
  });
});
