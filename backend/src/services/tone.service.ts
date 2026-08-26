import { countPhrase, isEnglishWord, tokenizeWords } from "./nlp.js";

export type ToneAnalysis = {
  confidence_score: number;
  professionalism_score: number;
  enthusiasm_score: number;
  empathy_score: number;
  assertiveness_score: number;
  filler_word_count: number;
  filler_words: string[];
  speaking_pace: "slow" | "moderate" | "fast";
};

export type ToneSegment = { text?: string; start?: number; end?: number; start_time?: number; end_time?: number };

const FILLERS = ["umm", "uhh", "uh", "um", "basically", "actually", "matlab", "yani", "like", "you know"];
const PROFESSIONAL = ["sir", "madam", "please", "warranty", "invoice", "assalam", "ji"];
const CASUAL = ["yaar", "bhai", "bro", "dude"];
const EMPATHY = ["i understand", "samajh sakta", "no problem", "main samajhta", "that's fair", "i hear you"];
const ASSERTIVE = ["you should", "we recommend", "today", "confirm", "order", "guarantee"];
const ENTHUSIASM = ["!", "wow", "zabardast", "kya baat", "excellent", "perfect"];
const HEDGES = ["maybe", "i think", "perhaps", "probably", "might"];

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function analyzeTone(transcript: string, segments: ToneSegment[] = []): ToneAnalysis {
  const text = transcript.toLowerCase();
  const words = tokenizeWords(transcript);
  const foundFillers = FILLERS.filter((word) => countPhrase(text, word) > 0);
  const fillerCount = FILLERS.reduce((sum, word) => sum + countPhrase(text, word), 0);

  const professionalHits = PROFESSIONAL.reduce((sum, word) => sum + countPhrase(text, word), 0);
  const casualHits = CASUAL.reduce((sum, word) => sum + countPhrase(text, word), 0);
  const empathyHits = EMPATHY.reduce((sum, word) => sum + countPhrase(text, word), 0);
  const assertiveHits = ASSERTIVE.reduce((sum, word) => sum + countPhrase(text, word), 0);
  const enthusiasmHits = ENTHUSIASM.reduce((sum, word) => sum + countPhrase(text, word), 0);
  const hedgeHits = HEDGES.reduce((sum, word) => sum + countPhrase(text, word), 0);

  const duration = segments.reduce((sum, segment) => {
    const start = Number(segment.start_time ?? segment.start ?? 0);
    const end = Number(segment.end_time ?? segment.end ?? start);
    return sum + Math.max(0, end - start);
  }, 0);
  const wpm = duration > 0 ? (words.length / duration) * 60 : 120;
  const speaking_pace: ToneAnalysis["speaking_pace"] = wpm < 90 ? "slow" : wpm > 170 ? "fast" : "moderate";

  const latin = words.filter((word) => /^[a-z]+$/i.test(word) && word.length > 2);
  let dictionaryBoost = 0;
  if (latin.length >= 8) {
    const unique = [...new Set(latin.map((word) => word.toLowerCase()))];
    const known = unique.filter((word) => isEnglishWord(word)).length;
    dictionaryBoost = Math.round((known / unique.length - 0.5) * 16);
  }

  return {
    confidence_score: clamp(78 - fillerCount * 4 - hedgeHits * 5 + assertiveHits * 4),
    professionalism_score: clamp(70 + professionalHits * 6 - casualHits * 8 + dictionaryBoost),
    enthusiasm_score: clamp(55 + enthusiasmHits * 8),
    empathy_score: clamp(50 + empathyHits * 12),
    assertiveness_score: clamp(55 + assertiveHits * 7 - hedgeHits * 6),
    filler_word_count: fillerCount,
    filler_words: foundFillers,
    speaking_pace,
  };
}
