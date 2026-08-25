import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { exportSalesmenCsv, fetchLeaderboard } from "../services/api";
import { ExportMenu } from "../components/ExportMenu";
import { scoreTone } from "../components/conversation/ScoreBar";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { cn } from "../lib/cn";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const [period, setPeriod] = useState<"week" | "month" | "all">("all");
  const board = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => fetchLeaderboard(period),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Leaderboard</h1>
          <p className="mt-1 text-sm text-slate-400">Salesmen ranked by average conversation score.</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu onExport={exportSalesmenCsv} />
        <Select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="w-40">
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="all">All time</option>
        </Select>
        </div>
      </div>

      {board.isLoading ? (
        <Skeleton className="h-64" />
      ) : board.isError ? (
        <ErrorState message={board.error.message} onRetry={() => void board.refetch()} />
      ) : !board.data?.length ? (
        <EmptyState title="No salesmen yet" hint="Add salesmen in Supabase, then assign them on desktop recordings." />
      ) : (
        <div className="space-y-3">
          {board.data[0] ? (
            <Card className="border-emerald-800/70 bg-emerald-950/20">
              <CardHeader>
                <CardTitle>Top performer</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">🥇 {board.data[0].salesman_name}</p>
                  <p className="text-sm text-slate-400">{board.data[0].total_conversations} conversations</p>
                </div>
                <p className="text-3xl font-semibold">{board.data[0].average_score || "—"}</p>
              </CardContent>
            </Card>
          ) : null}
          {board.data.map((entry) => (
            <Link
              key={entry.salesman_id}
              to={`/salesmen/${entry.salesman_id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 hover:border-emerald-800"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 text-center text-lg">{MEDALS[entry.rank - 1] ?? entry.rank}</span>
                <div>
                  <p className="font-medium">{entry.salesman_name}</p>
                  <p className="text-xs text-slate-400">{entry.total_conversations} conversations</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={cn("h-full rounded-full", scoreTone(entry.average_score))}
                    style={{ width: `${entry.average_score}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm">{entry.average_score || "—"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
