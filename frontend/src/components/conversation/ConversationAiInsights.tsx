import { useQuery } from "@tanstack/react-query";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { fetchCoaching, fetchRecommendations } from "../../services/api";
import type { ConversationAnalysis } from "../../types/conversation";
import { EmotionBadge } from "./Badges";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export function ConversationAiInsights({
  conversationId,
  analysis,
}: {
  conversationId: string;
  analysis: ConversationAnalysis;
}) {
  const coaching = useQuery({
    queryKey: ["coaching", conversationId],
    queryFn: () => fetchCoaching(conversationId),
  });
  const recs = useQuery({
    queryKey: ["recommendations", conversationId],
    queryFn: () => fetchRecommendations(conversationId),
  });
  const tone = analysis.tone_analysis;
  const radar = tone
    ? [
        { name: "Confidence", value: tone.confidence_score },
        { name: "Professional", value: tone.professionalism_score },
        { name: "Enthusiasm", value: tone.enthusiasm_score },
        { name: "Empathy", value: tone.empathy_score },
        { name: "Assertive", value: tone.assertiveness_score },
      ]
    : [];
  const scores = analysis.emotion_scores ?? {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <EmotionBadge emotion={analysis.primary_emotion} />
        {analysis.emotional_intensity != null ? (
          <span className="text-xs text-slate-400">
            Intensity {Math.round(analysis.emotional_intensity * 100)}%
          </span>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Emotion mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(scores).map(([name, value]) => (
              <div key={name}>
                <div className="flex justify-between text-xs text-slate-400">
                  <span className="capitalize">{name}</span>
                  <span>{Math.round(Number(value) * 100)}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-800">
                  <div
                    className={`h-2 rounded-full ${
                      name === "frustrated" ? "bg-red-500" : name === "happy" || name === "excited" ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                    style={{ width: `${Math.round(Number(value) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {(analysis.emotion_triggers ?? []).slice(0, 6).map((item) => (
              <p key={`${item.word}-${item.emotion}`} className="text-xs text-slate-500">
                “{item.word}” → {item.emotion} ×{item.count}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Voice tone</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {radar.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="#34d399" fill="#34d399" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">Tone scores appear after analysis.</p>
            )}
            {tone ? (
              <p className="mt-2 text-xs text-slate-500">
                Fillers: {tone.filler_word_count} ({tone.filler_words.join(", ") || "none"}) · Pace {tone.speaking_pace}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coaching tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {coaching.isLoading ? <Skeleton className="h-16" /> : null}
          {(coaching.data?.tips ?? []).map((tip) => (
            <div
              key={`${tip.trigger}-${tip.timestamp}`}
              className={`rounded-lg border px-3 py-2 ${
                tip.priority === "high"
                  ? "border-red-500/40 bg-red-950/30"
                  : tip.priority === "medium"
                    ? "border-amber-500/40 bg-amber-950/20"
                    : "border-slate-800"
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">
                <span
                  className={
                    tip.priority === "high"
                      ? "text-red-300"
                      : tip.priority === "medium"
                        ? "text-amber-300"
                        : "text-slate-400"
                  }
                >
                  {tip.priority}
                </span>
                {" · "}
                <a className="text-emerald-400 hover:underline" href={`#seg-${Math.round(tip.timestamp)}`}>
                  {Math.round(tip.timestamp)}s
                </a>
                {" · "}
                {tip.trigger.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-sm text-slate-100">{tip.suggestion}</p>
            </div>
          ))}
          {(coaching.data?.missed_opportunities ?? []).map((item) => (
            <p key={item.description} className="text-sm text-amber-200">
              Missed {item.type}: {item.description}
            </p>
          ))}
          {coaching.isSuccess && !coaching.data?.tips.length ? (
            <p className="text-sm text-slate-400">No coaching tips for this conversation.</p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Product recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recs.isLoading ? <Skeleton className="h-16" /> : null}
          {recs.data?.detected_preferences ? (
            <p className="text-sm text-slate-400">
              Budget {recs.data.detected_preferences.budget_range || "unknown"} ·{" "}
              {recs.data.detected_preferences.brands.join(", ") || "no brand"} ·{" "}
              {recs.data.detected_preferences.use_case || "general"}
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {(recs.data?.recommended_products ?? []).map((product) => (
              <div key={product.name} className="rounded-xl border border-slate-800 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{product.name}</p>
                  <span className="text-sm text-emerald-300">{product.match_score}% match</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{product.reasons.join(" · ")}</p>
              </div>
            ))}
          </div>
          {(recs.data?.upsell_opportunities ?? []).map((item) => (
            <p key={item.product} className="text-sm text-sky-200">
              Upsell {item.product}: {item.reason}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function highlightFillers(text: string, fillers: string[]): string {
  return fillers.reduce(
    (current, word) => current.replaceAll(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), `⟦${word}⟧`),
    text,
  );
}
