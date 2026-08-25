import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Store as StoreIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useStoreFilter } from "../contexts/StoreContext";
import { createStore, fetchStores } from "../services/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

export default function Stores() {
  const { t } = useLanguage();
  const { profile, refresh } = useStoreFilter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const list = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const create = useMutation({
    mutationFn: () => createStore({ name, city }),
    onSuccess: async () => {
      setName("");
      setCity("");
      await queryClient.invalidateQueries({ queryKey: ["stores"] });
      await refresh();
    },
  });

  if (list.isLoading) return <Skeleton className="h-40" />;
  if (list.isError) return <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />;

  const stores = list.data?.stores ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("pages.stores")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("pages.storesHint")}</p>
        </div>
        <Link to="/stores/compare" className="text-sm text-emerald-400">
          {t("stores.compare")}
        </Link>
      </div>

      {profile?.permissions.manageStores ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <Input className="max-w-xs" placeholder={t("stores.storeName")} value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="max-w-xs" placeholder={t("stores.city")} value={city} onChange={(e) => setCity(e.target.value)} />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? t("common.loading") : t("stores.addStore")}
          </Button>
        </form>
      ) : null}

      {!stores.length ? (
        <EmptyState title={t("stores.empty")} hint={t("stores.emptyHint")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => (
            <Link key={store.id} to={`/stores/${store.id}`}>
              <Card className="h-full transition hover:border-emerald-700">
                <CardHeader className="flex flex-row items-center gap-3">
                  <StoreIcon className="h-5 w-5 text-emerald-400" />
                  <div>
                    <CardTitle>{store.name}</CardTitle>
                    <p className="text-xs text-slate-400">{store.city || t("stores.noCity")}</p>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label={t("stores.today")} value={store.stats?.today_conversations ?? 0} />
                  <Stat label={t("stores.score")} value={store.stats?.average_score ?? 0} />
                  <Stat label={t("stores.salesmen")} value={store.stats?.active_salesmen ?? 0} />
                  <Stat label={t("stores.devices")} value={store.stats?.online_devices ?? 0} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-950 px-3 py-2">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
