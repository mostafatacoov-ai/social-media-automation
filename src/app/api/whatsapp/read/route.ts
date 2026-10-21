import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";

// Marks a conversation as read (clears the unread badge).
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const { contactId } = await parseJsonBody<{ contactId: string }>(req);
    await prisma.whatsAppContact.update({
      where: { id: contactId },
      data: { unreadCount: 0 },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
