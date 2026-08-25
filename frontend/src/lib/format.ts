import { format, formatDistanceToNow, parseISO } from "date-fns";
import type { ConversationStatus, PurchaseIntent, Sentiment } from "../types/conversation";

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return format(parseISO(value), "MMM d, yyyy h:mm a");
}

export function formatRelative(value?: string | null): string {
  if (!value) return "—";
  return formatDistanceToNow(parseISO(value), { addSuffix: true });
}

export function formatDuration(totalSeconds?: number | null): string {
  const seconds = Math.max(0, Math.round(totalSeconds ?? 0));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatHours(totalSeconds?: number | null): string {
  const hours = (totalSeconds ?? 0) / 3600;
  return `${hours.toFixed(1)}h`;
}

export const STATUS_LABEL: Record<ConversationStatus, string> = {
  recorded: "Recorded",
  queued: "Queued",
  processing: "Processing",
  analyzed: "Analyzed",
  scored: "Scored",
  failed: "Failed",
};

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
};

export const INTENT_LABEL: Record<PurchaseIntent, string> = {
  high: "High intent",
  medium: "Medium intent",
  low: "Low intent",
};
