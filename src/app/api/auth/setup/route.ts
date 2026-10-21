import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";
import { errorResponse, parseJsonBody } from "@/lib/api-helpers";

// First-run setup: creates the admin account. Only works when no user exists.
export async function POST(req: NextRequest) {
  try {
    const existing = await prisma.user.count();
    if (existing > 0) {
      return NextResponse.json(
        { error: "Setup already completed. Please log in." },
        { status: 400 }
      );
    }
    const body = await parseJsonBody<{ name: string; email: string; password: string }>(req);
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password || "";
    if (!name || !email || !email.includes("@")) {
      return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });
    const token = await createSessionToken(user.id, user.email);
    await setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
