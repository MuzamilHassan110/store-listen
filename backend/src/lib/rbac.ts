export const ORG_ROLES = ["owner", "admin", "manager", "salesman"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

const RANK: Record<OrgRole, number> = {
  owner: 40,
  admin: 30,
  manager: 20,
  salesman: 10,
};

export function normalizeRole(value: string | null | undefined): OrgRole {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "owner") return "owner";
  if (raw === "admin") return "admin";
  if (raw === "manager") return "manager";
  if (raw === "salesman") return "salesman";
  return "admin";
}

export function roleRank(role: OrgRole): number {
  return RANK[role];
}

export function hasMinimumRole(role: OrgRole, minimum: OrgRole): boolean {
  return roleRank(role) >= roleRank(minimum);
}

export function canAccessAllStores(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}

export function canManageStores(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}

export function canManageSalesmen(role: OrgRole): boolean {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canViewStoreSwitcher(role: OrgRole): boolean {
  return role !== "salesman";
}

export function assertStoreAccess(input: {
  role: OrgRole;
  storeIds: string[];
  storeId: string | null | undefined;
}): boolean {
  if (!input.storeId) return canAccessAllStores(input.role);
  if (canAccessAllStores(input.role)) return true;
  return input.storeIds.includes(input.storeId);
}
