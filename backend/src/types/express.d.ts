import type { User } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        organizationId: string;
        email?: string;
      };
      user?: User;
    }
  }
}

export {};
