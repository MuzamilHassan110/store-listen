import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Frown, Meh, Pause, Play, RefreshCw, Smile } from "lucide-react";
import { fetchConversationAnalysis, retryAnalysis } from "../services/api";
import { formatDateTime, formatDuration } from "../lib/format";
import { IntentBadge, SentimentBadge, StatusBadge } from "../components/conversation/Badges";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

function formatClock(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export default function ConversationDetail() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

  const detail = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => fetchConversationAnalysis(id),
    enabled: Boolean(id),
  });

  const retry = useMutation({
    mutationFn: () => retryAnalysis(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversation", id] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const conversation = detail.data;
  const duration = conversation?.duration_seconds ?? 0;
  const segments = useMemo(() => conversation?.segments ?? [], [conversation]);

  async function togglePlay(): Promise<void> {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (detail.isError) {
    return <ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} />;
  }

  if (!conversation) {
    return <EmptyState title="Conversation not found" hint="It may have been deleted or is outside your organization." />;
  }

  const analysis = conversation.analysis;
  const canRetry =
    conversation.status === "failed" ||
    conversation.status === "recorded" ||
    conversation.status === "queued" ||
    (conversation.status !== "processing" && !analysis);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/conversations" className="text-sm text-emerald-400">
            ← Conversations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{formatDateTime(conversation.recorded_at)}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={conversation.status} />
            <span className="text-sm text-slate-400">{formatDuration(conversation.duration_seconds)}</span>
            <span className="text-sm uppercase text-slate-400">{conversation.language ?? "—"}</span>
          </div>
        </div>
        {canRetry ? (
          <Button onClick={() => retry.mutate()} disabled={retry.isPending}>
            <RefreshCw className="h-4 w-4" />
            {retry.isPending ? "Retrying…" : "Retry analysis"}
          </Button>
        ) : null}
      </div>
      {retry.isError ? <p className="text-sm text-red-300">{retry.error.message}</p> : null}

      {conversation.recording_url ? (
        <Card>
          <CardHeader>
            <CardTitle>Audio</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <audio
              ref={audioRef}
              src={conversation.recording_url}
              onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
              onEnded={() => setPlaying(false)}
            />
            <Button variant="secondary" onClick={() => void togglePlay()}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "Pause" : "Play"}
            </Button>
            <input
              type="range"
              min={0}
              max={duration || 1}
              value={current}
              onChange={(e) => {
                const value = Number(e.target.value);
                setCurrent(value);
                if (audioRef.current) audioRef.current.currentTime = value;
              }}
              className="min-w-[180px] flex-1"
            />
            <span className="text-sm text-slate-400">
              {formatClock(current)} / {formatDuration(duration)}
            </span>
            <a href={conversation.recording_url} download className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm">
              <Download className="h-4 w-4" />
              Download
            </a>
          </CardContent>
        </Card>
      ) : null}

      {analysis ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-300">{analysis.summary || "No summary yet."}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sentiment</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              {analysis.sentiment === "positive" ? (
                <Smile className="h-8 w-8 text-emerald-400" />
              ) : analysis.sentiment === "negative" ? (
                <Frown className="h-8 w-8 text-red-400" />
              ) : (
                <Meh className="h-8 w-8 text-slate-400" />
              )}
              <SentimentBadge sentiment={analysis.sentiment} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Purchase intent</CardTitle>
            </CardHeader>
            <CardContent>
              <IntentBadge intent={analysis.purchase_intent} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Language</CardTitle>
            </CardHeader>
            <CardContent className="uppercase">{analysis.language ?? conversation.language ?? "—"}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Objections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(analysis.objections.length ? analysis.objections : ["None recorded"]).map((item) => (
                <p key={item} className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-100">
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Customer questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(analysis.customer_questions.length ? analysis.customer_questions : ["None recorded"]).map((item) => (
                <p key={item} className="rounded-lg bg-sky-950/50 px-3 py-2 text-sm text-sky-100">
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Key points</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(analysis.key_points.length ? analysis.key_points : ["None recorded"]).map((item) => (
                <p key={item} className="rounded-lg bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState title="No AI analysis yet" hint="Use Retry analysis after the recording is uploaded." />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {segments.length ? (
            segments.map((segment) => (
              <div
                key={segment.id}
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  segment.speaker === "salesman"
                    ? "bg-sky-950/60 text-sky-50"
                    : "ml-auto bg-emerald-950/60 text-emerald-50"
                }`}
              >
                <p className="text-xs uppercase tracking-wide opacity-70">
                  {segment.speaker} · {formatClock(segment.start_time)}
                </p>
                <p className="mt-1">{segment.text}</p>
              </div>
            ))
          ) : (
            <p className="whitespace-pre-wrap text-sm text-slate-300">
              {conversation.transcript?.text || "No transcript saved."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
