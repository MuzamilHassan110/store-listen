import type { User } from "@supabase/supabase-js";
import type { OrgRole } from "../lib/rbac.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        organizationId: string;
        email?: string;
        role: OrgRole;
        storeIds: string[];
        salesmanId: string | null;
      };
      user?: User;
    }
  }
}

export {};
