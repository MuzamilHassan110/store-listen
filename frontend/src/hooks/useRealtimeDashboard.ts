import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";

export function useRealtimeDashboard(): void {
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel("storelisten-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, () => {
        toast.push("New conversation uploaded");
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        void queryClient.invalidateQueries({ queryKey: ["analytics"] });
        void queryClient.invalidateQueries({ queryKey: ["activity"] });
        void queryClient.invalidateQueries({ queryKey: ["stores"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["devices"] });
        void queryClient.invalidateQueries({ queryKey: ["stores"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["activity"] });
      })
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [queryClient, toast]);
}
