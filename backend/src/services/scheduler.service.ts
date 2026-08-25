import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import { createNotification } from "./notification.service.js";
import { generateDailyReport, generateMonthlyReport, generateWeeklyReport } from "./report.service.js";
import { buildDailyReportVars, flushQueuedMessages, queueDailyReportMessage } from "./communication.service.js";
import { runScheduledBackups } from "./backup.service.js";

const HOUR_MS = 60 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;

function alreadySentToday(value?: string | null): boolean {
  if (!value) return false;
  return value.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function shouldRun(type: string, now: Date): boolean {
  const hour = now.getHours();
  const day = now.getDay();
  const date = now.getDate();
  if (hour !== 20) return false;
  if (type === "daily") return true;
  if (type === "weekly") return day === 1;
  if (type === "monthly") return date === 1;
  return false;
}

export async function runScheduledReports(now = new Date()): Promise<number> {
  const { data, error } = await getSupabase().from("scheduled_reports").select("*").eq("is_active", true);
  if (error) {
    logger.error({ error }, "Failed to load scheduled reports");
    return 0;
  }

  let sent = 0;
  for (const row of data ?? []) {
    const type = String(row.report_type);
    if (!shouldRun(type, now) || alreadySentToday(row.last_sent_at ? String(row.last_sent_at) : null)) continue;

    try {
      const organizationId = String(row.organization_id);
      const report =
        type === "weekly"
          ? await generateWeeklyReport(organizationId)
          : type === "monthly"
            ? await generateMonthlyReport(organizationId)
            : await generateDailyReport(organizationId);

      await getSupabase()
        .from("scheduled_reports")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", row.id);

      await createNotification({
        organizationId,
        type: "report_ready",
        title: `${type} report ready`,
        message: `A ${type} store report was generated${row.recipient_email ? ` for ${row.recipient_email}` : ""}.`,
        metadata: { report_id: report.id, file_url: report.file_url, recipient_email: row.recipient_email },
      });
      if (type === "daily") {
        const vars = await buildDailyReportVars(organizationId, report.file_url);
        void queueDailyReportMessage(organizationId, vars);
      }
      sent += 1;
      logger.info({ organizationId, type, reportId: report.id }, "Scheduled report generated");
    } catch (err) {
      logger.error({ err, scheduleId: row.id }, "Scheduled report failed");
    }
  }
  return sent;
}

export function startReportScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    void runScheduledReports();
    void flushQueuedMessages();
    void runScheduledBackups();
  }, HOUR_MS);
  logger.info("Report scheduler started (hourly)");
}

export function stopReportScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function listSchedules(organizationId: string) {
  const { data, error } = await getSupabase()
    .from("scheduled_reports")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertSchedule(
  organizationId: string,
  input: { id?: string; report_type: string; recipient_email?: string; is_active?: boolean },
) {
  if (input.id) {
    const { data, error } = await getSupabase()
      .from("scheduled_reports")
      .update({
        report_type: input.report_type,
        recipient_email: input.recipient_email ?? null,
        is_active: input.is_active ?? true,
      })
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select()
      .single();
    if (error || !data) throw error ?? new Error("Schedule not found");
    return data;
  }
  const { data, error } = await getSupabase()
    .from("scheduled_reports")
    .insert({
      organization_id: organizationId,
      report_type: input.report_type,
      recipient_email: input.recipient_email ?? null,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to create schedule");
  return data;
}
