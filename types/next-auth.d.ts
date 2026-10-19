import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/auth/types";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      role: UserRole;
      enabled: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: UserRole;
    enabled?: boolean;
    provider?: string;
  }
}
