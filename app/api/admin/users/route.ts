import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { listUsers, updateUser } from "@/lib/auth/users";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized", status: 401 } as const;
  if (session.user.role !== "admin") return { error: "Forbidden", status: 403 } as const;
  return { session } as const;
}

export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const users = await listUsers();
  return NextResponse.json({ users });
}

const patchSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().optional(),
  role: z.enum(["admin", "user"]).optional(),
});

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id, enabled, role } = parsed.data;

  if (id === guard.session.user.userId && enabled === false) {
    return NextResponse.json({ error: "You cannot disable your own account." }, { status: 400 });
  }

  if (enabled === undefined && role === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await updateUser(id, { enabled, role });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}
