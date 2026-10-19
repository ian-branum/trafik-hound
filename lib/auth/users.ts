import { createId } from "@paralleldrive/cuid2";
import getDriver from "@/lib/neo4j";
import type { AppUser, AuthProvider, UserRole } from "./types";

const USER_PROPS = `
  u.id AS id,
  u.email AS email,
  u.name AS name,
  u.image AS image,
  u.role AS role,
  u.enabled AS enabled,
  u.provider AS provider,
  u.providerAccountId AS providerAccountId,
  u.emailVerified AS emailVerified,
  u.createdAt AS createdAt,
  u.lastLoginAt AS lastLoginAt
`;

function toAppUser(props: Record<string, unknown>): AppUser {
  return {
    id: String(props.id),
    email: String(props.email),
    name: (props.name as string | null) ?? null,
    image: (props.image as string | null) ?? null,
    role: (props.role as UserRole | undefined) ?? "user",
    enabled: props.enabled !== false,
    provider: (props.provider as AuthProvider | undefined) ?? "google",
    providerAccountId: (props.providerAccountId as string | null) ?? null,
    emailVerified: (props.emailVerified as string | null) ?? null,
    createdAt: String(props.createdAt ?? new Date(0).toISOString()),
    lastLoginAt: (props.lastLoginAt as string | null) ?? null,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User:_System {email: $email}) RETURN ${USER_PROPS} LIMIT 1`,
      { email: normalizeEmail(email) }
    );
    if (result.records.length === 0) return null;
    return toAppUser(result.records[0].toObject());
  } finally {
    await session.close();
  }
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User:_System {id: $id}) RETURN ${USER_PROPS} LIMIT 1`,
      { id }
    );
    if (result.records.length === 0) return null;
    return toAppUser(result.records[0].toObject());
  } finally {
    await session.close();
  }
}

export async function listUsers(): Promise<AppUser[]> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User:_System) RETURN ${USER_PROPS} ORDER BY u.createdAt DESC`
    );
    return result.records.map((r) => toAppUser(r.toObject()));
  } finally {
    await session.close();
  }
}

export interface UpsertUserInput {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: AuthProvider;
  providerAccountId?: string | null;
  passwordHash?: string | null;
}

export interface UpsertUserResult {
  user: AppUser;
  created: boolean;
}

/**
 * Find a user by email, creating them if they don't exist yet.
 *
 * The first user ever created becomes an enabled admin so the instance can be
 * bootstrapped without manual DB edits; every subsequent user starts disabled
 * and must be approved at /admin/users.
 *
 * Concurrent first sign-ins are serialized by taking a write lock on the
 * singleton `:AuthMeta` node at the start of the transaction.
 */
export async function findOrCreateUser(input: UpsertUserInput): Promise<UpsertUserResult> {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const driver = getDriver();
  const session = driver.session();

  try {
    return await session.executeWrite(async (tx) => {
      // Serializes user creation so two first-time sign-ins can't both become admin.
      await tx.run(
        `MERGE (m:AuthMeta:_System {id: 'singleton'})
         SET m.rev = coalesce(m.rev, 0) + 1`
      );

      const existing = await tx.run(
        `MATCH (u:User:_System {email: $email}) RETURN ${USER_PROPS} LIMIT 1`,
        { email }
      );

      if (existing.records.length > 0) {
        const current = toAppUser(existing.records[0].toObject());
        const updated = await tx.run(
          `MATCH (u:User:_System {id: $id})
           SET u.lastLoginAt = $now,
               u.name  = coalesce($name, u.name),
               u.image = coalesce($image, u.image),
               u.provider = $provider,
               u.providerAccountId = coalesce($providerAccountId, u.providerAccountId)
           RETURN ${USER_PROPS}`,
          {
            id: current.id,
            now,
            name: input.name ?? null,
            image: input.image ?? null,
            provider: input.provider,
            providerAccountId: input.providerAccountId ?? null,
          }
        );
        return { user: toAppUser(updated.records[0].toObject()), created: false };
      }

      const countResult = await tx.run(`MATCH (u:User:_System) RETURN count(u) AS total`);
      const total = countResult.records[0].get("total");
      const userCount = typeof total?.toNumber === "function" ? total.toNumber() : Number(total);
      const isFirstUser = userCount === 0;

      const created = await tx.run(
        `CREATE (u:User:_System {
           id: $id,
           email: $email,
           name: $name,
           image: $image,
           role: $role,
           enabled: $enabled,
           provider: $provider,
           providerAccountId: $providerAccountId,
           emailVerified: $emailVerified,
           passwordHash: $passwordHash,
           createdAt: $now,
           lastLoginAt: $now
         })
         RETURN ${USER_PROPS}`,
        {
          id: createId(),
          email,
          name: input.name ?? null,
          image: input.image ?? null,
          role: isFirstUser ? "admin" : "user",
          enabled: isFirstUser,
          provider: input.provider,
          providerAccountId: input.providerAccountId ?? null,
          emailVerified: now,
          passwordHash: input.passwordHash ?? null,
          now,
        }
      );

      return { user: toAppUser(created.records[0].toObject()), created: true };
    });
  } finally {
    await session.close();
  }
}

export interface UpdateUserInput {
  enabled?: boolean;
  role?: UserRole;
  name?: string | null;
  image?: string | null;
  provider?: AuthProvider;
  providerAccountId?: string | null;
  emailVerified?: string | null;
}

export async function updateUser(id: string, patch: UpdateUserInput): Promise<AppUser | null> {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };

  if (patch.enabled !== undefined) {
    sets.push("u.enabled = $enabled");
    params.enabled = patch.enabled;
  }
  if (patch.role !== undefined) {
    sets.push("u.role = $role");
    params.role = patch.role;
  }
  if (patch.name !== undefined) {
    sets.push("u.name = $name");
    params.name = patch.name;
  }
  if (patch.image !== undefined) {
    sets.push("u.image = $image");
    params.image = patch.image;
  }
  if (patch.provider !== undefined) {
    sets.push("u.provider = $provider");
    params.provider = patch.provider;
  }
  if (patch.providerAccountId !== undefined) {
    sets.push("u.providerAccountId = $providerAccountId");
    params.providerAccountId = patch.providerAccountId;
  }
  if (patch.emailVerified !== undefined) {
    sets.push("u.emailVerified = $emailVerified");
    params.emailVerified = patch.emailVerified;
  }

  if (sets.length === 0) return getUserById(id);

  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User:_System {id: $id})
       SET ${sets.join(", ")}
       RETURN ${USER_PROPS}`,
      params
    );
    if (result.records.length === 0) return null;
    return toAppUser(result.records[0].toObject());
  } finally {
    await session.close();
  }
}

