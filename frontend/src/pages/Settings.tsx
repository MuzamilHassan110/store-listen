import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  fetchCommunicationSettings,
  fetchRetentionStatus,
  fetchSchedules,
  runRetentionCleanup,
  saveCommunicationSettings,
  saveRetentionDays,
  saveSchedule,
} from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { ErrorState } from "../components/States";

export default function Settings() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [type, setType] = useState("weekly");
  const [days, setDays] = useState(90);
  const comm = useQuery({ queryKey: ["communication-settings"], queryFn: fetchCommunicationSettings });
  const saveComm = useMutation({
    mutationFn: saveCommunicationSettings,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["communication-settings"] }),
  });

  const schedules = useQuery({ queryKey: ["schedules"], queryFn: fetchSchedules });
  const retention = useQuery({
    queryKey: ["retention"],
    queryFn: fetchRetentionStatus,
  });

  const save = useMutation({
    mutationFn: () => saveSchedule({ report_type: type, recipient_email: email, is_active: true }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });
  const toggle = useMutation({
    mutationFn: (item: { id: string; report_type: string; is_active: boolean; recipient_email?: string | null }) =>
      saveSchedule({ ...item, is_active: !item.is_active }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });
  const saveDays = useMutation({
    mutationFn: () => saveRetentionDays(days),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["retention"] }),
  });
  const cleanup = useMutation({
    mutationFn: () => runRetentionCleanup(days),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["retention"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pages.settings")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("pages.settingsHint")}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link to="/settings/security" className="text-emerald-400">
            Security settings
          </Link>
          <Link to="/audit-logs" className="text-emerald-400">
            Audit logs
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notifications & quiet hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {comm.isError ? (
            <ErrorState message={comm.error.message} onRetry={() => void comm.refetch()} />
          ) : (
            <>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={comm.data?.push_enabled ?? true}
                  onChange={(e) => saveComm.mutate({ push_enabled: e.target.checked })}
                />
                Push notifications
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={comm.data?.whatsapp_enabled ?? false}
                  onChange={(e) => saveComm.mutate({ whatsapp_enabled: e.target.checked })}
                />
                WhatsApp notifications
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={comm.data?.sms_enabled ?? false}
                  onChange={(e) => saveComm.mutate({ sms_enabled: e.target.checked })}
                />
                SMS notifications
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-slate-400">
                  Quiet hours start (24h)
                  <Input
                    type="number"
                    className="mt-1"
                    value={comm.data?.quiet_hours_start ?? 22}
                    onChange={(e) => saveComm.mutate({ quiet_hours_start: Number(e.target.value) })}
                  />
                </label>
                <label className="text-sm text-slate-400">
                  Quiet hours end
                  <Input
                    type="number"
                    className="mt-1"
                    value={comm.data?.quiet_hours_end ?? 9}
                    onChange={(e) => saveComm.mutate({ quiet_hours_end: Number(e.target.value) })}
                  />
                </label>
              </div>
              <Input
                placeholder="Manager WhatsApp number"
                defaultValue={comm.data?.manager_whatsapp ?? ""}
                onBlur={(e) => saveComm.mutate({ manager_whatsapp: e.target.value || null })}
              />
              <Link to="/settings/whatsapp" className="inline-flex min-h-11 items-center text-sm text-emerald-400">
                Open WhatsApp settings
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="daily">Daily (20:00)</option>
              <option value="weekly">Weekly (Monday 20:00)</option>
              <option value="monthly">Monthly (1st 20:00)</option>
            </Select>
            <Input type="email" placeholder="Recipient email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Add schedule"}
            </Button>
          </div>
          {schedules.isLoading ? (
            <Skeleton className="h-24" />
          ) : schedules.isError ? (
            <ErrorState message={schedules.error.message} onRetry={() => void schedules.refetch()} />
          ) : (
            <div className="space-y-2">
              {(schedules.data ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm">
                  <span>
                    {item.report_type} · {item.recipient_email || "no email"} · {item.is_active ? "on" : "off"}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => toggle.mutate(item)}>
                    {item.is_active ? "Disable" : "Enable"}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500">
            The API checks hourly. When a report is due it is generated and a dashboard notification is created. Email
            delivery can be wired later.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {retention.isError ? (
            <ErrorState message={retention.error.message} onRetry={() => void retention.refetch()} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <p className="text-sm text-slate-400">Conversations: {retention.data?.conversation_count ?? "—"}</p>
              <p className="text-sm text-slate-400">Recordings: {retention.data?.recordings_count ?? "—"}</p>
              <p className="text-sm text-slate-400">Archived: {retention.data?.archived_count ?? "—"}</p>
              <p className="text-sm text-slate-400">Oldest: {retention.data?.oldest_conversation?.slice(0, 10) ?? "—"}</p>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-slate-400">
              Keep recordings (days)
              <Input type="number" className="mt-1 w-32" value={days} onChange={(e) => setDays(Number(e.target.value))} />
            </label>
            <Button variant="secondary" onClick={() => saveDays.mutate()} disabled={saveDays.isPending}>
              Save
            </Button>
            <Button variant="danger" onClick={() => cleanup.mutate()} disabled={cleanup.isPending}>
              {cleanup.isPending ? "Cleaning…" : "Run cleanup"}
            </Button>
          </div>
          {cleanup.data ? <p className="text-sm text-emerald-300">Archived {cleanup.data.archived} recordings.</p> : null}
          <p className="text-xs text-slate-500">
            Cleanup copies transcript/analysis into the archive table and deletes audio older than the retention window.
            Scores stay on the live conversation row.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
