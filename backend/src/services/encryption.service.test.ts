import { describe, expect, it } from "vitest";
import { decryptText, encryptText, hashPhone, isEncrypted } from "./encryption.service.js";

describe("encryption.service", () => {
  it("round-trips plaintext when a key is configured", () => {
    const source = "+92 300 1234567";
    const sealed = encryptText(source);
    expect(sealed).toBeTruthy();
    if (process.env.ENCRYPTION_KEY) {
      expect(isEncrypted(sealed)).toBe(true);
      expect(decryptText(sealed)).toBe(source);
    } else {
      expect(decryptText(sealed)).toBe(source);
    }
  });

  it("leaves legacy plaintext readable", () => {
    expect(decryptText("03001234567")).toBe("03001234567");
    expect(isEncrypted("03001234567")).toBe(false);
  });

  it("hashes phone digits consistently", () => {
    expect(hashPhone("0300-1234567")).toBe(hashPhone("03001234567"));
    expect(hashPhone("abc")).toBeNull();
  });
});
