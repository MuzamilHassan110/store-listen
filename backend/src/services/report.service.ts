import PDFDocument from "pdfkit";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../lib/supabase.js";
import { getConversationBundle } from "./conversation.service.js";
import { getSalesmanLeaderboard, getSalesmanPerformance } from "./salesman.service.js";

export type DateRangeInput = { start: string; end: string };

export type StoredReport = {
  id: string;
  organization_id: string;
  report_type: string;
  file_url: string | null;
  file_name: string | null;
  generated_at: string;
  date_range: DateRangeInput | null;
  metadata: Record<string, unknown>;
};

const REPORTS_BUCKET = "reports";

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function bufferFromPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

class PdfReport {
  readonly doc: PDFKit.PDFDocument;

  constructor(title: string, subtitle: string) {
    this.doc = new PDFDocument({ margin: 48, size: "A4" });
    this.doc.fillColor("#0f172a").fontSize(22).text("StoreListen", { continued: false });
    this.doc.fontSize(16).fillColor("#047857").text(title);
    this.doc.moveDown(0.3);
    this.doc.fontSize(10).fillColor("#64748b").text(subtitle);
    this.doc.moveDown();
    this.doc.strokeColor("#e2e8f0").moveTo(48, this.doc.y).lineTo(547, this.doc.y).stroke();
    this.doc.moveDown();
  }

  heading(text: string): void {
    this.ensureSpace(48);
    this.doc.moveDown(0.4);
    this.doc.fontSize(13).fillColor("#0f172a").text(text);
    this.doc.moveDown(0.2);
  }

  line(label: string, value: string): void {
    this.ensureSpace(20);
    this.doc.fontSize(10).fillColor("#64748b").text(`${label}: `, { continued: true });
    this.doc.fillColor("#0f172a").text(value || "—");
  }

  paragraph(text: string): void {
    this.ensureSpace(36);
    this.doc.fontSize(10).fillColor("#334155").text(text || "—", { align: "left" });
  }

  bullets(items: string[]): void {
    if (!items.length) {
      this.paragraph("None recorded.");
      return;
    }
    for (const item of items) {
      this.ensureSpace(18);
      this.doc.fontSize(10).fillColor("#334155").text(`• ${item}`);
    }
  }

