import { describe, expect, it } from "vitest";
import { extractCustomerInfo, scoreLead, shouldCreateLead, buildFollowUpMessage } from "./lead.service.js";

describe("extractCustomerInfo", () => {
  it("extracts a Pakistani mobile number and spoken name", () => {
    const info = extractCustomerInfo(
      "Customer: My name is Ahmed Khan. Call me on 03001234567. Salesman: This phone has a great camera.",
      ["Looking at the Galaxy A35"],
    );
    expect(info.phone).toMatch(/03001234567|3001234567/);
    expect(info.name).toMatch(/Ahmed/i);
    expect(info.productInterest).toMatch(/Galaxy/i);
  });
});

describe("scoreLead", () => {
  it("scores a strong lead in a mid-to-high range", () => {
    const score = scoreLead({
      purchaseIntent: "high",
      sentiment: "positive",
      questionCount: 4,
      objectionCount: 1,
      durationSeconds: 400,
    });
    expect(score).toBe(100);
  });

  it("scores a weak lead lower but above zero", () => {
    const score = scoreLead({
      purchaseIntent: "low",
      sentiment: "negative",
      questionCount: 0,
      objectionCount: 6,
      durationSeconds: 40,
    });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(30);
  });
});

describe("shouldCreateLead", () => {
  it("creates leads for high/medium intent with non-negative sentiment", () => {
    expect(shouldCreateLead("high", "positive")).toBe(true);
    expect(shouldCreateLead("medium", "neutral")).toBe(true);
    expect(shouldCreateLead("high", "negative")).toBe(false);
    expect(shouldCreateLead("low", "positive")).toBe(false);
  });
});

describe("buildFollowUpMessage", () => {
  it("includes the product and a greeting", () => {
    const message = buildFollowUpMessage({
      customerName: "Ahmed",
      productInterest: "Galaxy A35",
      objections: ["price"],
      sentiment: "positive",
    });
    expect(message).toMatch(/Ahmed/);
    expect(message).toMatch(/Galaxy A35/);
  });
});
