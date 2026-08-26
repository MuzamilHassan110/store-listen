import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchCustomerById, fetchCustomerChurn, fetchWhatsAppHistory, updateCustomer } from "../services/api";
import { formatDateTime, formatDuration } from "../lib/format";
import { FollowUpStatusBadge, PriorityBadge, ChurnBadge } from "../components/conversation/Badges";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { ScoreBar } from "../components/conversation/ScoreBar";

export default function CustomerDetail() {
  const { t } = useLanguage();
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<string | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [smsNumber, setSmsNumber] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<"whatsapp" | "sms" | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const detail = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomerById(id),
    enabled: Boolean(id),
  });
  const churn = useQuery({
    queryKey: ["customer-churn", id],
    queryFn: () => fetchCustomerChurn(id),
    enabled: Boolean(id),
  });
  const history = useQuery({
    queryKey: ["whatsapp-history"],
    queryFn: fetchWhatsAppHistory,
    enabled: Boolean(id),
  });
  const saveNotes = useMutation({
    mutationFn: () =>
      updateCustomer(id, {
        notes: notes ?? detail.data?.notes ?? "",
        whatsapp_number: whatsappNumber ?? detail.data?.whatsapp_number ?? "",
        sms_number: smsNumber ?? detail.data?.sms_number ?? "",
        preferred_contact: preferred ?? detail.data?.preferred_contact ?? "whatsapp",
        contact_consent: consent ?? detail.data?.contact_consent ?? false,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["customer", id] }),
  });

  if (detail.isLoading) return <Skeleton className="h-64" />;
  if (detail.isError) return <ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} />;
  const customer = detail.data;
  if (!customer) return <EmptyState title="Customer not found" hint="They may belong to another organization." />;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/customers" className="text-sm text-emerald-400">
          ← Customers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{customer.name || t("pages.unnamedCustomer")}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ChurnBadge risk={churn.data?.churn_risk ?? customer.churn_risk} />
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {customer.phone || "No phone"} · {customer.preferred_language || "language unknown"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs uppercase text-slate-400">Visits</p>
            <p className="mt-2 text-3xl font-semibold">{customer.total_visits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase text-slate-400">Purchases</p>
            <p className="mt-2 text-3xl font-semibold">{customer.total_purchases}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase text-slate-400">Purchase probability</p>
            <div className="mt-3">
              <ScoreBar label="Likelihood" icon="📈" value={customer.purchase_probability} />
            </div>
          </CardContent>
        </Card>
      </div>

      {churn.data ? (
        <Card className={churn.data.churn_risk === "high" ? "border-red-500/40" : ""}>
          <CardHeader>
            <CardTitle>Churn prediction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <ChurnBadge risk={churn.data.churn_risk} />
              <span className="text-2xl font-semibold">{churn.data.churn_score}</span>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Risk factors</p>
              <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-slate-300">
                {churn.data.risk_factors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Retention suggestions</p>
              <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-emerald-200">
                {churn.data.retention_suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : churn.isError ? (
        <p className="text-sm text-amber-300">Churn analysis unavailable. Run migration 013 if this persists.</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Communication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="WhatsApp number"
            value={whatsappNumber ?? customer.whatsapp_number ?? customer.phone ?? ""}
            onChange={(e) => setWhatsappNumber(e.target.value)}
          />
          <Input
            placeholder="SMS number"
            value={smsNumber ?? customer.sms_number ?? customer.phone ?? ""}
            onChange={(e) => setSmsNumber(e.target.value)}
          />
          <select
            className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm"
            value={preferred ?? customer.preferred_contact ?? "whatsapp"}
            onChange={(e) => setPreferred(e.target.value === "sms" ? "sms" : "whatsapp")}
          >
            <option value="whatsapp">Prefer WhatsApp</option>
            <option value="sms">Prefer SMS</option>
          </select>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={consent ?? customer.contact_consent ?? false}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Customer consented to follow-up messages
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={notes ?? customer.notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interaction timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {customer.interactions.length ? (
            customer.interactions.map((item) => (
              <div key={item.id} className="rounded-lg bg-slate-950 px-3 py-2 text-sm">
                <p className="capitalize text-slate-200">{item.interaction_type || "visit"}</p>
                <p className="text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                {item.notes ? <p className="mt-1 text-slate-400">{item.notes}</p> : null}
                <Link to={`/conversations/${item.conversation_id}`} className="text-xs text-emerald-400">
                  Conversation
                </Link>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No interactions recorded.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {customer.conversations.length ? (
              customer.conversations.map((item) => (
                <Link key={item.id} to={`/conversations/${item.id}`} className="block rounded-lg bg-slate-950 px-3 py-2 text-sm hover:text-emerald-300">
                  {formatDateTime(item.recorded_at)} · {formatDuration(item.duration_seconds)}
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-400">No linked conversations.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Follow-up history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {customer.follow_ups.length ? (
              customer.follow_ups.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm">
                  <span>{item.product_interest || "Follow-up"}</span>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={item.priority} />
                    <FollowUpStatusBadge status={item.status} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No follow-ups yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(history.data ?? [])
            .filter((item) => item.customer_phone && (item.customer_phone === customer.phone || item.customer_phone === customer.whatsapp_number))
            .map((item) => (
              <p key={item.id} className="rounded-lg bg-slate-950 px-3 py-2 text-sm text-slate-300">
                {item.channel} · {item.status} · {item.message_text}
              </p>
            ))}
          {!(history.data ?? []).some((item) => item.customer_phone === customer.phone || item.customer_phone === customer.whatsapp_number) ? (
            <p className="text-sm text-slate-400">No outbound messages for this customer.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
