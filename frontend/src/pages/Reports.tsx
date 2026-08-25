import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  fetchSalesmen,
  fetchStoredReports,
  generateConversationPdf,
  generateSalesmanPdf,
  generateStorePdf,
} from "../services/api";
import { formatDateTime } from "../lib/format";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

function presetRange(kind: "today" | "week" | "month" | "custom", customFrom: string, customTo: string) {
  const to = new Date();
  if (kind === "today") return { from: format(to, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") };
  if (kind === "week") return { from: format(subDays(to, 7), "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") };
  if (kind === "month") return { from: format(subDays(to, 30), "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") };
  return { from: customFrom, to: customTo };
}

export default function Reports() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"conversation" | "salesman" | "store">("store");
  const [preset, setPreset] = useState<"today" | "week" | "month" | "custom">("week");
  const [customFrom, setCustomFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [conversationId, setConversationId] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [ready, setReady] = useState<string>("");

  const range = useMemo(() => presetRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const reports = useQuery({ queryKey: ["stored-reports"], queryFn: fetchStoredReports });
  const salesmen = useQuery({ queryKey: ["salesmen"], queryFn: fetchSalesmen });

  const generate = useMutation({
    mutationFn: async () => {
      if (kind === "conversation") {
        if (!conversationId) throw new Error("Enter a conversation ID.");
        return generateConversationPdf(conversationId.trim());
      }
      if (kind === "salesman") {
        if (!salesmanId) throw new Error("Select a salesman.");
        return generateSalesmanPdf(salesmanId, range.from, range.to);
      }
      return generateStorePdf(range.from, range.to);
    },
    onSuccess: (report) => {
      setReady(report.file_url ?? "");
      void queryClient.invalidateQueries({ queryKey: ["stored-reports"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-slate-400">Generate manager PDFs and download previously created files.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate a PDF</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="store">Store</option>
              <option value="salesman">Salesman</option>
              <option value="conversation">Conversation</option>
            </Select>
            <Select value={preset} onChange={(e) => setPreset(e.target.value as typeof preset)}>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="custom">Custom</option>
            </Select>
            {kind === "salesman" ? (
              <Select value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)}>
                <option value="">Select salesman</option>
                {(salesmen.data ?? []).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </Select>
            ) : null}
            {kind === "conversation" ? (
              <Input placeholder="Conversation UUID" value={conversationId} onChange={(e) => setConversationId(e.target.value)} />
            ) : null}
          </div>
          {preset === "custom" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          ) : null}
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? "Generating…" : "Generate report"}
          </Button>
          {generate.isError ? <p className="text-sm text-red-300">{generate.error.message}</p> : null}
          {ready ? (
            <div className="flex flex-wrap gap-2">
              <a href={ready} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-lg bg-emerald-500 px-4 text-sm font-medium text-slate-950">
                Download
              </a>
              <Button variant="secondary" onClick={() => setPreview(ready)}>
                Preview
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {reports.isLoading ? (
        <Skeleton className="h-48" />
      ) : reports.isError ? (
        <ErrorState message={reports.error.message} onRetry={() => void reports.refetch()} />
      ) : !reports.data?.length ? (
        <EmptyState title="No generated reports" hint="Create a store, salesman, or conversation PDF to see it here." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {reports.data.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium capitalize">{item.report_type} report</p>
                  <p className="text-xs text-slate-500">{formatDateTime(item.generated_at)}</p>
                  <p className="text-xs text-slate-500">{item.file_name}</p>
                </div>
                <div className="flex gap-2">
                  {item.file_url ? (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => setPreview(item.file_url)}>
                        Preview
                      </Button>
                      <a href={item.file_url} className="inline-flex h-9 items-center rounded-lg border border-slate-700 px-3 text-sm">
                        Download
                      </a>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {preview ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/80 p-4">
          <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-medium">PDF preview</p>
              <div className="flex gap-2">
                <a href={preview} className="text-sm text-emerald-400">
                  Download
                </a>
                <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
                  Close
                </Button>
              </div>
            </div>
            <iframe title="Report preview" src={preview} className="min-h-0 flex-1 rounded-b-xl bg-white" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
