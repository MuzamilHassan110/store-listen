import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { generateReport } from "../services/api";
import { formatDateTime, formatDuration } from "../lib/format";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { SentimentBadge } from "../components/conversation/Badges";

function presetRange(kind: "daily" | "weekly" | "monthly") {
  const to = new Date();
  const from = kind === "daily" ? to : kind === "weekly" ? subDays(to, 7) : subDays(to, 30);
  return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") };
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [preset, setPreset] = useState<"daily" | "weekly" | "monthly">("weekly");
  const range = useMemo(() => presetRange(preset), [preset]);
  const report = useQuery({
    queryKey: ["report", range],
    queryFn: () => generateReport(range),
  });

  function exportPdf(): void {
    if (!report.data) return;
    const doc = new jsPDF();
    doc.text("StoreListen report", 14, 16);
    doc.text(`${report.data.range.from} to ${report.data.range.to}`, 14, 24);
    autoTable(doc, {
      startY: 32,
      head: [["Metric", "Value"]],
      body: [
        ["Conversations", String(report.data.analytics.totalConversations)],
        ["Analyzed", `${Math.round(report.data.analytics.analyzedPercentage)}%`],
        ["High intent", String(report.data.analytics.highIntentCount)],
        ["Avg duration", formatDuration(report.data.analytics.averageDuration)],
      ],
    });
    autoTable(doc, {
      startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80 + 10,
      head: [["Objection", "Count"]],
      body: report.data.analytics.objections.map((item) => [item.name, String(item.value)]),
    });
    doc.save(`storelisten-report-${range.from}.pdf`);
  }

  function exportCsv(): void {
    if (!report.data) return;
    downloadCsv(`storelisten-report-${range.from}.csv`, [
      ["id", "recorded_at", "duration", "status", "sentiment", "intent"],
      ...report.data.conversations.map((item) => [
        item.id,
        item.recorded_at,
        String(item.duration_seconds),
        item.status,
        item.analysis?.sentiment ?? "",
        item.analysis?.purchase_intent ?? "",
      ]),
    ]);
  }

  return (
    <div className="space-y-6 print:bg-white print:text-black">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-slate-400">Generate a dated snapshot of conversations and AI findings.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={preset} onChange={(e) => setPreset(e.target.value as typeof preset)} className="w-40">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
          <Button variant="secondary" onClick={() => void report.refetch()}>
            Generate report
          </Button>
          <Button variant="secondary" onClick={exportPdf} disabled={!report.data}>
            PDF
          </Button>
          <Button variant="secondary" onClick={exportCsv} disabled={!report.data}>
            CSV
          </Button>
          <Button variant="ghost" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {report.isLoading ? (
        <Skeleton className="h-64" />
      ) : report.isError ? (
        <ErrorState message={report.error.message} onRetry={() => void report.refetch()} />
      ) : !report.data || report.data.analytics.totalConversations === 0 ? (
        <EmptyState title="No report data" hint="Pick a range that contains recordings, then generate again." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent>
                <p className="text-xs uppercase text-slate-400">Conversations</p>
                <p className="mt-2 text-2xl font-semibold">{report.data.analytics.totalConversations}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs uppercase text-slate-400">Analyzed</p>
                <p className="mt-2 text-2xl font-semibold">{Math.round(report.data.analytics.analyzedPercentage)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs uppercase text-slate-400">High intent</p>
                <p className="mt-2 text-2xl font-semibold">{report.data.analytics.highIntentCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs uppercase text-slate-400">Avg duration</p>
                <p className="mt-2 text-2xl font-semibold">{formatDuration(report.data.analytics.averageDuration)}</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top objections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.data.analytics.objections.length ? (
                  report.data.analytics.objections.map((item) => (
                    <p key={item.name} className="flex justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="text-slate-400">{item.value}</span>
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">None in this range.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Sentiment trend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.data.analytics.sentiment.map((item) => (
                  <p key={item.name} className="flex justify-between text-sm capitalize">
                    <span>{item.name}</span>
                    <span>{item.value}</span>
                  </p>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Purchase intent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.data.analytics.intent.map((item) => (
                  <p key={item.name} className="flex justify-between text-sm capitalize">
                    <span>{item.name}</span>
                    <span>{item.value}</span>
                  </p>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Conversations in range</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.data.conversations.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{formatDateTime(item.recorded_at)}</span>
                    <SentimentBadge sentiment={item.analysis?.sentiment} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
