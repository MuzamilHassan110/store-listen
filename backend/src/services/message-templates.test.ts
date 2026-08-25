import { describe, expect, it } from "vitest";
import {
  FOLLOW_UP_TEMPLATE,
  getDefaultTemplate,
  isQuietHours,
  normalizePhone,
  renderMessageTemplate,
} from "./message-templates.js";

describe("renderMessageTemplate", () => {
  it("fills follow-up placeholders", () => {
    const text = renderMessageTemplate(FOLLOW_UP_TEMPLATE, {
      customer_name: "Ali",
      salesman_name: "Sara",
      store_name: "Mall Road",
      product_name: "LED TV",
      date: "2026-08-25",
      phone: "03001234567",
    });
    expect(text).toContain("Ali");
    expect(text).toContain("LED TV");
    expect(text).not.toContain("{customer_name}");
  });

  it("replaces missing values with a dash", () => {
    expect(renderMessageTemplate("Hello {name}", {})).toBe("Hello —");
  });
});

describe("isQuietHours", () => {
  it("treats 10 PM to 9 AM as quiet", () => {
    expect(isQuietHours(new Date("2026-08-25T22:30:00"), 22, 9)).toBe(true);
    expect(isQuietHours(new Date("2026-08-25T02:00:00"), 22, 9)).toBe(true);
    expect(isQuietHours(new Date("2026-08-25T09:00:00"), 22, 9)).toBe(false);
    expect(isQuietHours(new Date("2026-08-25T15:00:00"), 22, 9)).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("normalizes Pakistani local numbers", () => {
    expect(normalizePhone("03001234567")).toBe("923001234567");
    expect(normalizePhone("+92 300 1234567")).toBe("923001234567");
  });
});

describe("getDefaultTemplate", () => {
  it("returns a shorter SMS follow-up than WhatsApp", () => {
    const sms = getDefaultTemplate("follow_up", "sms");
    const wa = getDefaultTemplate("follow_up", "whatsapp");
    expect(sms.length).toBeLessThan(wa.length);
  });
});
