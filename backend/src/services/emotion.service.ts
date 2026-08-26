import { countPhrase, englishSentimentScore } from "./nlp.js";

export const EMOTIONS = ["happy", "frustrated", "confused", "excited", "anxious", "neutral"] as const;
export type Emotion = (typeof EMOTIONS)[number];

export type EmotionTrigger = { word: string; emotion: Emotion; count: number };

export type EmotionAnalysis = {
  primary_emotion: Emotion;
  emotion_scores: Record<Emotion, number>;
  emotional_intensity: number;
  emotion_triggers: EmotionTrigger[];
};

const LEXICON: Record<Exclude<Emotion, "neutral">, string[]> = {
  happy: ["great", "perfect", "shukriya", "thanks", "thank you", "excellent", "khush", "acha laga", "good job", "satisfied"],
  frustrated: ["mehnga", "not good", "problem", "issue", "bakwas", "worst", "expensive", "gussa", "pareshan", "waste"],
  confused: ["samajh nahi aya", "confused", "unclear", "nahi samajh", "what do you mean", "samajh nahi", "don't get"],
  excited: ["wow", "amazing", "kya baat hai", "zabardast", "awesome", "mast", "bohot acha", "love it"],
  anxious: ["sochna parega", "need to think", "unsure", "maybe later", "dekh ke", "family se", "not sure", "worried"],
};

export function detectEmotion(
  transcript: string,
  analysis?: { sentiment?: string | null; objections?: string[] | null },
): EmotionAnalysis {
  const text = `${transcript} ${(analysis?.objections ?? []).join(" ")}`.trim();
  const raw: Record<Exclude<Emotion, "neutral">, number> = {
    happy: 0,
    frustrated: 0,
    confused: 0,
    excited: 0,
    anxious: 0,
  };
  const triggers: EmotionTrigger[] = [];

  for (const emotion of Object.keys(LEXICON) as Array<Exclude<Emotion, "neutral">>) {
    for (const word of LEXICON[emotion]) {
      const count = countPhrase(text, word);
      if (count > 0) {
        raw[emotion] += count;
        triggers.push({ word, emotion, count });
      }
    }
  }

  if (analysis?.sentiment === "positive") {
    raw.happy += 1;
  } else if (analysis?.sentiment === "negative") {
    raw.frustrated += 1;
  }

  const afinn = englishSentimentScore(transcript);
  if (afinn > 0.2) raw.happy += 1;
  if (afinn < -0.2) raw.frustrated += 1;

  const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
  const scores: Record<Emotion, number> = {
    happy: 0,
    frustrated: 0,
    confused: 0,
    excited: 0,
    anxious: 0,
    neutral: total === 0 ? 1 : 0,
  };

  if (total > 0) {
    for (const emotion of Object.keys(raw) as Array<Exclude<Emotion, "neutral">>) {
      scores[emotion] = Number((raw[emotion] / total).toFixed(3));
    }
  }

  let primary: Emotion = "neutral";
  let best = 0;
  for (const emotion of EMOTIONS) {
    if (emotion === "neutral") continue;
    if (scores[emotion] > best) {
      best = scores[emotion];
      primary = emotion;
    }
  }
  if (best < 0.2) primary = "neutral";

  const intensity = Math.min(1, Number((best + Math.min(0.4, Math.abs(afinn))).toFixed(3)));

  return {
    primary_emotion: primary,
    emotion_scores: scores,
    emotional_intensity: intensity,
    emotion_triggers: triggers.sort((a, b) => b.count - a.count).slice(0, 12),
  };
}
