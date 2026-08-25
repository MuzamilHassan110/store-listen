import { Select } from "./ui/select";
import { useLanguage, type UiLanguage } from "../contexts/LanguageContext";

const OPTIONS: Array<{ value: UiLanguage; label: string }> = [
  { value: "en", label: "🇬🇧 EN" },
  { value: "ur", label: "🇵🇰 UR" },
  { value: "ar", label: "🇸🇦 AR" },
];

export function LanguageSelector({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <Select
      aria-label={t("common.language")}
      className={className ?? "h-9 w-[96px] px-2 text-xs"}
      value={language}
      onChange={(event) => setLanguage(event.target.value as UiLanguage)}
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
