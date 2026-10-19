import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { AppUser } from "./types";
import {
  findOrCreateUser,
  findUserByAccount,
  findUserByEmail,
  getUserById,
  normalizeEmail,
  updateUser,
} from "./users";

/**
 * Minimal Auth.js adapter backed by Neo4j.
 *
 * We deliberately don't use `@auth/neo4j-adapter`: sessions are JWT-only and
 * user records are managed by us. Auth.js still calls a handful of adapter
 * methods during the OAuth callback (account lookup, user creation, linking),
 * so those are implemented here.
 */
function toAdapterUser(user: AppUser): AdapterUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
  };
}

interface CreateUserInput {
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: Date | null;
}

interface UpdateAdapterUserInput {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  emailVerified?: Date | null;
}

export const Neo4jAuthAdapter = {
  async createUser(data: CreateUserInput): Promise<AdapterUser> {
    const { user } = await findOrCreateUser({
      email: data.email,
      name: data.name ?? null,
      image: data.image ?? null,
      provider: "google",
    });
    return toAdapterUser(user);
  },

  async getUser(id: string): Promise<AdapterUser | null> {
    const user = await getUserById(id);
    return user ? toAdapterUser(user) : null;
  },

  async getUserByEmail(email: string): Promise<AdapterUser | null> {
    const user = await findUserByEmail(normalizeEmail(email));
    return user ? toAdapterUser(user) : null;
  },

  async getUserByAccount({
    provider,
    providerAccountId,
  }: {
    provider: string;
    providerAccountId: string;
  }): Promise<AdapterUser | null> {
    const user = await findUserByAccount(provider, providerAccountId);
    return user ? toAdapterUser(user) : null;
  },

  async updateUser(data: UpdateAdapterUserInput): Promise<AdapterUser> {
    const updated = await updateUser(data.id, {
      name: data.name,
      image: data.image,
      emailVerified:
        data.emailVerified === undefined
          ? undefined
          : data.emailVerified === null
            ? null
            : data.emailVerified.toISOString(),
    });
    if (!updated) throw new Error(`User not found: ${data.id}`);
    return toAdapterUser(updated);
  },

  async linkAccount(account: {
    userId: string;
    provider: string;
    providerAccountId: string;
  }): Promise<void> {
    await updateUser(account.userId, {
      provider: "google",
      providerAccountId: account.providerAccountId,
    });
  },
} as unknown as Adapter;
