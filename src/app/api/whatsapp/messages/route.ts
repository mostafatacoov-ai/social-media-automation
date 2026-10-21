import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const contactId = new URL(req.url).searchParams.get("contactId");
    if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });
    const messages = await prisma.whatsAppMessage.findMany({
      where: { contactId },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return NextResponse.json({ messages });
  } catch (e) {
    return errorResponse(e);
  }
}