/** Look up a user by the OAuth account they signed in with. */
export async function findUserByAccount(
  provider: string,
  providerAccountId: string
): Promise<AppUser | null> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User:_System {provider: $provider, providerAccountId: $providerAccountId})
       RETURN ${USER_PROPS} LIMIT 1`,
      { provider, providerAccountId }
    );
    if (result.records.length === 0) return null;
    return toAppUser(result.records[0].toObject());
  } finally {
    await session.close();
  }
}

/** Credentials lookup: returns the user plus their password hash (never sent to clients). */
export async function findUserForCredentials(
  email: string
): Promise<{ user: AppUser; passwordHash: string | null } | null> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User:_System {email: $email})
       RETURN ${USER_PROPS}, u.passwordHash AS passwordHash
       LIMIT 1`,
      { email: normalizeEmail(email) }
    );
    if (result.records.length === 0) return null;
    const props = result.records[0].toObject();
    return {
      user: toAppUser(props),
      passwordHash: (props.passwordHash as string | null) ?? null,
    };
  } finally {
    await session.close();
  }
}

/**
 * Create an email+password account. Returns `null` when the email is already
 * taken. Applies the same first-user bootstrap as OAuth sign-ups.
 */
export async function createPasswordUser(input: {
  email: string;
  passwordHash: string;
  name?: string | null;
}): Promise<AppUser | null> {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const driver = getDriver();
  const session = driver.session();

  try {
    return await session.executeWrite(async (tx) => {
      await tx.run(
        `MERGE (m:AuthMeta:_System {id: 'singleton'})
         SET m.rev = coalesce(m.rev, 0) + 1`
      );

      const existing = await tx.run(
        `MATCH (u:User:_System {email: $email}) RETURN u.id AS id LIMIT 1`,
        { email }
      );
      if (existing.records.length > 0) return null;

      const countResult = await tx.run(`MATCH (u:User:_System) RETURN count(u) AS total`);
      const total = countResult.records[0].get("total");
      const userCount = typeof total?.toNumber === "function" ? total.toNumber() : Number(total);
      const isFirstUser = userCount === 0;

      const created = await tx.run(
        `CREATE (u:User:_System {
           id: $id,
           email: $email,
           name: $name,
           image: null,
           role: $role,
           enabled: $enabled,
           provider: 'credentials',
           providerAccountId: null,
           emailVerified: $now,
           passwordHash: $passwordHash,
           createdAt: $now,
           lastLoginAt: null
         })
         RETURN ${USER_PROPS}`,
        {
          id: createId(),
          email,
          name: input.name ?? email.split("@")[0],
          role: isFirstUser ? "admin" : "user",
          enabled: isFirstUser,
          passwordHash: input.passwordHash,
          now,
        }
      );

      return toAppUser(created.records[0].toObject());
    });
  } finally {
    await session.close();
  }
}
