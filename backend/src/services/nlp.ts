import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let wordSet: Set<string> | null = null;

function loadWordSet(): Set<string> {
  if (wordSet != null) return wordSet;
  try {
    const wordListPath = require("word-list") as string;
    const content = readFileSync(wordListPath, "utf8").toLowerCase();
    const set = new Set<string>();
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line) set.add(line);
    }
    wordSet = set;
  } catch {
    wordSet = new Set();
  }
  return wordSet;
}

export function isEnglishWord(word: string): boolean {
  if (word.length < 3) return false;
  const set = loadWordSet();
  return set.has(word.toLowerCase());
}

let wordTokenizerInstance: { tokenize: (value: string) => string[] | null } | null = null;
let sentimentInstance: { analyze: (value: string) => { comparative: number } } | null = null;

export function tokenizeWords(text: string): string[] {
  const normalized = text.toLowerCase();
  try {
    if (!wordTokenizerInstance) {
      const natural = require("natural") as {
        WordTokenizer: new () => { tokenize: (value: string) => string[] | null };
      };
      wordTokenizerInstance = new natural.WordTokenizer();
    }
    return (wordTokenizerInstance.tokenize(normalized) ?? []).filter(Boolean);
  } catch {
    return normalized.match(/[\p{L}\p{N}']+/gu) ?? [];
  }
}

/** AFINN comparative score for English, or 0 if the package is unavailable. */
export function englishSentimentScore(text: string): number {
  try {
    if (!sentimentInstance) {
      const Sentiment = require("sentiment") as new () => {
        analyze: (value: string) => { comparative: number };
      };
      sentimentInstance = new Sentiment();
    }
    return sentimentInstance.analyze(text).comparative;
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
