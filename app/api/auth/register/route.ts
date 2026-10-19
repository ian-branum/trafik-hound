import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createPasswordUser, findUserByEmail, normalizeEmail } from "@/lib/auth/users";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { email?: unknown; password?: unknown; name?: unknown }
      | null;

    const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (password.length > 200) {
      return NextResponse.json({ error: "Password is too long." }, { status: 400 });
    }
    if (name && name.length > 80) {
      return NextResponse.json({ error: "Name is too long." }, { status: 400 });
    }

    // Fast path for a friendly error; the DB write below is still authoritative.
    if (await findUserByEmail(email)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createPasswordUser({
      email,
      passwordHash,
      name: name || null,
    });

    if (!user) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        // A new account starts disabled unless it's the very first one.
        enabled: user.enabled,
        role: user.role,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/auth/register]", msg);

    // Neo4j uniqueness constraint (race between two registrations).
    if (/constraint|already exists/i.test(msg)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Something went wrong creating your account." },
      { status: 500 }
    );
  }
}
