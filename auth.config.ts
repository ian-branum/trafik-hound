import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/lib/auth/types";

/**
 * Edge-safe portion of the Auth.js config, used by `middleware.ts`.
 *
 * It intentionally has no providers, no adapter and no Neo4j imports: the
 * middleware only needs to decode the JWT and shape the session. The full
 * config (providers, adapter, DB-backed callbacks) lives in `auth.ts`.
 */
export const authConfig = {
  providers: [],
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.userId = String(token.userId ?? token.sub ?? "");
        session.user.role = (token.role as UserRole | undefined) ?? "user";
        session.user.enabled = token.enabled !== false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
