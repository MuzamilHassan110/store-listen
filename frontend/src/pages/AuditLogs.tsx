import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { exportAuditLogs, fetchAuditLogs } from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

function iconFor(action: string): string {
  if (action.includes("2fa") || action.includes("auth")) return "🔐";
  if (action.includes("export")) return "📤";
  if (action.includes("backup")) return "💾";
  if (action.includes("settings")) return "⚙️";
  if (action.includes("customer")) return "👤";
  return "📝";
}

export default function AuditLogs() {
  const { t } = useLanguage();
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = useQuery({
    queryKey: ["audit-logs", action, search, from, to],
    queryFn: () => fetchAuditLogs({ action, search, from, to }),
  });

  async function onExport(): Promise<void> {
    const file = await exportAuditLogs();
    const blob = new Blob([file.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("pages.audit")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("pages.auditHint")}</p>
        </div>
        <Button variant="secondary" onClick={() => void onExport()}>
          Export CSV
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Input placeholder="Action" value={action} onChange={(e) => setAction(e.target.value)} />
        <Input placeholder="Search entity" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {list.isLoading ? (
        <Skeleton className="h-64" />
      ) : list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState title="No audit events" hint="Writes, exports, and security changes will appear here." />
      ) : (
        <div className="space-y-3">
          {list.data.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-900 text-lg">{iconFor(item.action)}</span>
                <div>
                  <p className="font-medium">{item.action}</p>
                  <p className="text-xs text-slate-500">
                    {item.created_at.replace("T", " ").slice(0, 19)} · {item.entity_type || "system"} · {item.ip_address || "no IP"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
