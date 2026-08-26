import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "./ui/button";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 px-6 py-16 text-center">
      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-slate-900 text-2xl" aria-hidden>
        🗂️
      </div>
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{hint}</p>
      {action ? (
        <Button className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-6 py-10 text-center">
      <h3 className="text-lg font-semibold text-red-200">{t("errors.loadFailed")}</h3>
      <p className="mt-2 text-sm text-red-200/80">{message}</p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}
