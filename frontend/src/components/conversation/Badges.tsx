import type { ConversationStatus, PurchaseIntent, Sentiment } from "../../types/conversation";
import { INTENT_LABEL, SENTIMENT_LABEL, STATUS_LABEL } from "../../lib/format";
import { Badge } from "../ui/badge";

export function StatusBadge({ status }: { status: ConversationStatus }) {
  const tone =
    status === "analyzed"
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
