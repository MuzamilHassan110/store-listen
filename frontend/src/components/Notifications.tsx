import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "../services/api";
import { Button } from "./ui/button";

function destination(metadata?: Record<string, unknown>, type?: string): string {
  const followUpId = metadata?.follow_up_id ? String(metadata.follow_up_id) : "";
  const conversationId = metadata?.conversation_id ? String(metadata.conversation_id) : "";
  if (type === "report_ready") return "/reports";
  if (type === "follow_up_due" || followUpId) return "/followups";
  if (conversationId) return `/conversations/${conversationId}`;
  if (type === "high_intent") return "/followups";
  return "/";
}

export function Notifications() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications, refetchInterval: 60_000 });
  const unread = useMemo(() => (list.data ?? []).filter((item) => !item.is_read).length, [list.data]);

  const markOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-lg p-2 text-slate-300 hover:bg-slate-800"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Notifications</p>
            <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={!unread}>
              Mark all read
            </Button>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {(list.data ?? []).length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">No notifications yet.</p>
            ) : (
              (list.data ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${item.is_read ? "bg-slate-900/40 text-slate-400" : "bg-slate-900 text-slate-100"}`}
                  onClick={() => {
                    if (!item.is_read) markOne.mutate(item.id);
                    setOpen(false);
                    navigate(destination(item.metadata, item.type));
                  }}
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.message}</p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
