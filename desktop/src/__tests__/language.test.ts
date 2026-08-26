import { describe, expect, it } from "vitest";
import { isRtlLanguage, shortLanguageCode, speechLocale } from "../lib/language";

describe("desktop language helpers", () => {
  it("normalizes language tags", () => {
    expect(shortLanguageCode("ur-PK")).toBe("ur");
    expect(shortLanguageCode("zz")).toBe("en");
    expect(speechLocale("ar")).toBe("ar-SA");
    expect(isRtlLanguage("ur")).toBe(true);
    expect(isRtlLanguage("en")).toBe(false);
  });
});
