import type { ConversationStatus, FollowUpPriority, FollowUpStatus, PurchaseIntent, Sentiment } from "../../types/conversation";
import { INTENT_LABEL, SENTIMENT_LABEL, STATUS_LABEL } from "../../lib/format";
import { Badge } from "../ui/badge";

export function StatusBadge({ status }: { status: ConversationStatus }) {
  const tone =
    status === "analyzed" || status === "scored"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "failed"
        ? "bg-red-500/15 text-red-300"
        : status === "processing" || status === "queued"
          ? "bg-amber-500/15 text-amber-300"
          : "bg-slate-700 text-slate-200";
  return <Badge className={tone}>{STATUS_LABEL[status]}</Badge>;
}

export function SentimentBadge({ sentiment }: { sentiment?: Sentiment | null }) {
  if (!sentiment) return <Badge className="bg-slate-800 text-slate-400">No sentiment</Badge>;
  const tone =
    sentiment === "positive"
      ? "bg-emerald-500/15 text-emerald-300"
      : sentiment === "negative"
        ? "bg-red-500/15 text-red-300"
        : "bg-slate-700 text-slate-300";
  return <Badge className={tone}>{SENTIMENT_LABEL[sentiment]}</Badge>;
}

export function PriorityBadge({ priority }: { priority?: FollowUpPriority | null }) {
  const tone =
    priority === "high"
      ? "bg-red-500/15 text-red-300"
      : priority === "medium"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-slate-700 text-slate-300";
  return <Badge className={tone}>{priority ? `${priority} priority` : "No priority"}</Badge>;
}

export function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  const tone =
    status === "completed"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "cancelled"
        ? "bg-slate-700 text-slate-400"
        : status === "snoozed"
          ? "bg-sky-500/15 text-sky-300"
          : "bg-amber-500/15 text-amber-300";
  return <Badge className={tone}>{status}</Badge>;
}

export function EmotionBadge({ emotion }: { emotion?: string | null }) {
  if (!emotion) return <Badge className="bg-slate-800 text-slate-400">No emotion</Badge>;
  const map: Record<string, { emoji: string; className: string; label: string }> = {
    happy: { emoji: "😊", className: "bg-emerald-500/15 text-emerald-300", label: "Happy" },
    excited: { emoji: "🤩", className: "bg-fuchsia-500/15 text-fuchsia-300", label: "Excited" },
    frustrated: { emoji: "😠", className: "bg-red-500/15 text-red-300", label: "Frustrated" },
    confused: { emoji: "😕", className: "bg-amber-500/15 text-amber-200", label: "Confused" },
    anxious: { emoji: "😟", className: "bg-orange-500/15 text-orange-200", label: "Anxious" },
    neutral: { emoji: "😐", className: "bg-slate-700 text-slate-300", label: "Neutral" },
  };
  const tone = map[emotion] ?? map.neutral;
  return (
    <Badge className={tone?.className}>
      {tone?.emoji} {tone?.label}
    </Badge>
  );
}

export function ChurnBadge({ risk }: { risk?: string | null }) {
  const tone =
    risk === "high"
      ? "bg-red-500/15 text-red-300"
      : risk === "medium"
        ? "bg-amber-500/15 text-amber-200"
        : "bg-emerald-500/15 text-emerald-300";
  return <Badge className={tone}>{risk ? `${risk} churn risk` : "Churn unknown"}</Badge>;
}

export function IntentBadge({ intent }: { intent?: PurchaseIntent | null }) {
  if (!intent) return <Badge className="bg-slate-800 text-slate-400">No intent</Badge>;
  const tone =
    intent === "high"
      ? "bg-emerald-500/15 text-emerald-300"
      : intent === "medium"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-slate-700 text-slate-300";
  return <Badge className={tone}>{INTENT_LABEL[intent]}</Badge>;
}
