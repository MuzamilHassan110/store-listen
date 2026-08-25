import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import {
  cancelFollowUp,
  completeFollowUp,
  createFollowUp,
  fetchConversations,
  fetchFollowUps,
  fetchSalesmen,
  snoozeFollowUp,
  suggestFollowUpMessage,
  exportFollowUpsCsv,
  previewFollowUpMessage,
  sendFollowUpWhatsApp,
} from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";
import { ExportMenu } from "../components/ExportMenu";
import type { FollowUpPriority, FollowUpStatus } from "../types/conversation";
import { formatDueLabel } from "../lib/format";
import { FollowUpStatusBadge, PriorityBadge } from "../components/conversation/Badges";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";

export default function Followups() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FollowUpStatus | "">("");
  const [priority, setPriority] = useState<FollowUpPriority | "">("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [sendId, setSendId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [form, setForm] = useState({
    conversation_id: "",
    customer_name: "",
    customer_phone: "",
    product_interest: "",
    priority: "medium" as FollowUpPriority,
    notes: "",
  });

  const list = useQuery({
    queryKey: ["followups", status, priority, search],
    queryFn: () => fetchFollowUps({ status, priority, search }),
  });
  const conversations = useQuery({
    queryKey: ["conversations", { page: 1, pageSize: 50 }],
    queryFn: () => fetchConversations({ page: 1, pageSize: 50 }),
  });
  const salesmen = useQuery({ queryKey: ["salesmen"], queryFn: fetchSalesmen });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["followups"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const create = useMutation({
    mutationFn: () => createFollowUp(form),
    onSuccess: () => {
      setOpen(false);
      setForm({ conversation_id: "", customer_name: "", customer_phone: "", product_interest: "", priority: "medium", notes: "" });
      invalidate();
    },
  });
  const complete = useMutation({ mutationFn: (id: string) => completeFollowUp(id), onSuccess: invalidate });
  const cancel = useMutation({ mutationFn: (id: string) => cancelFollowUp(id), onSuccess: invalidate });
  const snooze = useMutation({
    mutationFn: (id: string) => snoozeFollowUp(id, addDays(new Date(), 2).toISOString()),
    onSuccess: invalidate,
  });
  const suggest = useMutation({ mutationFn: suggestFollowUpMessage, onSuccess: invalidate });
  const preview = useQuery({
    queryKey: ["whatsapp-preview", sendId],
    queryFn: () => previewFollowUpMessage(sendId!),
    enabled: Boolean(sendId),
  });
  const sendWhatsApp = useMutation({
    mutationFn: () => sendFollowUpWhatsApp(sendId!, draft || preview.data?.text),
    onSuccess: () => {
      setSendId(null);
      setDraft("");
      invalidate();
    },
  });

  const rows = useMemo(() => list.data ?? [], [list.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("pages.followups")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("pages.followupsHint")}</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu onExport={exportFollowUpsCsv} />
          <Button onClick={() => setOpen(true)}>Create follow-up</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Input placeholder="Search customer name" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value as FollowUpStatus | "")}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="snoozed">Snoozed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value as FollowUpPriority | "")}>
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
      </div>

      {list.isLoading ? (
        <Skeleton className="h-48" />
      ) : list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />
      ) : !rows.length ? (
        <EmptyState title="No follow-ups yet" hint="Analyze a high-intent conversation, or create one manually." />
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.customer_name || "Unknown customer"}</p>
                    <PriorityBadge priority={item.priority} />
                    <FollowUpStatusBadge status={item.status} />
                    {item.lead_score != null ? <span className="text-xs text-slate-500">Lead {item.lead_score}</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{item.product_interest || "No product captured"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDueLabel(item.follow_up_date)}
                    {item.customer_phone ? ` · ${item.customer_phone}` : ""}
                    {item.salesman_name ? ` · ${item.salesman_name}` : ""}
                  </p>
                  {item.notes ? <p className="mt-2 text-sm text-slate-300">{item.notes}</p> : null}
                  {item.suggested_message ? (
                    <p className="mt-2 rounded-lg bg-slate-950 px-3 py-2 text-sm text-emerald-200">{item.suggested_message}</p>
                  ) : null}
                  {item.message_sent ? <p className="mt-2 text-xs text-emerald-400">Message sent via {item.contact_method ?? "whatsapp"}</p> : null}
                  <Link to={`/conversations/${item.conversation_id}`} className="mt-2 inline-block text-sm text-emerald-400">
                    Open conversation
                  </Link>
                </div>
                {item.status === "pending" || item.status === "snoozed" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => complete.mutate(item.id)}>
                      Complete
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => snooze.mutate(item.id)}>
                      Snooze 2 days
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => suggest.mutate(item.id)}>
                      Suggest SMS
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSendId(item.id);
                        setDraft(item.suggested_message ?? "");
                      }}
                    >
                      Send WhatsApp
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => cancel.mutate(item.id)}>
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {sendId ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/70 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Send WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {preview.isLoading ? <Skeleton className="h-24" /> : null}
              {preview.data && !preview.data.consented ? (
                <p className="text-sm text-amber-300">This customer has not given contact consent yet.</p>
              ) : null}
              <textarea
                className="min-h-32 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={draft || preview.data?.text || ""}
                onChange={(e) => setDraft(e.target.value)}
              />
              <p className="text-xs text-slate-500">To: {preview.data?.phone || "no number"}</p>
              {sendWhatsApp.isError ? <p className="text-sm text-red-300">{sendWhatsApp.error.message}</p> : null}
              <div className="flex gap-2">
                <Button onClick={() => sendWhatsApp.mutate()} disabled={sendWhatsApp.isPending || !preview.data?.consented}>
                  {sendWhatsApp.isPending ? "Sending…" : "Send"}
                </Button>
                <Button variant="ghost" onClick={() => setSendId(null)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/70 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>New follow-up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={form.conversation_id}
                onChange={(e) => setForm((current) => ({ ...current, conversation_id: e.target.value }))}
                required
              >
                <option value="">Select conversation</option>
                {(conversations.data?.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.recorded_at.slice(0, 16)} · {item.salesman_name ?? item.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Customer name"
                value={form.customer_name}
                onChange={(e) => setForm((current) => ({ ...current, customer_name: e.target.value }))}
              />
              <Input
                placeholder="Phone"
                value={form.customer_phone}
                onChange={(e) => setForm((current) => ({ ...current, customer_phone: e.target.value }))}
              />
              <Input
                placeholder="Product interest"
                value={form.product_interest}
                onChange={(e) => setForm((current) => ({ ...current, product_interest: e.target.value }))}
              />
              <Select
                value={form.priority}
                onChange={(e) => setForm((current) => ({ ...current, priority: e.target.value as FollowUpPriority }))}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
              <Input
                placeholder="Notes"
                value={form.notes}
                onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
              />
              {salesmen.data?.length ? (
                <p className="text-xs text-slate-500">{salesmen.data.length} salesmen available for later assignment.</p>
              ) : null}
              {create.isError ? <p className="text-sm text-red-300">{create.error.message}</p> : null}
              <div className="flex gap-2">
                <Button onClick={() => create.mutate()} disabled={!form.conversation_id || create.isPending}>
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
