export type UserRole = "admin" | "user";

export type AuthProvider = "google" | "credentials";

/**
 * A user as stored in Neo4j (`:User` node).
 * Dates are stored as ISO-8601 strings, matching the convention used by the
 * graph data in `lib/graph`.
 */
export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  enabled: boolean;
  provider: AuthProvider;
  providerAccountId: string | null;
  emailVerified: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}
