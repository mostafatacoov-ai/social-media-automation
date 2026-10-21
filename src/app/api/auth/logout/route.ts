import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { errorResponse } from "@/lib/api-helpers";

export async function POST() {
  try {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
