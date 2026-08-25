import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import { analyzeConversation } from "./analysis.service.js";
import {
  persistAnalysisResult,
  setConversationStatus,
  type ConversationBundle,
} from "./conversation.service.js";
import { createNotification } from "./notification.service.js";

export type AnalysisJob = {
  conversationId: string;
  liveTranscript: string;
  buffer?: Buffer;
  mimeType: string;
  loadAudio?: () => Promise<{ buffer: Buffer; mimeType: string }>;
};

export type AnalysisJobResult = {
  ok: boolean;
  timedOut?: boolean;
  error?: { message: string; code: string };
  bundle?: ConversationBundle;
};

type QueuedJob = AnalysisJob & {
  waiters: Array<(result: AnalysisJobResult) => void>;
};

const jobs: QueuedJob[] = [];
const waitersById = new Map<string, Array<(result: AnalysisJobResult) => void>>();
const completed = new Map<string, AnalysisJobResult>();
let pumping = false;

function notify(conversationId: string, result: AnalysisJobResult): void {
  completed.set(conversationId, result);
  const waiters = waitersById.get(conversationId) ?? [];
  waitersById.delete(conversationId);
  for (const waiter of waiters) waiter(result);
}

export function enqueueAnalysis(job: AnalysisJob): void {
  const existing = jobs.find((item) => item.conversationId === job.conversationId);
  if (existing) return;
  jobs.push({ ...job, waiters: [] });
  void pump();
}

export function waitForAnalysis(conversationId: string, timeoutMs: number): Promise<AnalysisJobResult> {
  const already = completed.get(conversationId);
  if (already) return Promise.resolve(already);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, timedOut: true, error: { message: "Analysis is still running.", code: "ANALYSIS_PENDING" } });
    }, timeoutMs);

    const list = waitersById.get(conversationId) ?? [];
    list.push((result) => {
      clearTimeout(timer);
      resolve(result);
    });
    waitersById.set(conversationId, list);
  });
}

export async function enqueueAndWait(job: AnalysisJob, timeoutMs: number): Promise<AnalysisJobResult> {
  const pending = waitForAnalysis(job.conversationId, timeoutMs);
  enqueueAnalysis(job);
  return pending;
}

async function processJob(job: QueuedJob): Promise<AnalysisJobResult> {
  await setConversationStatus(job.conversationId, "processing");
  try {
    const audio = job.buffer
      ? { buffer: job.buffer, mimeType: job.mimeType }
      : await job.loadAudio?.();
    if (!audio) {
      throw new HttpError(400, "No audio available for analysis.", "INVALID_AUDIO");
    }

    const analysis = await analyzeConversation(audio.buffer, audio.mimeType, job.liveTranscript);
    const bundle = await persistAnalysisResult({
      conversationId: job.conversationId,
      liveTranscript: job.liveTranscript,
      analysis,
    });
    return { ok: true, bundle };
  } catch (err) {
    await setConversationStatus(job.conversationId, "failed");
    const message = err instanceof HttpError ? err.message : "Gemini analysis failed.";
    const code = err instanceof HttpError ? err.code : "GEMINI_FAILED";
    logger.error({ err, conversationId: job.conversationId }, "Analysis job failed");
    try {
      const { data } = await getSupabase()
        .from("conversations")
        .select("organization_id")
        .eq("id", job.conversationId)
        .maybeSingle();
      if (data?.organization_id) {
        await createNotification({
          organizationId: String(data.organization_id),
          type: "analysis_failed",
          title: "AI analysis failed",
          message,
          metadata: { conversation_id: job.conversationId, code },
        });
      }
    } catch (notifyError) {
      logger.warn({ notifyError }, "Could not create analysis-failed notification");
    }
    return { ok: false, error: { message, code } };
  }
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  while (jobs.length > 0) {
    const job = jobs.shift();
    if (!job) break;
    const result = await processJob(job);
    notify(job.conversationId, result);
  }
  pumping = false;
}
