import { cn } from "../../lib/cn";

export function scoreTone(value?: number | null): string {
  if (value == null) return "bg-slate-700";
  if (value >= 80) return "bg-emerald-500";
  if (value >= 60) return "bg-amber-400";
  return "bg-red-500";
}

export function ScoreBar({
  label,
  icon,
  value,
}: {
  label: string;
  icon: string;
  value?: number | null;
}) {
  const width = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>
          {icon} {label}
        </span>
        <span className="text-slate-400">{value == null ? "—" : Math.round(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={cn("h-full rounded-full transition-all", scoreTone(value))} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
