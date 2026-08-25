import { useState } from "react";
import { saveAs } from "file-saver";
import { Button } from "./ui/button";
import type { ExportFile } from "../types/conversation";

export function downloadExport(file: ExportFile, excel = false): void {
  const blob = new Blob([`\uFEFF${file.csv}`], {
    type: excel ? "application/vnd.ms-excel;charset=utf-8" : "text/csv;charset=utf-8",
  });
  const name = excel ? file.filename.replace(/\.csv$/i, ".xls") : file.filename;
  saveAs(blob, name);
}

export function ExportMenu({
  onExport,
  disabled,
}: {
  onExport: () => Promise<ExportFile>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function run(excel: boolean): Promise<void> {
    setLoading(true);
    setMessage("");
    try {
      const file = await onExport();
      downloadExport(file, excel);
      setMessage("Download started.");
      setOpen(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" disabled={disabled || loading} onClick={() => setOpen((value) => !value)}>
        {loading ? "Exporting…" : "Export"}
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-slate-800 bg-slate-950 p-2">
          <button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-900" onClick={() => void run(false)}>
            CSV
          </button>
          <button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-900" onClick={() => void run(true)}>
            Excel
          </button>
        </div>
      ) : null}
      {message ? <p className="mt-1 text-xs text-emerald-300">{message}</p> : null}
    </div>
  );
}
