import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useStoreFilter } from "../contexts/StoreContext";
import { fetchActivity } from "../services/api";
import { formatDateTime } from "../lib/format";

export function ActivityFeed({ limit = 12 }: { limit?: number }) {
  const { t } = useLanguage();
  const { selectedStoreId } = useStoreFilter();
  const scroller = useRef<HTMLDivElement>(null);
  const activity = useQuery({
    queryKey: ["activity", selectedStoreId],
    queryFn: () => fetchActivity(selectedStoreId === "all" ? null : selectedStoreId),
  });

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = 0;
  }, [activity.data]);

  const items = (activity.data ?? []).slice(0, limit);

  return (
    <div ref={scroller} className="max-h-80 space-y-2 overflow-y-auto">
      {activity.isError ? (
        <p className="text-sm text-slate-400">{t("errors.loadFailed")}</p>
      ) : !items.length ? (
        <p className="text-sm text-slate-400">{t("stores.noActivity")}</p>
      ) : (
        items.map((item) => {
          const conversationId =
            item.metadata && typeof item.metadata.conversation_id === "string" ? item.metadata.conversation_id : null;
          const body = (
            <div className="rounded-lg bg-slate-950 px-3 py-2 text-sm transition hover:bg-slate-900">
              <p className="text-slate-200">{item.description || item.activity_type}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                {item.activity_type.replaceAll("_", " ")} · {formatDateTime(item.created_at)}
              </p>
            </div>
          );
          return conversationId ? (
            <Link key={item.id} to={`/conversations/${conversationId}`}>
              {body}
            </Link>
          ) : (
            <div key={item.id}>{body}</div>
          );
        })
      )}
    </div>
  );
}
