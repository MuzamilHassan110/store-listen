import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchAnalytics } from "../services/api";
import { formatDuration, formatHours } from "../lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { SentimentBadge, StatusBadge } from "../components/conversation/Badges";

const COLORS = ["#34d399", "#f87171", "#94a3b8", "#60a5fa", "#fbbf24", "#c084fc"];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const { t } = useLanguage();
  const analytics = useQuery({ queryKey: ["analytics"], queryFn: () => fetchAnalytics() });

  if (analytics.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (analytics.isError) return <ErrorState message={analytics.error.message} onRetry={() => void analytics.refetch()} />;
  const data = analytics.data;
  if (!data || data.totalConversations === 0) {
    return <EmptyState title="No analytics yet" hint="Once conversations are analyzed, charts will appear here." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pages.analytics")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("pages.analyticsHint")}</p>
        <Link to="/analytics/advanced" className="mt-2 inline-block text-sm text-emerald-400 hover:underline">
          {t("pages.advancedAnalytics")} →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total conversations" value={String(data.totalConversations)} />
        <Stat label="Average duration" value={formatDuration(data.averageDuration)} />
        <Stat label="Total recording time" value={formatHours(data.totalRecordingTime)} />
        <Stat label="Analyzed" value={`${Math.round(data.analyzedPercentage)}%`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversations per day</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.perDay}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#34d399" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sentiment</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.sentiment} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {data.sentiment.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Purchase intent</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.intent}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top objections</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {data.objections.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.objections} layout="vertical">
                  <CartesianGrid stroke="#1e293b" />
                  <XAxis type="number" allowDecimals={false} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="name" width={120} stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f87171" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">No objections recorded.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Languages</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.languages} dataKey="value" nameKey="name" outerRadius={80}>
                  {data.languages.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
          <Card>
          <CardHeader>
            <CardTitle>Objection trend</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.objectionTrend}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#f87171" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Product interest</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {data.products.length ? (
              data.products.map((item) => (
                <div key={item.name} className="rounded-lg bg-slate-950 px-3 py-2 text-sm">
                  <p className="truncate">{item.name}</p>
                  <p className="text-slate-400">{item.value}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No product keywords yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Salesman scores</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {data.salesmanTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.salesmanTrend}>
                  <CartesianGrid stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#34d399" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">Scores appear after conversations are scored.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Peak hours</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.peakHours}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conversion funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.funnel.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-slate-400">{item.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${data.totalConversations ? (item.value / data.totalConversations) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent.map((item) => (
              <Link key={item.id} to={`/conversations/${item.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950 px-3 py-2">
                <span className="truncate text-sm">{item.id.slice(0, 8)}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} />
                  <SentimentBadge sentiment={item.analysis?.sentiment} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
