export type OrgRole = "owner" | "admin" | "manager" | "salesman";

export interface StoreStats {
  total_conversations: number;
  active_salesmen: number;
  online_devices: number;
  average_score: number;
  total_recording_time?: number;
  today_conversations?: number;
}

export interface Store {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  manager_id?: string | null;
  is_active: boolean;
  opening_time?: string | null;
  closing_time?: string | null;
  timezone?: string | null;
  stats?: StoreStats;
}

export interface Device {
  id: string;
  store_id?: string | null;
  device_name: string;
  device_id: string;
  app_version?: string | null;
  os_version?: string | null;
  is_online: boolean;
  last_sync_at?: string | null;
  storage_used_bytes: number;
}

export interface ActivityLog {
  id: string;
  activity_type: string;
  description: string | null;
  metadata?: Record<string, unknown>;
  store_id?: string | null;
  created_at: string;
}

export interface StoreComparisonRow {
  id: string;
  name: string;
  city?: string | null;
  total_conversations: number;
  average_score: number;
  average_duration: number;
  high_intent: number;
  online_devices: number;
}

export interface SessionProfile {
  userId: string;
  organizationId: string;
  email?: string;
  role: OrgRole;
  storeIds: string[];
  salesmanId: string | null;
  permissions: {
    allStores: boolean;
    manageStores: boolean;
    manageSalesmen: boolean;
    storeSwitcher: boolean;
  };
}

export interface StoreOverview {
  store: Store;
  today_conversations: number;
  active_salesmen: Array<{ id: string; name?: string | null }>;
  devices: Device[];
  recent_conversations: Array<Record<string, unknown>>;
  performance: {
    average_score: number;
    total_conversations: number;
    total_recording_time: number;
  };
}
