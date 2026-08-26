import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchInsightOverview } from "../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

const EMOTION_COLORS: Record<string, string> = {
  happy: "#34d399",
  excited: "#c084fc",
  frustrated: "#f87171",
  confused: "#fbbf24",
  anxious: "#fb923c",
  neutral: "#94a3b8",
};

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

export default function AdvancedAnalytics() {
  const { t } = useLanguage();
  const overview = useQuery({ queryKey: ["insights-overview"], queryFn: fetchInsightOverview });

  if (overview.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (overview.isError) {
    return <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} />;
  }
  const data = overview.data;
  if (!data || data.conversations_scanned === 0) {
    return (
      <EmptyState
        title="No advanced insights yet"
        hint="Analyze conversations to populate emotion, tone, coaching, and churn charts."
      />
    );
  }

  const coaching = data.coaching ?? { total: 0, implemented: 0, high_priority: 0, effectiveness_rate: 0 };
  const products = data.products ?? { catalog: 0 };
  const scripts = data.scripts ?? { saved: 0 };
  const tone = [
    { name: "Confidence", value: data.average_tone.confidence },
    { name: "Professional", value: data.average_tone.professionalism },
    { name: "Enthusiasm", value: data.average_tone.enthusiasm },
    { name: "Empathy", value: data.average_tone.empathy },
    { name: "Assertive", value: data.average_tone.assertiveness },
  ];
  const churn = [
    { name: "High", value: data.churn.high, fill: "#f87171" },
    { name: "Medium", value: data.churn.medium, fill: "#fbbf24" },
    { name: "Low", value: data.churn.low, fill: "#34d399" },
    { name: "Unknown", value: data.churn.unknown, fill: "#64748b" },
  ];
  const coachingBars = [
    { name: "Tips", value: coaching.total },
    { name: "High priority", value: coaching.high_priority },
    { name: "Marked done", value: coaching.implemented },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pages.advancedAnalytics")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("pages.advancedAnalyticsHint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Conversations scanned" value={String(data.conversations_scanned)} />
        <Stat label="Coaching effectiveness" value={`${coaching.effectiveness_rate}%`} />
        <Stat label="Catalog products" value={String(products.catalog)} />
        <Stat label="Saved scripts" value={String(scripts.saved)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Emotion distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.emotion} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label>
                  {data.emotion.map((item) => (
                    <Cell key={item.name} fill={EMOTION_COLORS[item.name] ?? "#60a5fa"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tone analysis trends</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={tone}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#34d399" fill="#34d399" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Coaching tip volume</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coachingBars}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#60a5fa" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Churn risk overview</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={churn}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={6}>
                  {churn.map((item) => (
                    <Cell key={item.name} fill={item.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Product recommendation coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{products.catalog}</p>
            <p className="mt-2 text-sm text-slate-400">
              Catalog size used for match scoring. Accuracy is lexicon-based (brand, budget, features in the
              transcript) until purchase outcomes are labeled.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sales script performance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{scripts.saved}</p>
            <p className="mt-2 text-sm text-slate-400">
              Saved personalized scripts. Generate more from customer history, then copy them into WhatsApp or in-store
              coaching.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
