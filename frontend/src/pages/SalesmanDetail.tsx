import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchSalesmanPerformance } from "../services/api";
import { formatDateTime, formatDuration } from "../lib/format";
import type { ConversationStatus } from "../types/conversation";
import { ScoreBar } from "../components/conversation/ScoreBar";
import { StatusBadge } from "../components/conversation/Badges";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

export default function SalesmanDetail() {
  const { id = "" } = useParams();
  const performance = useQuery({
    queryKey: ["salesman", id],
    queryFn: () => fetchSalesmanPerformance(id),
    enabled: Boolean(id),
  });

  if (performance.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (performance.isError) {
    return <ErrorState message={performance.error.message} onRetry={() => void performance.refetch()} />;
  }
  const data = performance.data;
  if (!data) return <EmptyState title="Salesman not found" hint="This person may be outside your organization." />;

  const trend = data.trends.last_7_days.map((value, index) => ({ day: `D${index + 1}`, value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-800 text-xl font-semibold text-emerald-300">
          {data.salesman_name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="text-sm text-slate-400">Salesman</p>
          <h1 className="text-2xl font-semibold">{data.salesman_name}</h1>
          <p className="mt-1 text-sm text-slate-400">{data.total_conversations} conversations</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overall score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-4xl font-semibold">{data.average_scores.overall || "—"}</p>
            <ScoreBar label="Communication" icon="💬" value={data.average_scores.communication} />
            <ScoreBar label="Product knowledge" icon="📦" value={data.average_scores.product_knowledge} />
            <ScoreBar label="Objection handling" icon="🛡️" value={data.average_scores.objection_handling} />
            <ScoreBar label="Closing ability" icon="🤝" value={data.average_scores.closing_ability} />
            <ScoreBar label="Rule compliance" icon="✅" value={data.average_scores.rule_compliance} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>7-day trend</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {trend.some((item) => item.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">No scored conversations in the last week.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.top_strengths.length ? (
              data.top_strengths.map((item) => (
                <p key={item} className="rounded-lg bg-emerald-950/50 px-3 py-2 text-sm">
                  {item}
                </p>
              ))
            ) : (
              <p className="text-sm text-slate-400">Scores will appear after conversations are analyzed.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Weaknesses & recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.top_weaknesses.length ? (
              data.top_weaknesses.map((item) => (
                <p key={item} className="rounded-lg bg-amber-950/40 px-3 py-2 text-sm">
                  Focus on {item.toLowerCase()}.
                </p>
              ))
            ) : (
              <p className="text-sm text-slate-400">No recurring weaknesses yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent conversations</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent_conversations.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-2 font-medium">When</th>
                    <th className="py-2 font-medium">Duration</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_conversations.map((item) => (
                    <tr key={item.id} className="border-t border-slate-800">
                      <td className="py-3">
                        <Link to={`/conversations/${item.id}`} className="hover:text-emerald-300">
                          {formatDateTime(item.recorded_at)}
                        </Link>
                      </td>
                      <td>{formatDuration(item.duration_seconds)}</td>
                      <td>
                        <StatusBadge
                          status={
                            (
                              ["recorded", "queued", "processing", "analyzed", "scored", "failed"] as ConversationStatus[]
                            ).includes(item.status as ConversationStatus)
                              ? (item.status as ConversationStatus)
                              : "recorded"
                          }
                        />
                      </td>
                      <td>{item.overall_score ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No conversations yet" hint="Recordings assigned to this salesman will show here." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
