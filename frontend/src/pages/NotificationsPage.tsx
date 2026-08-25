import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "../services/api";
import { notificationDestination } from "../components/Notifications";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { useLanguage } from "../contexts/LanguageContext";

function dateLabel(value: string): string {
  return value.slice(0, 10);
}

export default function NotificationsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications });
  const markOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof list.data>>();
    for (const item of list.data ?? []) {
      const key = dateLabel(item.created_at);
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }
    return [...map.entries()];
  }, [list.data]);

  if (list.isLoading) return <Skeleton className="h-64" />;
  if (list.isError) return <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("pages.notifications")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("pages.notificationsHint")}</p>
        </div>
        <Button variant="secondary" onClick={() => markAll.mutate()}>
          Mark all read
        </Button>
      </div>
      {!groups.length ? (
        <EmptyState title="No notifications yet" hint="High-intent leads and reports will show up here." />
      ) : (
        groups.map(([day, items]) => (
          <section key={day} className="space-y-2">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">{day}</h2>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`min-h-14 w-full rounded-xl px-4 py-3 text-left ${item.is_read ? "bg-slate-900/50 text-slate-400" : "bg-slate-900 text-slate-100"}`}
                onClick={() => {
                  if (!item.is_read) markOne.mutate(item.id);
                  navigate(notificationDestination(item.metadata, item.type));
                }}
              >
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-slate-400">{item.message}</p>
              </button>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
