import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectWhatsApp,
  fetchCommunicationSettings,
  fetchWhatsAppHistory,
  fetchWhatsAppStatus,
  fetchWhatsAppTemplates,
  logoutWhatsApp,
  saveCommunicationSettings,
  sendWhatsAppTest,
} from "../services/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { ErrorState } from "../components/States";
import { useLanguage } from "../contexts/LanguageContext";

export default function WhatsAppSettings() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [testPhone, setTestPhone] = useState("");
  const [testText, setTestText] = useState("StoreListen test message");

  const status = useQuery({ queryKey: ["whatsapp-status"], queryFn: fetchWhatsAppStatus, refetchInterval: 4000 });
  const templates = useQuery({ queryKey: ["whatsapp-templates"], queryFn: fetchWhatsAppTemplates });
  const history = useQuery({ queryKey: ["whatsapp-history"], queryFn: fetchWhatsAppHistory });
  const settings = useQuery({ queryKey: ["communication-settings"], queryFn: fetchCommunicationSettings });

  const connect = useMutation({
    mutationFn: connectWhatsApp,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] }),
  });
  const logout = useMutation({
    mutationFn: logoutWhatsApp,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] }),
  });
  const sendTest = useMutation({
    mutationFn: () => sendWhatsAppTest(testPhone, testText),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["whatsapp-history"] }),
  });
  const save = useMutation({
    mutationFn: saveCommunicationSettings,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["communication-settings"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pages.whatsapp")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("pages.whatsappHint")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {status.isError ? (
            <ErrorState message={status.error.message} onRetry={() => void status.refetch()} />
          ) : (
            <p className="text-sm text-slate-300">
              Status: <span className="font-medium text-emerald-300">{status.data?.status ?? "…"}</span>
              {status.data?.enabled ? "" : " · WhatsApp is disabled on the server (WHATSAPP_ENABLED)"}
            </p>
          )}
          {status.data?.qr_data_url ? (
            <img src={status.data.qr_data_url} alt="WhatsApp QR" className="h-56 w-56 rounded-lg bg-white p-2" />
          ) : status.data?.qr ? (
            <p className="break-all text-xs text-slate-500">{status.data.qr}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => connect.mutate()} disabled={connect.isPending || status.data?.ready}>
              {connect.isPending ? "Connecting…" : "Generate QR"}
            </Button>
            <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
              Disconnect
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Scan the QR from WhatsApp on the store phone. One WhatsApp Web session per backend process.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.isLoading ? <Skeleton className="h-24" /> : null}
          {(templates.data?.templates ?? []).map((item) => (
            <div key={`${item.channel}-${item.name}`} className="rounded-lg bg-slate-950 px-3 py-2 text-sm">
              <p className="font-medium">
                {item.label} · {item.channel}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-slate-400">{item.body}</p>
            </div>
          ))}
          <label className="block text-sm text-slate-400">
            Follow-up template override
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={settings.data?.follow_up_template ?? ""}
              onChange={(e) =>
                queryClient.setQueryData(["communication-settings"], {
                  ...settings.data,
                  follow_up_template: e.target.value,
                })
              }
            />
          </label>
          <Button
            variant="secondary"
            onClick={() =>
              save.mutate({
                follow_up_template: settings.data?.follow_up_template || null,
              })
            }
            disabled={save.isPending}
          >
            Save template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Customer phone" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          <Input value={testText} onChange={(e) => setTestText(e.target.value)} />
          <Button onClick={() => sendTest.mutate()} disabled={!testPhone || sendTest.isPending}>
            {sendTest.isPending ? "Sending…" : "Send test"}
          </Button>
          {sendTest.isError ? <p className="text-sm text-red-300">{sendTest.error.message}</p> : null}
          {sendTest.isSuccess ? <p className="text-sm text-emerald-300">Status: {sendTest.data.status}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.isLoading ? <Skeleton className="h-24" /> : null}
          {(history.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No messages yet.</p>
          ) : (
            (history.data ?? []).map((item) => (
              <div key={item.id} className="rounded-lg bg-slate-950 px-3 py-2 text-sm">
                <p className="text-slate-200">
                  {item.channel} · {item.status} · {item.customer_phone || "no phone"}
                </p>
                <p className="mt-1 text-slate-400">{item.message_text}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
