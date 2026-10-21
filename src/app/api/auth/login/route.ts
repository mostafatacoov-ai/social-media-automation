import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { errorResponse, parseJsonBody } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody<{ email: string; password: string }>(req);
    const email = body.email?.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(body.password || "", user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    const token = await createSessionToken(user.id, user.email);
    await setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
