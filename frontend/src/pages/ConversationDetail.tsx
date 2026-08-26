import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Frown, Meh, RefreshCw, Smile } from "lucide-react";
import { MobileAudioPlayer } from "../components/audio/MobileAudioPlayer";
import { useLanguage } from "../contexts/LanguageContext";
import { detectConversationLead, fetchConversationAnalysis, generateConversationPdf, retryAnalysis, scoreConversation, translateConversation } from "../services/api";
import { formatDateTime, formatDuration } from "../lib/format";
import { EmotionBadge, IntentBadge, SentimentBadge, StatusBadge } from "../components/conversation/Badges";
import { ConversationAiInsights } from "../components/conversation/ConversationAiInsights";
import { ScoreBar } from "../components/conversation/ScoreBar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

function formatClock(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type TranscriptView = "original" | "english" | "side-by-side";

export default function ConversationDetail() {
  const { id = "" } = useParams();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [transcriptView, setTranscriptView] = useState<TranscriptView>("original");

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
  const score = useMutation({
    mutationFn: () => scoreConversation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversation", id] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
  const pdf = useMutation({
    mutationFn: () => generateConversationPdf(id),
  });
  const detectLead = useMutation({
    mutationFn: () => detectConversationLead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["followups"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const translate = useMutation({
    mutationFn: (target: string) => translateConversation(id, target),
  });

  const conversation = detail.data;
  const duration = conversation?.duration_seconds ?? 0;
  const segments = useMemo(() => conversation?.segments ?? [], [conversation]);


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
    return <EmptyState title={t("errors.conversationNotFound")} hint={t("errors.conversationNotFoundHint")} />;
  }

  const analysis = conversation.analysis;
  const transcript = conversation.transcript;
  const originalTranscript = transcript?.original_text || transcript?.text || "";
  const englishTranscript =
    translate.data?.transcript.translated || transcript?.translated_text || (transcript?.original_language === "en" ? originalTranscript : transcript?.text) || "";
  const summaryText =
    language !== "en" && (translate.data?.analysis?.summary || analysis?.summary_original)
      ? translate.data?.analysis?.summary || analysis?.summary_original || analysis?.summary
      : analysis?.summary;
  const objectionList = translate.data?.analysis?.objections?.length ? translate.data.analysis.objections : analysis?.objections ?? [];
  const questionList = translate.data?.analysis?.customer_questions?.length
    ? translate.data.analysis.customer_questions
    : analysis?.customer_questions ?? [];
  const keyPointList = translate.data?.analysis?.key_points?.length ? translate.data.analysis.key_points : analysis?.key_points ?? [];
  const insights = analysis?.language_specific_insights;
  const canRetry =
    conversation.status === "failed" ||
    conversation.status === "recorded" ||
    conversation.status === "queued" ||
    (conversation.status !== "processing" && !analysis);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/conversations" className="inline-flex items-center gap-1 text-sm text-emerald-400">
            <ArrowLeft className="h-4 w-4 rtl-flip" />
            {t("conversation.back")}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{formatDateTime(conversation.recorded_at)}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={conversation.status} />
            {analysis?.primary_emotion ? <EmotionBadge emotion={analysis.primary_emotion} /> : null}
            <span className="text-sm text-slate-400">{formatDuration(conversation.duration_seconds)}</span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs uppercase text-slate-200">
              {conversation.analysis?.language_code ?? conversation.language ?? "—"}
              {conversation.analysis?.language_confidence != null
                ? ` · ${Math.round(conversation.analysis.language_confidence * 100)}% ${t("conversation.confidence")}`
                : ""}
            </span>
            {conversation.salesman_id ? (
              <Link to={`/salesmen/${conversation.salesman_id}`} className="text-sm text-emerald-400">
                {conversation.salesman_name ?? t("conversation.salesman")}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {analysis && analysis.overall_score == null ? (
            <Button variant="secondary" onClick={() => score.mutate()} disabled={score.isPending}>
              {score.isPending ? t("conversation.scoring") : t("conversation.computeScores")}
            </Button>
          ) : null}
          {analysis ? (
            <Button variant="secondary" onClick={() => detectLead.mutate()} disabled={detectLead.isPending}>
              {detectLead.isPending ? t("conversation.detecting") : t("conversation.detectLead")}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => pdf.mutate()} disabled={pdf.isPending}>
            {pdf.isPending ? t("conversation.buildingPdf") : t("conversation.pdf")}
          </Button>
          {canRetry ? (
            <Button onClick={() => retry.mutate()} disabled={retry.isPending}>
              <RefreshCw className="h-4 w-4" />
              {retry.isPending ? t("conversation.retrying") : t("conversation.retryAnalysis")}
            </Button>
          ) : null}
        </div>
      </div>
      {retry.isError ? <p className="text-sm text-red-300">{retry.error.message}</p> : null}
      {score.isError ? <p className="text-sm text-red-300">{score.error.message}</p> : null}
      {detectLead.isError ? <p className="text-sm text-red-300">{detectLead.error.message}</p> : null}
      {pdf.isError ? <p className="text-sm text-red-300">{pdf.error.message}</p> : null}
      {pdf.data?.file_url ? (
        <a href={pdf.data.file_url} className="text-sm text-emerald-400">
          Download conversation PDF
        </a>
      ) : null}
      {detectLead.isSuccess ? (
        <p className="text-sm text-emerald-300">
          {detectLead.data ? "Follow-up created from this conversation." : "No lead met the intent/sentiment rules."}
        </p>
      ) : null}

      {conversation.recording_url ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("conversation.audio")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MobileAudioPlayer src={conversation.recording_url} duration={duration} />
          </CardContent>
        </Card>
      ) : null}

      {analysis ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>{t("conversation.summary")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-300">{summaryText || t("conversation.noSummary")}</p>
              {analysis.summary_original && analysis.summary && analysis.summary_original !== analysis.summary ? (
                <p className="mt-3 border-t border-slate-800 pt-3 text-sm leading-6 text-slate-400">{analysis.summary_original}</p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("conversation.sentiment")}</CardTitle>
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
              <CardTitle>{t("conversation.purchaseIntent")}</CardTitle>
            </CardHeader>
            <CardContent>
              <IntentBadge intent={analysis.purchase_intent} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("conversation.language")}</CardTitle>
            </CardHeader>
            <CardContent className="uppercase">{analysis.language_code ?? analysis.language ?? conversation.language ?? "—"}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("conversation.objections")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(objectionList.length ? objectionList : [t("errors.noneRecorded")]).map((item) => (
                <p key={item} className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-100">
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("conversation.questions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(questionList.length ? questionList : [t("errors.noneRecorded")]).map((item) => (
                <p key={item} className="rounded-lg bg-sky-950/50 px-3 py-2 text-sm text-sky-100">
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("conversation.keyPoints")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(keyPointList.length ? keyPointList : [t("errors.noneRecorded")]).map((item) => (
                <p key={item} className="rounded-lg bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState title={t("errors.noAnalysis")} hint={t("errors.noAnalysisHint")} />
      )}

      {analysis ? <ConversationAiInsights conversationId={conversation.id} analysis={analysis} /> : null}

      {analysis?.overall_score != null ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("conversation.scores")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-semibold">{analysis.overall_score}</p>
              <ScoreBar label="Communication" icon="💬" value={analysis.communication_score} />
              <ScoreBar label="Product knowledge" icon="📦" value={analysis.product_knowledge_score} />
              <ScoreBar label="Objection handling" icon="🛡️" value={analysis.objection_handling_score} />
              <ScoreBar label="Closing ability" icon="🤝" value={analysis.closing_ability_score} />
              <ScoreBar label="Rule compliance" icon="✅" value={analysis.rule_compliance_score} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("conversation.recommendations")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs uppercase text-slate-500">{t("conversation.strengths")}</p>
                <p className="mt-1 text-sm">{(analysis.strengths ?? []).join(" · ") || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">{t("conversation.weaknesses")}</p>
                <p className="mt-1 text-sm">{(analysis.weaknesses ?? []).join(" · ") || "—"}</p>
              </div>
              {(analysis.recommendations ?? []).map((item) => (
                <p key={item} className="rounded-lg bg-slate-950 px-3 py-2 text-sm text-slate-300">
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {conversation.rule_results?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("conversation.rules")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {conversation.rule_results.map((result) => (
              <div key={result.rule_id} className="rounded-lg bg-slate-950 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    {result.is_followed ? "✅" : "❌"} {result.description || result.rule_type}
                  </span>
                  <span className={result.is_followed ? "text-emerald-300" : "text-red-300"}>
                    {result.is_followed ? t("conversation.followed") : t("conversation.missed")}
                  </span>
                </div>
                {result.evidence ? <p className="mt-1 text-xs text-slate-400">“{result.evidence}”</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {insights && (insights.idioms?.length || insights.cultural_notes?.length || insights.local_objections?.length) ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("conversation.insights")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-slate-500">{t("conversation.idioms")}</p>
              <p className="mt-1 text-sm text-slate-300">{insights.idioms?.join(" · ") || "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">{t("conversation.culturalNotes")}</p>
              <p className="mt-1 text-sm text-slate-300">{insights.cultural_notes?.join(" · ") || "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">{t("conversation.localObjections")}</p>
              <p className="mt-1 text-sm text-slate-300">{insights.local_objections?.join(" · ") || "—"}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className="text-left" onClick={() => setTranscriptOpen((value) => !value)}>
            <CardTitle>{t("conversation.transcript")} {transcriptOpen ? "▾" : "▸"}</CardTitle>
          </button>
          <div className="flex flex-wrap gap-2">
            {(["original", "english", "side-by-side"] as const).map((view) => (
              <Button
                key={view}
                size="sm"
                variant={transcriptView === view ? "primary" : "secondary"}
                onClick={() => setTranscriptView(view)}
              >
                {view === "original"
                  ? t("conversation.original")
                  : view === "english"
                    ? t("conversation.translation")
                    : t("conversation.sideBySide")}
              </Button>
            ))}
            <Button
              size="sm"
              variant="secondary"
              disabled={translate.isPending}
              onClick={() => translate.mutate(language === "en" ? "ur" : language)}
            >
              {translate.isPending ? t("common.loading") : `${t("conversation.translateTo")} ${language === "en" ? "Urdu" : language.toUpperCase()}`}
            </Button>
            {language !== "en" ? (
              <Button size="sm" variant="secondary" disabled={translate.isPending} onClick={() => translate.mutate("en")}>
                {`${t("conversation.translateTo")} EN`}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        {transcriptOpen ? <CardContent className="space-y-3">
          {translate.isError ? <p className="text-sm text-red-300">{translate.error.message}</p> : null}
          {transcriptView === "side-by-side" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <pre className="whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-sm text-slate-200">{originalTranscript || t("errors.noTranscript")}</pre>
              <pre className="whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-sm text-slate-200">{englishTranscript || t("errors.noTranscript")}</pre>
            </div>
          ) : transcriptView === "english" ? (
            <p className="whitespace-pre-wrap text-sm text-slate-300">{englishTranscript || t("errors.noTranscript")}</p>
          ) : segments.length && !transcript?.original_text ? (
            segments.map((segment) => (
              <div
                key={segment.id}
                id={`seg-${Math.round(segment.start_time)}`}
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  segment.speaker === "salesman"
                    ? "bg-sky-950/60 text-sky-50"
                    : "ms-auto bg-emerald-950/60 text-emerald-50"
                }`}
              >
                <p className="text-xs uppercase tracking-wide opacity-70">
                  {segment.speaker} · {formatClock(segment.start_time)}
                </p>
                <p className="mt-1">
                  {analysis?.tone_analysis?.filler_words?.length
                    ? segment.text
                        .split(
                          new RegExp(
                            `\\b(${analysis.tone_analysis.filler_words.map(escapeRegExp).join("|")})\\b`,
                            "gi",
                          ),
                        )
                        .map((part, index) =>
                        analysis.tone_analysis?.filler_words.some((word) => word.toLowerCase() === part.toLowerCase()) ? (
                          <mark key={`${segment.id}-${index}`} className="rounded bg-amber-500/30 px-0.5 text-amber-100">
                            {part}
                          </mark>
                        ) : (
                          <span key={`${segment.id}-${index}`}>{part}</span>
                        ),
                      )
                    : segment.text}
                </p>
              </div>
            ))
          ) : (
            <p className="whitespace-pre-wrap text-sm text-slate-300">
              {originalTranscript || t("errors.noTranscript")}
            </p>
          )}
        </CardContent> : null}
      </Card>
    </div>
  );
}
