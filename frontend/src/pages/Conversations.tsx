import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "../contexts/LanguageContext";
import { useStoreFilter } from "../contexts/StoreContext";
import { exportConversationsCsv, fetchConversations, fetchSalesmen } from "../services/api";
import { ExportMenu } from "../components/ExportMenu";
import type { Conversation, ConversationFilters, ConversationStatus, Sentiment } from "../types/conversation";
import { formatDateTime, formatDuration } from "../lib/format";
import { IntentBadge, SentimentBadge, StatusBadge } from "../components/conversation/Badges";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

const PAGE_SIZE = 20;

export default function Conversations() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { selectedStoreId } = useStoreFilter();
  const [cards, setCards] = useState<Conversation[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef(0);
  const [openActions, setOpenActions] = useState<string | null>(null);
  const [filters, setFilters] = useState<ConversationFilters>({
    page: 1,
    pageSize: PAGE_SIZE,
    status: "all",
    sentiment: "all",
    salesmanId: "all",
    search: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) =>
        current.search === searchInput ? current : { ...current, search: searchInput, page: 1 },
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const list = useQuery({
    queryKey: ["conversations", { ...filters, storeId: selectedStoreId }],
    queryFn: () => fetchConversations({ ...filters, storeId: selectedStoreId }),
  });
  const salesmen = useQuery({ queryKey: ["salesmen"], queryFn: fetchSalesmen });
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));
  const statusChips = useMemo(() => ["all", "scored", "analyzed", "queued", "recorded", "failed"] as const, []);

  useEffect(() => {
    if (!list.data) return;
    setCards((current) => ((filters.page ?? 1) <= 1 ? list.data.data : [...current, ...list.data.data]));
  }, [list.data, filters.page]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !list.isFetching && (filters.page ?? 1) < totalPages) {
        setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [list.isFetching, filters.page, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("pages.conversations")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("pages.conversationsHint")}</p>
        </div>
        <ExportMenu onExport={exportConversationsCsv} />
      </div>

      <div className="flex gap-2 overflow-x-auto md:hidden">
        {statusChips.map((value) => (
          <button
            key={value}
            type="button"
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm ${
              filters.status === value ? "bg-emerald-500 text-slate-950" : "bg-slate-900 text-slate-300"
            }`}
            onClick={() => setFilters((current) => ({ ...current, status: value as ConversationStatus | "all", page: 1 }))}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-6">
        <Input
          placeholder="Search transcript or conversation ID"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="xl:col-span-2"
        />
        <Input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => setFilters((current) => ({ ...current, from: e.target.value || undefined, page: 1 }))}
        />
        <Input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => setFilters((current) => ({ ...current, to: e.target.value || undefined, page: 1 }))}
        />
        <Select
          value={filters.status}
          onChange={(e) =>
            setFilters((current) => ({ ...current, status: e.target.value as ConversationStatus | "all", page: 1 }))
          }
        >
          <option value="all">All statuses</option>
          <option value="scored">Scored</option>
          <option value="analyzed">Analyzed</option>
          <option value="queued">Queued</option>
          <option value="processing">Processing</option>
          <option value="recorded">Recorded</option>
          <option value="failed">Failed</option>
        </Select>
        <Select
          value={filters.sentiment}
          onChange={(e) =>
            setFilters((current) => ({ ...current, sentiment: e.target.value as Sentiment | "all", page: 1 }))
          }
        >
          <option value="all">All sentiment</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </Select>
      </div>
      <Select
        value={filters.salesmanId}
        onChange={(e) => setFilters((current) => ({ ...current, salesmanId: e.target.value, page: 1 }))}
        className="max-w-xs"
      >
        <option value="all">All salesmen</option>
        {(salesmen.data ?? []).map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </Select>

      {list.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />
      ) : !list.data?.data.length ? (
        <EmptyState title="No conversations yet" hint="Record a conversation from the desktop app, then it will show up here." />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {cards.map((item) => (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
                onTouchStart={(e) => {
                  swipeStart.current = e.changedTouches[0]?.clientX ?? 0;
                }}
                onTouchEnd={(e) => {
                  const delta = (e.changedTouches[0]?.clientX ?? 0) - swipeStart.current;
                  if (delta > 70) navigate(`/conversations/${item.id}`);
                  if (delta < -70) setOpenActions(item.id);
                }}
              >
                <Link to={`/conversations/${item.id}`} className="block min-h-20 px-4 py-3">
                  <p className="font-medium">{formatDateTime(item.recorded_at)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.salesman_name ?? item.id.slice(0, 8)} · {formatDuration(item.duration_seconds)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge status={item.status} />
                    <SentimentBadge sentiment={item.analysis?.sentiment} />
                    <IntentBadge intent={item.analysis?.purchase_intent} />
                  </div>
                </Link>
                {openActions === item.id ? (
                  <div className="flex gap-2 border-t border-slate-800 px-4 py-2">
                    <Button size="sm" onClick={() => navigate(`/conversations/${item.id}`)}>
                      Details
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => navigate("/followups")}>
                      Follow-ups
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={sentinelRef} className="h-8" />
            {list.isFetching ? <Skeleton className="h-14" /> : null}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-800 md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Recorded</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Language</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Sentiment</th>
                  <th className="px-4 py-3 font-medium">Intent</th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((item) => (
                  <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-900/70">
                    <td className="px-4 py-3">
                      <Link to={`/conversations/${item.id}`} className="font-medium text-slate-100 hover:text-emerald-300">
                        {formatDateTime(item.recorded_at)}
                      </Link>
                      <p className="text-xs text-slate-500">{item.salesman_name ?? item.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3">{formatDuration(item.duration_seconds)}</td>
                    <td className="px-4 py-3 uppercase">{item.language ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <SentimentBadge sentiment={item.analysis?.sentiment} />
                    </td>
                    <td className="px-4 py-3">
                      <IntentBadge intent={item.analysis?.purchase_intent} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="hidden items-center justify-between text-sm text-slate-400 md:flex">
            <p>
              Page {filters.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) - 1 }))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={(filters.page ?? 1) >= totalPages}
                onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
