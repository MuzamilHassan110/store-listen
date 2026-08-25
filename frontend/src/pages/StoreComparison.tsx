import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLanguage } from "../contexts/LanguageContext";
import { compareStores, fetchStores } from "../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

export default function StoreComparison() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string[]>([]);
  const stores = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const comparison = useQuery({
    queryKey: ["store-compare", selected],
    queryFn: () => compareStores(selected),
    enabled: selected.length >= 2,
  });

  const chart = useMemo(
    () =>
      (comparison.data ?? []).map((row) => ({
        name: row.name,
        conversations: row.total_conversations,
        score: row.average_score,
        intent: row.high_intent,
      })),
    [comparison.data],
  );

  function toggle(id: string): void {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function exportCsv(): void {
    const rows = comparison.data ?? [];
    const header = "Store,City,Conversations,Score,Duration,High intent,Online devices";
    const body = rows
      .map((row) =>
        [row.name, row.city ?? "", row.total_conversations, row.average_score, row.average_duration, row.high_intent, row.online_devices].join(","),
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "store-comparison.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (stores.isLoading) return <Skeleton className="h-40" />;
  if (stores.isError) return <ErrorState message={stores.error.message} onRetry={() => void stores.refetch()} />;

  const options = stores.data?.stores ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/stores" className="text-sm text-emerald-400">
          {t("pages.stores")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("pages.storeCompare")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("pages.storeCompareHint")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((store) => (
          <Button key={store.id} size="sm" variant={selected.includes(store.id) ? "primary" : "secondary"} onClick={() => toggle(store.id)}>
            {store.name}
          </Button>
        ))}
      </div>

      {selected.length < 2 ? (
        <EmptyState title={t("stores.pickTwo")} hint={t("stores.pickTwoHint")} />
      ) : comparison.isLoading ? (
        <Skeleton className="h-64" />
      ) : comparison.isError ? (
        <ErrorState message={comparison.error.message} onRetry={() => void comparison.refetch()} />
      ) : (
        <>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={exportCsv}>
              {t("common.download")}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-2">{t("stores.storeName")}</th>
                  <th>{t("stores.conversations")}</th>
                  <th>{t("stores.score")}</th>
                  <th>{t("stores.highIntent")}</th>
                  <th>{t("stores.devices")}</th>
                </tr>
              </thead>
              <tbody>
                {(comparison.data ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="py-3">{row.name}</td>
                    <td>{row.total_conversations}</td>
                    <td>{row.average_score}</td>
                    <td>{row.high_intent}</td>
                    <td>{row.online_devices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("stores.comparisonChart")}</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="conversations" fill="#34d399" />
                  <Bar dataKey="score" fill="#38bdf8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
