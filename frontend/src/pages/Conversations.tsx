import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { exportConversationsCsv, fetchConversations, fetchSalesmen } from "../services/api";
import { ExportMenu } from "../components/ExportMenu";
import type { ConversationFilters, ConversationStatus, Sentiment } from "../types/conversation";
import { formatDateTime, formatDuration } from "../lib/format";
import { IntentBadge, SentimentBadge, StatusBadge } from "../components/conversation/Badges";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

const PAGE_SIZE = 20;

export default function Conversations() {
  const [searchInput, setSearchInput] = useState("");
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
    queryKey: ["conversations", filters],
    queryFn: () => fetchConversations(filters),
  });
  const salesmen = useQuery({ queryKey: ["salesmen"], queryFn: fetchSalesmen });

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Conversations</h1>
          <p className="mt-1 text-sm text-slate-400">Search, filter, and open a recording for AI analysis.</p>
        </div>
        <ExportMenu onExport={exportConversationsCsv} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
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
          <div className="overflow-x-auto rounded-xl border border-slate-800">
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
          <div className="flex items-center justify-between text-sm text-slate-400">
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
