import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { HttpError } from "../lib/http-error.js";

const CHUNK_TIMEOUT_MS = 25_000;
const SUGGESTION_TIMEOUT_MS = 20_000;

const conversationChunkCounters = new Map<string, number>();

export function getAndIncrementChunkCount(conversationId: string): number {
  const current = conversationChunkCounters.get(conversationId) ?? 0;
  const next = current + 1;
  conversationChunkCounters.set(conversationId, next);
  return next;
}

export function clearChunkCounter(conversationId: string): void {
  conversationChunkCounters.delete(conversationId);
}

function getGeminiClient() {
  if (!env.GEMINI_API_KEY) {
    throw new HttpError(500, "Gemini API key is not configured.", "GEMINI_NOT_CONFIGURED");
  }
  return new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
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

const CHUNK_TRANSCRIPTION_PROMPT = `You are a real-time speech transcriber listening to a short audio segment of an in-store retail sales conversation.
Transcribe accurately the speech in this audio chunk in whatever language is spoken (e.g. Urdu, English, Hindi, Roman Urdu, Arabic, etc.).
Rules:
- If clear from context or voice, you may prefix speaker label like "Salesman:" or "Customer:".
- Do not repeat previous context. Transcribe only what was spoken in this specific chunk.
- If the audio is silence, background noise, or unintelligible, return an empty string.
- Return ONLY the plain text transcript delta without markdown or explanation.`;

const LIVE_SUGGESTION_PROMPT = `You are an expert real-time AI retail sales coach listening to an ongoing live conversation between a salesman and a customer.
Given the transcript of the conversation so far, provide ONE concise, actionable suggestion (maximum 20 words) for the salesman right now (e.g. handle a price objection, highlight a warranty/feature, ask a qualifying question, suggest EMI, or attempt a close).
Return ONLY the single suggestion string without quotes or preamble.`;

const FALLBACK_MODELS = [env.GEMINI_MODEL, "gemini-3.7-flash", "gemini-flash-latest", "gemini-3.5-flash", "gemini-3.6-flash"];

async function generateWithModelFallback(
  client: GoogleGenerativeAI,
  contents: Parameters<ReturnType<GoogleGenerativeAI["getGenerativeModel"]>["generateContent"]>[0],
  timeoutMs: number,
  timeoutMessage: string,
  temperature = 0.1,
) {
  const models = [...new Set(FALLBACK_MODELS.filter(Boolean))];
  let lastError: unknown;

  for (const modelName of models) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature },
      });
      return await withTimeout(model.generateContent(contents), timeoutMs, timeoutMessage);
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (status === 503 || status === 429 || status === 404) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function transcribeChunk(input: {
  audioBuffer: Buffer;
  mimeType: string;
  transcriptContext?: string;
}): Promise<{ transcriptDelta: string; error?: boolean }> {
  if (!input.audioBuffer.length) {
    return { transcriptDelta: "", error: false };
  }

  try {
    const client = getGeminiClient();
    const contextPrompt = input.transcriptContext?.trim()
      ? `\n\nRecent conversation context so far:\n${input.transcriptContext.trim().slice(-4000)}`
      : "";

    const response = await generateWithModelFallback(
      client,
      [
        { text: `${CHUNK_TRANSCRIPTION_PROMPT}${contextPrompt}` },
        {
          inlineData: {
            mimeType: input.mimeType || "audio/webm",
            data: input.audioBuffer.toString("base64"),
          },
        },
      ],
      CHUNK_TIMEOUT_MS,
      "Chunk transcription timed out",
      0.1,
    );

    const transcriptDelta = response.response.text().trim();
    return { transcriptDelta, error: false };
  } catch (err) {
    logger.warn({ err }, "Failed to transcribe audio chunk with Gemini");
    return { transcriptDelta: "", error: true };
  }
}

export async function generateLiveSuggestion(accumulatedTranscript: string): Promise<string | undefined> {
  const text = accumulatedTranscript.trim();
  if (!text || text.length < 15) {
    return undefined;
  }

  try {
    const client = getGeminiClient();
    const response = await generateWithModelFallback(
      client,
      [{ text: `${LIVE_SUGGESTION_PROMPT}\n\nAccumulated transcript so far:\n${text.slice(-5000)}` }],
      SUGGESTION_TIMEOUT_MS,
      "Live suggestion generation timed out",
      0.3,
    );

    const suggestion = response.response.text().trim().replace(/^["']|["']$/g, "");
    return suggestion || undefined;
  } catch (err) {
    logger.warn({ err }, "Failed to generate live suggestion with Gemini");
    return undefined;
  }
}

export async function processStreamChunk(input: {
  conversationId: string;
  audioBuffer: Buffer;
  mimeType: string;
  transcriptContext?: string;
}): Promise<{ transcriptDelta: string; suggestion?: string; error?: boolean }> {
  const chunkCount = getAndIncrementChunkCount(input.conversationId);
  const transcriptionResult = await transcribeChunk({
    audioBuffer: input.audioBuffer,
    mimeType: input.mimeType,
    transcriptContext: input.transcriptContext,
  });

  let suggestion: string | undefined;
  const shouldGenerateSuggestion =
    chunkCount % env.LIVE_SUGGESTION_EVERY_N_CHUNKS === 0;

  if (shouldGenerateSuggestion) {
    const combinedTranscript = [input.transcriptContext, transcriptionResult.transcriptDelta]
      .filter(Boolean)
      .join(" ");
    suggestion = await generateLiveSuggestion(combinedTranscript);
  }

  return {
    transcriptDelta: transcriptionResult.transcriptDelta,
    suggestion,
    error: transcriptionResult.error,
  };
}
