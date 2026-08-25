import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchSessionProfile, fetchStores } from "../services/api";
import type { OrgRole, SessionProfile, Store } from "../types/store";

const STORAGE_KEY = "storelisten_store_id";

type StoreContextValue = {
  stores: Store[];
  selectedStoreId: string;
  setSelectedStoreId: (id: string) => void;
  selectedStore: Store | null;
  role: OrgRole;
  profile: SessionProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreIdState] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "all");
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh(): Promise<void> {
    try {
      const [session, listed] = await Promise.all([fetchSessionProfile(), fetchStores()]);
      setProfile(session);
      setStores(listed.stores);
      if (selectedStoreId !== "all" && !listed.stores.some((store) => store.id === selectedStoreId)) {
        setSelectedStoreIdState("all");
        localStorage.setItem(STORAGE_KEY, "all");
      }
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      stores,
      selectedStoreId,
      setSelectedStoreId: (id: string) => {
        setSelectedStoreIdState(id);
        localStorage.setItem(STORAGE_KEY, id);
      },
      selectedStore: stores.find((store) => store.id === selectedStoreId) ?? null,
      role: profile?.role ?? "admin",
      profile,
      loading,
      refresh,
    }),
    [loading, profile, selectedStoreId, stores],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStoreFilter(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStoreFilter must be used within StoreProvider");
  return context;
}
