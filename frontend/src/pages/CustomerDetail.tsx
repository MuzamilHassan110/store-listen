import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCustomerById, updateCustomerNotes } from "../services/api";
import { formatDateTime, formatDuration } from "../lib/format";
import { FollowUpStatusBadge, PriorityBadge } from "../components/conversation/Badges";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { ScoreBar } from "../components/conversation/ScoreBar";

export default function CustomerDetail() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomerById(id),
    enabled: Boolean(id),
  });
  const saveNotes = useMutation({
    mutationFn: () => updateCustomerNotes(id, notes ?? detail.data?.notes ?? ""),
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
        <h1 className="mt-2 text-2xl font-semibold">{customer.name || "Unnamed customer"}</h1>
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
            Save notes
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
    </div>
  );
}
