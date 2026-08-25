import { useLanguage } from "../contexts/LanguageContext";
import { useStoreFilter } from "../contexts/StoreContext";
import { Select } from "./ui/select";

export function StoreSelector() {
  const { t } = useLanguage();
  const { stores, selectedStoreId, setSelectedStoreId, profile } = useStoreFilter();
  if (!profile?.permissions.storeSwitcher) return null;

  return (
    <Select
      aria-label={t("nav.stores")}
      className="h-9 w-[160px] px-2 text-xs"
      value={selectedStoreId}
      onChange={(event) => setSelectedStoreId(event.target.value)}
    >
      <option value="all">{t("stores.allStores")}</option>
      {stores.map((store) => (
        <option key={store.id} value={store.id}>
          {store.name}
        </option>
      ))}
    </Select>
  );
}
