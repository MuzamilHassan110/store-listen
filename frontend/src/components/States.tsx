import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "./ui/button";

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 px-6 py-16 text-center">
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{hint}</p>
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
