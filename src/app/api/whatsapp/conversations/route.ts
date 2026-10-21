import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, getActiveCompanyId, requireUser } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const companyId =
      new URL(req.url).searchParams.get("companyId") || (await getActiveCompanyId());
    if (!companyId) return NextResponse.json({ conversations: [] });

    const contacts = await prisma.whatsAppContact.findMany({
      where: { companyId },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    return NextResponse.json({
      conversations: contacts.map((c) => {
        const last = c.messages[0];
        const windowOpen =
          c.lastInboundAt && Date.now() - new Date(c.lastInboundAt).getTime() < 24 * 3600 * 1000;
        return {
          id: c.id,
          waId: c.waId,
          name: c.name || c.waId,
          unread: c.unreadCount,
          lastMessage: last ? { body: last.body, direction: last.direction, at: last.createdAt } : null,
          windowOpen: Boolean(windowOpen),
          lastInboundAt: c.lastInboundAt,
        };
      }),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
