import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "../contexts/LanguageContext";
import { useStoreFilter } from "../contexts/StoreContext";
import { fetchDevices, restartDevice, syncDevice } from "../services/api";
import { formatDateTime } from "../lib/format";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

function formatBytes(value: number): string {
  if (!value) return "0 B";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Devices() {
  const { t } = useLanguage();
  const { selectedStoreId, stores } = useStoreFilter();
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["devices", selectedStoreId],
    queryFn: () => fetchDevices(selectedStoreId === "all" ? null : selectedStoreId),
  });
  const sync = useMutation({
    mutationFn: syncDevice,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
  const restart = useMutation({
    mutationFn: restartDevice,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });

  if (list.isLoading) return <Skeleton className="h-40" />;
  if (list.isError) return <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />;

  const devices = list.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pages.devices")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("pages.devicesHint")}</p>
      </div>
      {!devices.length ? (
        <EmptyState title={t("stores.noDevices")} hint={t("stores.noDevicesHint")} />
      ) : (
        <div className="space-y-3">
          {devices.map((device) => (
            <Card key={device.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">{device.device_name || device.device_id}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {stores.find((store) => store.id === device.store_id)?.name ?? t("stores.allStores")} · v
                    {device.app_version || "—"} · {formatBytes(device.storage_used_bytes)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("stores.lastSync")}: {device.last_sync_at ? formatDateTime(device.last_sync_at) : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${device.is_online ? "bg-emerald-400" : "bg-red-500"}`} />
                  <span className="text-sm">{device.is_online ? t("stores.online") : t("stores.offline")}</span>
                  <Button size="sm" variant="secondary" disabled={sync.isPending} onClick={() => sync.mutate(device.id)}>
                    {t("common.syncNow")}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={restart.isPending} onClick={() => restart.mutate(device.id)}>
                    {t("stores.restart")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
