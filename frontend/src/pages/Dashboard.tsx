import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchAnalytics, fetchConversations, fetchDueFollowUps, fetchFollowUps, fetchNotifications } from "../services/api";
import { formatDateTime, formatDueLabel, formatDuration } from "../lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { IntentBadge, PriorityBadge, StatusBadge } from "../components/conversation/Badges";

const COLORS = ["#34d399", "#f87171", "#94a3b8"];

export default function Dashboard() {
  const analytics = useQuery({ queryKey: ["analytics"], queryFn: () => fetchAnalytics() });
  const recent = useQuery({
    queryKey: ["conversations", { page: 1, pageSize: 5 }],
    queryFn: () => fetchConversations({ page: 1, pageSize: 5 }),
  });
  const due = useQuery({ queryKey: ["followups", "due-today"], queryFn: fetchDueFollowUps });
  const highLeads = useQuery({
    queryKey: ["followups", { priority: "high", status: "pending" }],
    queryFn: () => fetchFollowUps({ priority: "high", status: "pending" }),
  });
  const notices = useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications });

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
  if (!data) return <EmptyState title="No dashboard data" hint="Sign in and record a conversation to populate this page." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Today’s recordings and AI analysis at a glance.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-slate-400">Today’s conversations</p>
            <p className="mt-2 text-3xl font-semibold">{data.todayCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-slate-400">Pending analysis</p>
            <p className="mt-2 text-3xl font-semibold">{data.pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-slate-400">High intent customers</p>
            <p className="mt-2 text-3xl font-semibold">{data.highIntentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-slate-400">Average sentiment</p>
            <p className="mt-2 text-3xl font-semibold">{(data.averageSentimentScore * 100).toFixed(0)}%</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly conversation trend</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {data.perDay.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.perDay.slice(-7)}>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#34d399" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">No conversations this week.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sentiment distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {data.sentiment.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.sentiment} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                    {data.sentiment.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">No sentiment data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Follow-ups due today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {due.data?.length ? (
              due.data.slice(0, 4).map((item) => (
                <Link key={item.id} to="/followups" className="block rounded-lg bg-slate-950 px-3 py-2 text-sm hover:text-emerald-300">
                  {item.customer_name || "Customer"} · {formatDueLabel(item.follow_up_date)}
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-400">Nothing due today.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>High-intent leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {highLeads.data?.length ? (
              highLeads.data.slice(0, 4).map((item) => (
                <Link key={item.id} to="/followups" className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm">
                  <span>{item.customer_name || item.product_interest || "Lead"}</span>
                  <PriorityBadge priority={item.priority} />
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-400">No open high-intent leads.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notices.data?.length ? (
              notices.data.slice(0, 4).map((item) => (
                <p key={item.id} className="rounded-lg bg-slate-950 px-3 py-2 text-sm text-slate-300">
                  {item.title}
                </p>
              ))
            ) : (
              <p className="text-sm text-slate-400">No notifications yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent conversations</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.isError ? (
              <ErrorState message={recent.error.message} onRetry={() => void recent.refetch()} />
            ) : !recent.data?.data.length ? (
              <p className="text-sm text-slate-400">No conversations yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="py-2 font-medium">When</th>
                      <th className="py-2 font-medium">Duration</th>
                      <th className="py-2 font-medium">Status</th>
                      <th className="py-2 font-medium">Intent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.data.data.map((item) => (
                      <tr key={item.id} className="border-t border-slate-800">
                        <td className="py-3">
                          <Link to={`/conversations/${item.id}`} className="hover:text-emerald-300">
                            {formatDateTime(item.recorded_at)}
                          </Link>
                        </td>
                        <td>{formatDuration(item.duration_seconds)}</td>
                        <td>
                          <StatusBadge status={item.status} />
                        </td>
                        <td>
                          <IntentBadge intent={item.analysis?.purchase_intent} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top objections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.objections.length ? (
              data.objections.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm">
                  <span>{item.name}</span>
                  <span className="text-slate-400">{item.value}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No objections yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
