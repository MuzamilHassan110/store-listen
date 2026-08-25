import { describe, expect, it } from "vitest";
import { hashRecordingBuffer } from "../lib/hash.js";
import { analysisSchema, normalizeAnalysisResult, resolveTranscripts } from "./analysis.service.js";
import {
  detectLanguageFromText,
  languageGuidance,
  normalizeLanguage,
  SUPPORTED_LANGUAGES,
} from "./language.js";

const SAMPLES = {
  en: "Salesman: This jacket is on sale today.\nCustomer: How much is it?",
  ur: "سیلز مین: یہ جیکٹ آج سیل پہ ہے۔\nکسٹمر: مہنگا ہے، ریٹ کم کرو۔",
  pa: "\u0A07\u0A39 \u0A1C\u0A48\u0A15\u0A1F \u0A05\u0A71\u0A1C \u0A38\u0A47\u0A32 \u0A24\u0A47 \u0A39\u0A48 \u0A2C\u0A39\u0A41\u0A24 \u0A2E\u0A39\u0A3F\u0A70\u0A17\u0A3E",
  ar: "البائع: هذا المعطف عليه تخفيض اليوم.\nالعميل: غالي، في خصم؟",
  hi: "सेल्समैन: यह जैकेट आज सेल पर है।\nग्राहक: महंगा है, रेट कम करो।",
};

describe("normalizeLanguage", () => {
  it("maps aliases to supported codes", () => {
    expect(normalizeLanguage("Urdu")).toBe("ur");
    expect(normalizeLanguage("pa-IN")).toBe("pa");
    expect(normalizeLanguage("arabic")).toBe("ar");
    expect(normalizeLanguage("unknown")).toBe("en");
  });
});

describe("language detection from sample text", () => {
  it("detects English, Urdu, Punjabi, Arabic, and Hindi", () => {
    expect(detectLanguageFromText(SAMPLES.en).language).toBe("en");
    expect(detectLanguageFromText(SAMPLES.ur).language).toBe("ur");
    expect(detectLanguageFromText(SAMPLES.pa).language).toBe("pa");
    expect(detectLanguageFromText(SAMPLES.ar).language).toBe("ar");
    expect(detectLanguageFromText(SAMPLES.hi).language).toBe("hi");
  });

  it("returns a confidence score", () => {
    const urdu = detectLanguageFromText(SAMPLES.ur);
    expect(urdu.confidence).toBeGreaterThan(0.5);
  });
});

describe("language-specific prompts", () => {
  it("includes local objection phrases", () => {
    expect(languageGuidance("ur")).toContain("mehnga hai");
    expect(languageGuidance("pa")).toContain("rate ghatt karo");
    expect(languageGuidance("ar")).toContain("السلام عليكم");
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "ur", "pa", "ar", "hi"]);
  });
});

describe("analysis language fields", () => {
  it("accepts original and translated transcripts", () => {
    const parsed = normalizeAnalysisResult(
      analysisSchema.parse({
        original_transcript: SAMPLES.ur,
        translated_transcript: SAMPLES.en,
        summary: "Customer wants a lower price.",
        summary_original: "گاہک قیمت کم چاہتا ہے۔",
        language: "ur",
        language_confidence: 0.91,
        language_specific_insights: { local_objections: ["مہنگا ہے"] },
      }),
    );
    expect(parsed.language_code).toBe("ur");
    expect(parsed.transcript).toBe(SAMPLES.en);
    expect(parsed.language_specific_insights.local_objections).toContain("مہنگا ہے");
  });

  it("prefers English text for scoring", () => {
    const resolved = resolveTranscripts(
      analysisSchema.parse({
        original_transcript: SAMPLES.ar,
        translated_transcript: SAMPLES.en,
        language: "ar",
      }),
      "",
    );
    expect(resolved.scoring).toBe(SAMPLES.en);
    expect(resolved.original).toBe(SAMPLES.ar);
  });
});

describe("recording hash", () => {
  it("is stable for the same audio bytes", () => {
    const buffer = Buffer.from("storelisten-audio");
    expect(hashRecordingBuffer(buffer)).toBe(hashRecordingBuffer(buffer));
    expect(hashRecordingBuffer(buffer)).not.toBe(hashRecordingBuffer(Buffer.from("other")));
  });
});

/**
 * Accuracy notes (text heuristic, not Gemini audio):
 * - English: high on Latin-only samples
 * - Urdu vs Arabic: Urdu-specific letters raise Urdu confidence; dialect-only Arabic may be labeled ar
 * - Punjabi: reliable on Gurmukhi; Shahmukhi Punjabi can look like Urdu
 * - Hindi: reliable on Devanagari
 * Gemini audio detection is expected to outperform this fallback for mixed speech.
 */
