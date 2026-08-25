import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchStoreOverview } from "../services/api";
import { formatDateTime, formatDuration } from "../lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { StatusBadge } from "../components/conversation/Badges";

export default function StoreDetail() {
  const { id = "" } = useParams();
  const { t } = useLanguage();
  const detail = useQuery({
    queryKey: ["store", id],
    queryFn: () => fetchStoreOverview(id),
    enabled: Boolean(id),
  });

  if (detail.isLoading) return <Skeleton className="h-64" />;
  if (detail.isError) return <ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} />;
  if (!detail.data) return <EmptyState title={t("stores.empty")} hint={t("stores.emptyHint")} />;

  const { store, performance, active_salesmen, devices, recent_conversations, today_conversations } = detail.data;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/stores" className="inline-flex items-center gap-1 text-sm text-emerald-400">
          <ArrowLeft className="h-4 w-4 rtl-flip" />
          {t("pages.stores")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{store.name}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {[store.city, store.address, store.phone].filter(Boolean).join(" · ") || t("stores.noCity")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("stores.today")} value={today_conversations} />
        <Stat label={t("stores.conversations")} value={performance.total_conversations} />
        <Stat label={t("stores.score")} value={performance.average_score} />
        <Stat label={t("stores.recordingTime")} value={formatDuration(performance.total_recording_time)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("stores.salesmen")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {active_salesmen.length ? (
              active_salesmen.map((person) => (
                <Link key={person.id} to={`/salesmen/${person.id}`} className="block rounded-lg bg-slate-950 px-3 py-2 text-sm hover:text-emerald-300">
                  {person.name || t("conversation.salesman")}
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-400">{t("stores.noSalesmen")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("pages.devices")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {devices.length ? (
              devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm">
                  <span>{device.device_name || device.device_id}</span>
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${device.is_online ? "bg-emerald-400" : "bg-red-500"}`} />
                    {device.is_online ? t("stores.online") : t("stores.offline")}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">{t("stores.noDevices")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("stores.recent")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent_conversations.length ? (
            recent_conversations.map((row) => {
              const conversationId = String(row.id ?? "");
              return (
                <Link key={conversationId} to={`/conversations/${conversationId}`} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm hover:text-emerald-300">
                  <span>{formatDateTime(String(row.recorded_at ?? ""))}</span>
                  <StatusBadge status={String(row.status ?? "recorded") as never} />
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-slate-400">{t("stores.noConversations")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-2 text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
