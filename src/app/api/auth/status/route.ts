import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const users = await prisma.user.count();
  return NextResponse.json({ needsSetup: users === 0 });
}
