import { describe, expect, it } from "vitest";
import speakeasy from "speakeasy";
import { verifyTotp } from "./2fa.service.js";

describe("verifyTotp", () => {
  it("accepts a current code for a known secret", () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const token = speakeasy.totp({ secret, encoding: "base32" });
    expect(verifyTotp(secret, token)).toBe(true);
    expect(verifyTotp(secret, "000000")).toBe(false);
  });
});
