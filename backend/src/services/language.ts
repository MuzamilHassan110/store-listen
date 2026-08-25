export const SUPPORTED_LANGUAGES = ["en", "ur", "pa", "ar", "hi"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  en: "en",
  eng: "en",
  english: "en",
  ur: "ur",
  urd: "ur",
  urdu: "ur",
  pa: "pa",
  pan: "pa",
  punjabi: "pa",
  panjabi: "pa",
  ar: "ar",
  ara: "ar",
  arabic: "ar",
  hi: "hi",
  hin: "hi",
  hindi: "hi",
};

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  const raw = (value ?? "en").trim().toLowerCase().split(/[-_]/)[0] ?? "en";
  return LANGUAGE_ALIASES[raw] ?? (SUPPORTED_LANGUAGES.includes(raw as SupportedLanguage) ? (raw as SupportedLanguage) : "en");
}

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  const raw = (value ?? "").trim().toLowerCase();
  return SUPPORTED_LANGUAGES.includes(raw as SupportedLanguage);
}

export function detectLanguageFromText(text: string): { language: SupportedLanguage; confidence: number } {
  const sample = text.trim();
  if (!sample) return { language: "en", confidence: 0 };

  const letters = sample.replace(/\s+/g, "");
  const total = letters.length || 1;
  const arabicChars = (sample.match(/[\u0600-\u06FF]/g) ?? []).length;
  const urduMarks = (sample.match(/[ےگپچژڈٹں]/g) ?? []).length;
  const gurmukhi = (sample.match(/[\u0A00-\u0A7F]/g) ?? []).length;
  const devanagari = (sample.match(/[\u0900-\u097F]/g) ?? []).length;

  if (gurmukhi / total > 0.12) {
    return { language: "pa", confidence: clampConfidence(0.55 + gurmukhi / total) };
  }
  if (devanagari / total > 0.12) {
    return { language: "hi", confidence: clampConfidence(0.55 + devanagari / total) };
  }
  if (arabicChars / total > 0.12) {
    if (urduMarks > 0) {
      return { language: "ur", confidence: clampConfidence(0.6 + urduMarks / Math.max(arabicChars, 1)) };
    }
    return { language: "ar", confidence: clampConfidence(0.6 + arabicChars / total) };
  }
  return { language: "en", confidence: 0.55 };
}

function clampConfidence(value: number): number {
  return Math.min(0.99, Math.max(0.4, Number(value.toFixed(2))));
}

export const LANGUAGE_PROMPTS: Record<SupportedLanguage, string> = {
  en: `English retail notes:
- Watch for price, warranty, return, and "I'll think about it" objections.
- Keep speaker labels as Salesman: and Customer:.`,
  ur: `Urdu retail notes:
- Transcribe in Urdu script (Nastaliq-friendly).
- Common objections/idioms: "مهنگا ہے" / "mehnga hai", "ریٹ کم کرو" / "rate kam karo", "سوچ کے بتاتا ہوں", "اور دکان میں سستا ہے", "بعد میں آؤں گا", "ڈسکاؤنٹ دو".
- Capture honorifics (جی, حضور, بھائی) and soft refusals.
- Analyze sentiment using Urdu tone, not a literal English gloss.
- summary must be English for the dashboard; summary_original must be Urdu.`,
  pa: `Punjabi retail notes:
- Transcribe in the script actually spoken (Shahmukhi or Gurmukhi).
- Common phrases: "bahut mehnga", "rate ghatt karo", "soch ke dassange", "hor shop vich sasta", "discount de do", "baad vich aaunga".
- Keep warm/familiar address (veere, paaji, bibi) in the original transcript.
- summary in English; summary_original in Punjabi.`,
  ar: `Arabic retail notes:
- Transcribe in Arabic script. Preserve greetings: السلام عليكم, وعليكم السلام, تفضل, حياك الله.
- Common objections: غالي, غالي جدا, في خصم؟, أفكر, بسعر أقل, عند غيركم أرخص.
- Formal vs dialectal tone matters for sentiment.
- summary in English; summary_original in Arabic.`,
  hi: `Hindi retail notes:
- Transcribe in Devanagari when spoken in Hindi.
- Common objections: "महंगा है", "रेट कम करो", "सोच के बताता हूँ", "डिस्काउंट दो".
- summary in English; summary_original in Hindi.`,
};

export function languageGuidance(hintLanguage?: string | null): string {
  return LANGUAGE_PROMPTS[normalizeLanguage(hintLanguage)];
}

export function languageDisplayName(code: string | null | undefined): string {
  switch (normalizeLanguage(code)) {
    case "ur":
      return "Urdu";
    case "pa":
      return "Punjabi";
    case "ar":
      return "Arabic";
    case "hi":
      return "Hindi";
    default:
      return "English";
  }
}
