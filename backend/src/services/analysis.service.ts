import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";

export const analysisSchema = z.object({
  transcript: z.string().default(""),
  summary: z.string().default(""),
  sentiment: z.enum(["positive", "negative", "neutral"]).default("neutral"),
  purchase_intent: z.enum(["high", "medium", "low"]).default("medium"),
  objections: z.array(z.string()).default([]),
  key_points: z.array(z.string()).default([]),
  customer_questions: z.array(z.string()).default([]),
  language: z.string().default("en"),
  duration_spoken_seconds: z.coerce.number().int().nonnegative().default(0),
});

export type ConversationAnalysisResult = z.infer<typeof analysisSchema>;

export type SpeakerSegment = {
  speaker: "salesman" | "customer";
  text: string;
  start: number;
  end: number;
};

const ANALYSIS_PROMPT = `You are analyzing a retail store sales conversation between a salesman and a customer.
Return ONLY valid JSON (no markdown) matching this shape:
{
  "transcript": "full transcript with speaker labels like 'Salesman:' and 'Customer:'",
  "summary": "2-3 sentence summary",
  "sentiment": "positive" | "negative" | "neutral",
  "purchase_intent": "high" | "medium" | "low",
  "objections": ["customer objections"],
  "key_points": ["important moments"],
  "customer_questions": ["questions asked by the customer"],
  "language": "en|ur|pa|ar or other ISO-like code",
  "duration_spoken_seconds": 0
}

Rules:
- Label speakers as Salesman or Customer.
- Prefer the audio as the source of truth.
- Use the live captions only as a hint if provided.
- If audio is silent or unusable, still return JSON with an empty transcript and neutral/low defaults.`;

function getModel() {
  if (!env.GEMINI_API_KEY) {
    throw new HttpError(500, "Gemini API key is not configured.", "GEMINI_NOT_CONFIGURED");
  }

  const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return client.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(raw) as unknown;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new HttpError(504, "Gemini analysis timed out.", "GEMINI_TIMEOUT"));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function enhanceTranscript(aiTranscript: string, liveTranscript: string): string {
  const ai = aiTranscript.trim();
  const live = liveTranscript.trim();
  if (ai.length >= 8) return ai;
  if (live.length > 0) return live;
  return ai || live;
}

export function detectSpeakerSegments(transcript: string, durationSeconds = 0): SpeakerSegment[] {
  const lines = transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const labeled: Array<{ speaker: "salesman" | "customer"; text: string }> = [];
  let current: "salesman" | "customer" = "salesman";

  for (const line of lines) {
    const match = line.match(
      /^(?:\*{0,2}|\[)?\s*(salesman|salesperson|agent|staff|customer|client|buyer|speaker\s*[12])\s*(?:\*{0,2}|\])\s*[:\-–]\s*(.*)$/i,
    );
    if (match) {
      const rawSpeaker = match[1]?.toLowerCase() ?? "";
      const text = (match[2] ?? "").trim();
      if (rawSpeaker.startsWith("customer") || rawSpeaker.startsWith("client") || rawSpeaker.startsWith("buyer") || rawSpeaker === "speaker 2") {
        current = "customer";
      } else {
        current = "salesman";
      }
      if (text) labeled.push({ speaker: current, text });
      continue;
    }
    labeled.push({ speaker: current, text: line });
  }

  const totalChars = labeled.reduce((sum, item) => sum + item.text.length, 0) || 1;
  const totalTime = durationSeconds > 0 ? durationSeconds : labeled.length;
  let cursor = 0;
  return labeled.map((item) => {
    const share = item.text.length / totalChars;
    const start = cursor;
    const end = cursor + share * totalTime;
    cursor = end;
    return {
      speaker: item.speaker,
      text: item.text,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
    };
  });
}

export async function analyzeConversation(
  audioBuffer: Buffer,
  mimeType: string,
  liveTranscript?: string,
): Promise<ConversationAnalysisResult> {
  if (!audioBuffer.length) {
    throw new HttpError(400, "Audio buffer is empty.", "INVALID_AUDIO");
  }

  if (audioBuffer.length > 18 * 1024 * 1024) {
    throw new HttpError(413, "Audio is too large for Gemini inline analysis.", "AUDIO_TOO_LARGE_FOR_AI");
  }

  const model = getModel();
  const hint = liveTranscript?.trim()
    ? `\n\nLive captions hint:\n${liveTranscript.trim().slice(0, 8000)}`
    : "";

  try {
    const result = await withTimeout(
      model.generateContent([
        { text: `${ANALYSIS_PROMPT}${hint}` },
        {
          inlineData: {
            mimeType: mimeType || "audio/webm",
            data: audioBuffer.toString("base64"),
          },
        },
      ]),
      env.GEMINI_TIMEOUT_MS,
    );

    const text = result.response.text();
    const parsed = analysisSchema.parse(extractJson(text));
    return parsed;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof SyntaxError || err instanceof z.ZodError) {
      logger.error({ err }, "Gemini returned unusable analysis JSON");
      throw new HttpError(502, "Gemini returned an unusable analysis.", "GEMINI_INVALID_RESPONSE");
    }
    logger.error({ err }, "Gemini analysis failed");
    throw new HttpError(502, "Gemini analysis failed.", "GEMINI_FAILED");
  }
}
