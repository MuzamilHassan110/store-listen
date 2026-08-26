import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let wordListText: string | null = null;

function loadWordListText(): string {
  if (wordListText != null) return wordListText;
  try {
    const wordListPath = require("word-list") as string;
    wordListText = `\n${readFileSync(wordListPath, "utf8").toLowerCase()}\n`;
  } catch {
    wordListText = "";
  }
  return wordListText;
}

export function isEnglishWord(word: string): boolean {
  const dict = loadWordListText();
  if (!dict || word.length < 3) return false;
  return dict.includes(`\n${word.toLowerCase()}\n`);
}

export function tokenizeWords(text: string): string[] {
  const normalized = text.toLowerCase();
  try {
    const natural = require("natural") as {
      WordTokenizer: new () => { tokenize: (value: string) => string[] | null };
    };
    return (new natural.WordTokenizer().tokenize(normalized) ?? []).filter(Boolean);
  } catch {
    return normalized.match(/[\p{L}\p{N}']+/gu) ?? [];
  }
}

/** AFINN comparative score for English, or 0 if the package is unavailable. */
export function englishSentimentScore(text: string): number {
  try {
    const Sentiment = require("sentiment") as new () => {
      analyze: (value: string) => { comparative: number };
    };
    return new Sentiment().analyze(text).comparative;
  } catch {
    return 0;
  }
}

export function countPhrase(haystack: string, phrase: string): number {
  const source = haystack.toLowerCase();
  const needle = phrase.toLowerCase();
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (from <= source.length) {
    const at = source.indexOf(needle, from);
    if (at < 0) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}
