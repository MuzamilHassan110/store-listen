import { getSupabase } from "../lib/supabase.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { encryptBackupBuffer, decryptBackupBuffer } from "./encryption.service.js";

const TABLES = [
  "stores",
  "salesmen",
  "customers",
  "follow_ups",
  "conversation_rules",
  "organization_settings",
  "notifications",
] as const;

export type BackupJob = {
  id: string;
  organization_id: string;
  backup_type: string;
  status: string;
  file_path: string | null;
  file_size: number | null;
  error_text: string | null;
  created_at: string;
  completed_at: string | null;
};

function mapJob(row: Record<string, unknown>): BackupJob {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    backup_type: String(row.backup_type ?? "daily"),
    status: String(row.status ?? "pending"),
    file_path: row.file_path ? String(row.file_path) : null,
    file_size: typeof row.file_size === "number" ? row.file_size : null,
    error_text: row.error_text ? String(row.error_text) : null,
    created_at: String(row.created_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
  };
}

async function snapshotOrganization(organizationId: string): Promise<Record<string, unknown>> {
  const supabase = getSupabase();
  const payload: Record<string, unknown> = { organization_id: organizationId, exported_at: new Date().toISOString() };
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*").eq("organization_id", organizationId).limit(2000);
    if (error) logger.warn({ error, table }, "Backup table skipped");
    payload[table] = data ?? [];
  }
  return payload;
}

export async function runOrganizationBackup(
  organizationId: string,
  backupType: "daily" | "weekly" | "monthly" | "manual" = "manual",
): Promise<BackupJob> {
  const supabase = getSupabase();
  const { data: job, error: insertError } = await supabase
    .from("backup_jobs")
    .insert({ organization_id: organizationId, backup_type: backupType, status: "running" })
    .select()
    .single();
  if (insertError || !job) throw new HttpError(500, "Failed to start backup.", "BACKUP_START_FAILED");

  try {
    const snapshot = await snapshotOrganization(organizationId);
    const raw = Buffer.from(JSON.stringify(snapshot), "utf8");
    const packed = encryptBackupBuffer(raw);
    const path = `${organizationId}/${backupType}-${new Date().toISOString().replace(/[:.]/g, "-")}.slb`;
    const { error: uploadError } = await supabase.storage.from("backups").upload(path, packed, {
      contentType: "application/octet-stream",
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const { data: updated } = await supabase
      .from("backup_jobs")
      .update({
        status: "completed",
        file_path: path,
        file_size: packed.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select()
      .single();

    await pruneOldBackups(organizationId);
    return mapJob((updated ?? job) as Record<string, unknown>);
  } catch (err) {
    logger.error({ err, organizationId }, "Backup failed");
    await supabase
      .from("backup_jobs")
      .update({ status: "failed", error_text: err instanceof Error ? err.message : "Backup failed" })
      .eq("id", job.id);
    throw new HttpError(500, "Backup failed.", "BACKUP_FAILED");
  }
}

export async function listBackups(organizationId: string): Promise<BackupJob[]> {
  const { data, error } = await getSupabase()
    .from("backup_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new HttpError(500, "Failed to list backups.", "BACKUP_LIST_FAILED");
  return (data ?? []).map((row) => mapJob(row as Record<string, unknown>));
}

export async function getBackupStatus(organizationId: string): Promise<{ latest: BackupJob | null; count: number }> {
  const items = await listBackups(organizationId);
  return { latest: items[0] ?? null, count: items.length };
}

export async function restoreBackup(
  organizationId: string,
  backupId: string,
): Promise<{ restored: string[]; counts: Record<string, number> }> {
  const supabase = getSupabase();
  const { data: job, error } = await supabase
    .from("backup_jobs")
    .select("*")
    .eq("id", backupId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !job?.file_path) throw new HttpError(404, "Backup not found.", "NOT_FOUND");

  const { data: file, error: downloadError } = await supabase.storage.from("backups").download(String(job.file_path));
  if (downloadError || !file) throw new HttpError(500, "Could not download backup.", "BACKUP_DOWNLOAD_FAILED");

  const buffer = decryptBackupBuffer(Buffer.from(await file.arrayBuffer()));
  const snapshot = JSON.parse(buffer.toString("utf8")) as Record<string, unknown>;
  if (snapshot.organization_id && String(snapshot.organization_id) !== organizationId) {
    throw new HttpError(403, "Backup belongs to another organization.", "BACKUP_ORG_MISMATCH");
  }

  const restored: string[] = [];
  const counts: Record<string, number> = {};
  for (const table of ["organization_settings", "conversation_rules"] as const) {
    const rows = Array.isArray(snapshot[table]) ? snapshot[table] : [];
    if (!rows.length) continue;
    const { error: upsertError } = await supabase.from(table).upsert(rows);
    if (upsertError) {
      logger.warn({ upsertError, table }, "Restore table skipped");
      continue;
    }
    restored.push(table);
    counts[table] = rows.length;
  }
  return { restored, counts };
}

async function pruneOldBackups(organizationId: string): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await getSupabase()
    .from("backup_jobs")
    .select("id, file_path")
    .eq("organization_id", organizationId)
    .lt("created_at", cutoff);
  for (const row of data ?? []) {
    if (row.file_path) {
      await getSupabase().storage.from("backups").remove([String(row.file_path)]);
    }
    await getSupabase().from("backup_jobs").delete().eq("id", row.id);
  }
}

export async function runScheduledBackups(now = new Date()): Promise<number> {
  if (now.getHours() !== 3) return 0;
  const type = now.getDate() === 1 ? "monthly" : now.getDay() === 0 ? "weekly" : "daily";
  const { data, error } = await getSupabase().from("organizations").select("id");
  if (error) return 0;
  let count = 0;
  for (const org of data ?? []) {
    try {
      await runOrganizationBackup(String(org.id), type);
      count += 1;
    } catch (err) {
      logger.warn({ err, org: org.id }, "Scheduled backup failed");
    }
  }
  return count;
}