  scoreBar(label: string, value?: number | null): void {
    this.ensureSpace(28);
    const score = Math.max(0, Math.min(100, Number(value ?? 0)));
    this.doc.fontSize(10).fillColor("#0f172a").text(`${label}  ${value ?? "—"}`);
    const x = 48;
    const y = this.doc.y + 2;
    this.doc.save();
    this.doc.rect(x, y, 300, 8).fill("#e2e8f0");
    this.doc.rect(x, y, 300 * (score / 100), 8).fill(score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444");
    this.doc.restore();
    this.doc.moveDown(1.1);
  }

  ensureSpace(needed: number): void {
    if (this.doc.y + needed > 760) this.doc.addPage();
  }
}

async function uploadAndRecord(input: {
  organizationId: string;
  reportType: string;
  fileName: string;
  buffer: Buffer;
  dateRange?: DateRangeInput | null;
  metadata?: Record<string, unknown>;
}): Promise<StoredReport> {
  const supabase = getSupabase();
  const path = `${input.organizationId}/${input.fileName}`;
  const { error: uploadError } = await supabase.storage.from(REPORTS_BUCKET).upload(path, input.buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) {
    logger.error({ error: uploadError, path }, "Failed to upload report PDF");
    throw new HttpError(500, "Failed to store the PDF report.", "REPORT_UPLOAD_FAILED");
  }

  const { data: signed } = await supabase.storage.from(REPORTS_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  const fileUrl = signed?.signedUrl ?? null;

  const { data, error } = await supabase
    .from("reports")
    .insert({
      organization_id: input.organizationId,
      report_type: input.reportType,
      file_url: fileUrl,
      file_path: path,
      file_name: input.fileName,
      date_range: input.dateRange ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();
  if (error || !data) {
    logger.error({ error }, "Failed to save report row");
    throw new HttpError(500, "Failed to save report metadata.", "REPORT_SAVE_FAILED");
  }
  return mapReport(data as Record<string, unknown>);
}

function mapReport(row: Record<string, unknown>): StoredReport {
  const range = row.date_range as DateRangeInput | null;
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    report_type: String(row.report_type),
    file_url: row.file_url ? String(row.file_url) : null,
    file_name: row.file_name ? String(row.file_name) : null,
    generated_at: String(row.generated_at ?? new Date().toISOString()),
    date_range: range?.start && range?.end ? range : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

export async function listReports(organizationId: string): Promise<StoredReport[]> {
  const { data, error } = await getSupabase()
    .from("reports")
    .select("*")
    .eq("organization_id", organizationId)
    .order("generated_at", { ascending: false })
    .limit(50);
  if (error) throw new HttpError(500, "Failed to list reports.", "REPORTS_LOAD_FAILED");
  return (data ?? []).map((row) => mapReport(row as Record<string, unknown>));
}

export async function generateConversationReport(
  organizationId: string,
  conversationId: string,
): Promise<StoredReport> {
  const bundle = await getConversationBundle(conversationId, organizationId);
  if (!bundle) throw new HttpError(404, "Conversation not found.", "NOT_FOUND");

  const conversation = bundle.conversation;
  const analysis = bundle.analysis;
  const recordedAt = String(conversation.recorded_at ?? conversation.created_at ?? "");
  const pdf = new PdfReport("Conversation report", `Generated ${new Date().toLocaleString()}`);

  pdf.heading("Conversation metadata");
  pdf.line("Date", recordedAt);
  pdf.line("Duration", `${Number(conversation.duration_seconds ?? 0)} seconds`);
  pdf.line("Language", String(conversation.language ?? analysis?.language ?? "—"));
  pdf.line("Status", String(conversation.status ?? "—"));

  pdf.heading("AI summary");
  pdf.paragraph(analysis?.summary ?? "No summary.");
  pdf.line("Sentiment", String(analysis?.sentiment ?? "—"));
  pdf.line("Purchase intent", String(analysis?.purchase_intent ?? "—"));

  pdf.heading("Salesman scores");
  pdf.scoreBar("Overall", analysis?.overall_score);
  pdf.scoreBar("Communication", analysis?.communication_score);
  pdf.scoreBar("Product knowledge", analysis?.product_knowledge_score);
  pdf.scoreBar("Objection handling", analysis?.objection_handling_score);
  pdf.scoreBar("Closing ability", analysis?.closing_ability_score);
  pdf.scoreBar("Rule compliance", analysis?.rule_compliance_score);

  pdf.heading("Objections");
  pdf.bullets(asList(analysis?.objections));
  pdf.heading("Customer questions");
  pdf.bullets(asList(analysis?.customer_questions));
  pdf.heading("Key points");
  pdf.bullets(asList(analysis?.key_points));

  pdf.heading("Rule compliance");
  if (bundle.rule_results.length) {
    pdf.bullets(
      bundle.rule_results.map(
        (item) => `${item.is_followed ? "[x]" : "[ ]"} ${item.description || item.rule_type}${item.evidence ? ` — ${item.evidence}` : ""}`,
      ),
    );
  } else {
    pdf.paragraph("No rule results.");
  }

  pdf.heading("Transcript");
  if (bundle.segments.length) {
    for (const segment of bundle.segments) {
      pdf.paragraph(`${String(segment.speaker ?? "speaker").toUpperCase()}: ${String(segment.text ?? "")}`);
    }
  } else {
    pdf.paragraph(String(bundle.transcript?.text ?? "No transcript."));
  }

  pdf.heading("Recommendations");
  pdf.bullets(asList(analysis?.recommendations));

  const buffer = await bufferFromPdf(pdf.doc);
  const fileName = `conversation-${conversationId.slice(0, 8)}-${Date.now()}.pdf`;
  return uploadAndRecord({
    organizationId,
    reportType: "conversation",
    fileName,
    buffer,
    metadata: { conversation_id: conversationId },
  });
}

export async function generateSalesmanReport(
  organizationId: string,
  salesmanId: string,
  dateRange: DateRangeInput,
): Promise<StoredReport> {
  const performance = await getSalesmanPerformance(organizationId, salesmanId);
  const pdf = new PdfReport(
    `Salesman report — ${performance.salesman_name}`,
    `${dateRange.start} to ${dateRange.end}`,
  );

  pdf.heading("Profile");
  pdf.line("Name", performance.salesman_name);
  pdf.line("Conversations", String(performance.total_conversations));
  pdf.scoreBar("Overall", performance.average_scores.overall);
  pdf.scoreBar("Communication", performance.average_scores.communication);
  pdf.scoreBar("Product knowledge", performance.average_scores.product_knowledge);
  pdf.scoreBar("Objection handling", performance.average_scores.objection_handling);
  pdf.scoreBar("Closing ability", performance.average_scores.closing_ability);
  pdf.scoreBar("Rule compliance", performance.average_scores.rule_compliance);

  pdf.heading("7-day trend");
  pdf.paragraph(performance.trends.last_7_days.map((value, index) => `D${index + 1}:${value}`).join("   "));

  pdf.heading("Strengths");
  pdf.bullets(performance.top_strengths);
  pdf.heading("Weaknesses");
  pdf.bullets(performance.top_weaknesses);

  pdf.heading("Recent conversations");
  pdf.bullets(
    performance.recent_conversations.map(
      (item) => `${item.recorded_at.slice(0, 16)} · ${item.duration_seconds}s · score ${item.overall_score ?? "—"}`,
    ),
  );

  pdf.heading("Improvement recommendations");
  pdf.bullets(
    performance.top_weaknesses.map((item) => `Coach this salesman on ${item.toLowerCase()} with a short role-play this week.`),
  );

  const buffer = await bufferFromPdf(pdf.doc);
  return uploadAndRecord({
    organizationId,
    reportType: "salesman",
    fileName: `salesman-${salesmanId.slice(0, 8)}-${Date.now()}.pdf`,
    buffer,
    dateRange,
    metadata: { salesman_id: salesmanId },
  });
}

async function storeStats(organizationId: string, dateRange: DateRangeInput) {
  let query = getSupabase()
    .from("conversations")
    .select("id, recorded_at, duration_seconds, conversation_analyses(*)")
    .eq("organization_id", organizationId)
    .gte("recorded_at", `${dateRange.start}T00:00:00.000Z`)
    .lte("recorded_at", `${dateRange.end}T23:59:59.999Z`)
    .limit(2000);
  const { data, error } = await query;
  if (error) throw new HttpError(500, "Failed to load store report data.", "REPORT_LOAD_FAILED");

  const rows = data ?? [];
  const analyses = rows.map((row) => {
    const list = Array.isArray(row.conversation_analyses) ? row.conversation_analyses : [];
    return list[0] as Record<string, unknown> | undefined;
  });
  const scores = analyses.map((item) => Number(item?.overall_score ?? 0)).filter((value) => value > 0);
  const objections = new Map<string, number>();
  const intent = { high: 0, medium: 0, low: 0 };
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const item of analyses) {
    for (const objection of asList(item?.objections)) {
      objections.set(objection, (objections.get(objection) ?? 0) + 1);
    }
    const intentKey = String(item?.purchase_intent ?? "") as keyof typeof intent;
    if (intentKey in intent) intent[intentKey] += 1;
    const sentimentKey = String(item?.sentiment ?? "") as keyof typeof sentiment;
    if (sentimentKey in sentiment) sentiment[sentimentKey] += 1;
  }
  const leaderboard = await getSalesmanLeaderboard(organizationId, "all");
  return {
    total: rows.length,
    averageScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
    objections: [...objections.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    intent,
    sentiment,
    leaderboard: leaderboard.slice(0, 8),
  };
}

export async function generateStoreReport(
  organizationId: string,
  dateRange: DateRangeInput,
  reportType: "store" | "daily" | "weekly" | "monthly" = "store",
): Promise<StoredReport> {
  const stats = await storeStats(organizationId, dateRange);
  const pdf = new PdfReport("Store performance report", `${dateRange.start} to ${dateRange.end}`);

  pdf.heading("Overview");
  pdf.line("Total conversations", String(stats.total));
  pdf.scoreBar("Average score", stats.averageScore);
  pdf.line("Customer satisfaction (positive)", String(stats.sentiment.positive));
  pdf.line("Purchase intent high / medium / low", `${stats.intent.high} / ${stats.intent.medium} / ${stats.intent.low}`);

  pdf.heading("Top objections");
  pdf.bullets(stats.objections.map(([name, count]) => `${name} (${count})`));

  pdf.heading("Salesman leaderboard");
  pdf.bullets(stats.leaderboard.map((item) => `${item.rank}. ${item.salesman_name} — ${item.average_score}`));

  pdf.heading("Recommendations");
  pdf.bullets([
    stats.averageScore < 70 ? "Run a coaching huddle on objection handling this week." : "Keep reinforcing the current talk track.",
    stats.intent.high > 0 ? "Follow up every high-intent lead within 24 hours." : "Improve discovery questions to raise purchase intent.",
    "Review rule compliance for greeting, warranty, and return policy.",
  ]);

  const buffer = await bufferFromPdf(pdf.doc);
  return uploadAndRecord({
    organizationId,
    reportType,
    fileName: `${reportType}-${dateRange.start}-${Date.now()}.pdf`,
    buffer,
    dateRange,
  });
}

export async function generateDailyReport(organizationId: string): Promise<StoredReport> {
  const day = new Date().toISOString().slice(0, 10);
  return generateStoreReport(organizationId, { start: day, end: day }, "daily");
}

export async function generateWeeklyReport(organizationId: string): Promise<StoredReport> {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  return generateStoreReport(
    organizationId,
    { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
    "weekly",
  );
}

export async function generateMonthlyReport(organizationId: string): Promise<StoredReport> {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return generateStoreReport(
    organizationId,
    { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
    "monthly",
  );
}
