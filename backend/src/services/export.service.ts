import { toCsv } from "../lib/csv.js";
import { HttpError } from "../lib/http-error.js";
import { getSupabase } from "../lib/supabase.js";
import { getSalesmanLeaderboard } from "./salesman.service.js";

export type ExportFile = {
  filename: string;
  csv: string;
};

function latestAnalysis(value: unknown): Record<string, unknown> | null {
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  return (rows[0] as Record<string, unknown> | undefined) ?? null;
}

export async function exportConversationsToCSV(
  organizationId: string,
  filters: { from?: string; to?: string; status?: string; salesmanId?: string } = {},
): Promise<ExportFile> {
  let query = getSupabase()
    .from("conversations")
    .select("id, recorded_at, duration_seconds, language, status, salesman_id, salesmen (name), conversation_analyses (sentiment, purchase_intent, overall_score)")
    .eq("organization_id", organizationId)
    .order("recorded_at", { ascending: false })
    .limit(2000);
  if (filters.from) query = query.gte("recorded_at", filters.from);
  if (filters.to) query = query.lte("recorded_at", filters.to);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.salesmanId) query = query.eq("salesman_id", filters.salesmanId);

  const { data, error } = await query;
  if (error) throw new HttpError(500, "Failed to export conversations.", "EXPORT_FAILED");

  const rows = (data ?? []).map((row) => {
    const analysis = latestAnalysis(row.conversation_analyses);
    const salesman = Array.isArray(row.salesmen) ? row.salesmen[0] : row.salesmen;
    return [
      row.id,
      row.recorded_at,
      row.duration_seconds,
      row.language,
      row.status,
      analysis?.sentiment ?? "",
      analysis?.purchase_intent ?? "",
      salesman && typeof salesman === "object" ? (salesman as { name?: string }).name ?? "" : "",
      analysis?.overall_score ?? "",
    ];
  });

  return {
    filename: "storelisten-conversations.csv",
    csv: toCsv(
      ["id", "date", "duration", "language", "status", "sentiment", "purchase_intent", "salesman", "score"],
      rows,
    ),
  };
}

export async function exportSalesmenToCSV(organizationId: string): Promise<ExportFile> {
  const board = await getSalesmanLeaderboard(organizationId, "all");
  return {
    filename: "storelisten-salesmen.csv",
    csv: toCsv(
      [
        "name",
        "total_conversations",
        "avg_score",
        "communication",
        "product_knowledge",
        "objection_handling",
        "closing_ability",
        "rule_compliance",
      ],
      board.map((row) => [
        row.salesman_name,
        row.total_conversations,
        row.average_score,
        row.average_scores.communication,
        row.average_scores.product_knowledge,
        row.average_scores.objection_handling,
        row.average_scores.closing_ability,
        row.average_scores.rule_compliance,
      ]),
    ),
  };
}

export async function exportFollowUpsToCSV(organizationId: string): Promise<ExportFile> {
  const { data, error } = await getSupabase()
    .from("follow_ups")
    .select("customer_name, priority, status, follow_up_date, product_interest, lead_score")
    .eq("organization_id", organizationId)
    .order("follow_up_date", { ascending: true })
    .limit(2000);
  if (error) throw new HttpError(500, "Failed to export follow-ups.", "EXPORT_FAILED");

  return {
    filename: "storelisten-followups.csv",
    csv: toCsv(
      ["customer", "priority", "status", "due_date", "product", "lead_score"],
      (data ?? []).map((row) => [
        row.customer_name,
        row.priority,
        row.status,
        row.follow_up_date,
        row.product_interest,
        row.lead_score,
      ]),
    ),
  };
}

export async function exportCustomersToCSV(organizationId: string): Promise<ExportFile> {
  const { data, error } = await getSupabase()
    .from("customers")
    .select("name, phone, total_visits, total_purchases, last_visit_at")
    .eq("organization_id", organizationId)
    .order("last_visit_at", { ascending: false })
    .limit(2000);
  if (error) throw new HttpError(500, "Failed to export customers.", "EXPORT_FAILED");

  return {
    filename: "storelisten-customers.csv",
    csv: toCsv(
      ["name", "phone", "visits", "purchases", "last_visit", "total_spent"],
      (data ?? []).map((row) => [
        row.name,
        row.phone,
        row.total_visits,
        row.total_purchases,
        row.last_visit_at,
        0,
      ]),
    ),
  };
}
