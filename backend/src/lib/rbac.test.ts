import { describe, expect, it } from "vitest";
import {
  assertStoreAccess,
  canAccessAllStores,
  canManageStores,
  hasMinimumRole,
  normalizeRole,
} from "./rbac.js";

describe("normalizeRole", () => {
  it("maps known roles and treats legacy member as admin", () => {
    expect(normalizeRole("OWNER")).toBe("owner");
    expect(normalizeRole("manager")).toBe("manager");
    expect(normalizeRole("member")).toBe("admin");
    expect(normalizeRole(null)).toBe("admin");
  });
});

describe("role access", () => {
  it("lets owners and admins see every store", () => {
    expect(canAccessAllStores("owner")).toBe(true);
    expect(canAccessAllStores("admin")).toBe(true);
    expect(canAccessAllStores("manager")).toBe(false);
    expect(canManageStores("salesman")).toBe(false);
  });

  it("checks assigned store ids for managers", () => {
    expect(assertStoreAccess({ role: "manager", storeIds: ["a"], storeId: "a" })).toBe(true);
    expect(assertStoreAccess({ role: "manager", storeIds: ["a"], storeId: "b" })).toBe(false);
    expect(assertStoreAccess({ role: "owner", storeIds: [], storeId: "b" })).toBe(true);
  });

  it("respects the role hierarchy", () => {
    expect(hasMinimumRole("admin", "manager")).toBe(true);
    expect(hasMinimumRole("salesman", "manager")).toBe(false);
    expect(hasMinimumRole("owner", "admin")).toBe(true);
  });
});
