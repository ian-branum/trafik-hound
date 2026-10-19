/**
 * NextAuth v5 (Auth.js) configuration.
 *
 * Required environment variables (set in .env.local / Vercel — never commit them):
 *   NEXTAUTH_SECRET=      # openssl rand -base64 32   (AUTH_SECRET also accepted)
 *   NEXTAUTH_URL=         # https://your-domain.com   (AUTH_URL also accepted)
 *   GOOGLE_ID=            # Google OAuth client ID
 *   GOOGLE_SECRET=        # Google OAuth client secret
 *
 * Neo4j connection vars (NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD) come from
 * lib/neo4j.ts. Sessions are JWT-only; user records live in Neo4j and are
 * managed by lib/auth/users.ts.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { Neo4jAuthAdapter } from "@/lib/auth/adapter";
import {
  findOrCreateUser,
  findUserByEmail,
  findUserForCredentials,
} from "@/lib/auth/users";
import type { AuthProvider } from "@/lib/auth/types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: Neo4jAuthAdapter,
  providers: [
    Google({
      clientId: process.env.GOOGLE_ID ?? "",
      clientSecret: process.env.GOOGLE_SECRET ?? "",
      // Accounts are keyed by email; trust Google's verified address so a
      // user who previously signed in another way keeps the same account.
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const found = await findUserForCredentials(email);
        // No account, or an OAuth-only account without a password.
        if (!found?.passwordHash) return null;

        const valid = await bcrypt.compare(password, found.passwordHash);
        if (!valid) return null;

        return {
          id: found.user.id,
          email: found.user.email,
          name: found.user.name,
          image: found.user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    async jwt({ token, user, account }) {
      // Initial sign-in: resolve the Neo4j user and copy our fields into the JWT.
      if (user?.email) {
        const provider: AuthProvider =
          account?.provider === "credentials" ? "credentials" : "google";
        const { user: dbUser } = await findOrCreateUser({
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
          provider,
          providerAccountId:
            provider === "credentials" ? null : (account?.providerAccountId ?? null),
        });

        token.userId = dbUser.id;
        token.role = dbUser.role;
        token.enabled = dbUser.enabled;
        token.provider = dbUser.provider;
        token.email = dbUser.email;
        token.name = dbUser.name;
        token.picture = dbUser.image;
        return token;
      }

      // Subsequent requests: refresh role/enabled so admin changes take effect
      // without forcing the user to sign in again. Falls back to the token's
      // existing values if the DB is unavailable.
      if (token.userId && token.email) {
        try {
          const dbUser = await findUserByEmail(token.email);
          if (dbUser) {
            token.userId = dbUser.id;
            token.role = dbUser.role;
            token.enabled = dbUser.enabled;
            token.provider = dbUser.provider;
          }
        } catch (error) {
          console.error("[auth] Failed to refresh user from Neo4j:", error);
        }
      }

      return token;
    },
  },
});
