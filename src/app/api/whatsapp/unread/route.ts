import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, getActiveCompanyId, requireUser } from "@/lib/api-helpers";

// Total unread count for the sidebar badge.
export async function GET() {
  try {
    await requireUser();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json({ unread: 0 });
    const agg = await prisma.whatsAppContact.aggregate({
      where: { companyId },
      _sum: { unreadCount: true },
    });
    return NextResponse.json({ unread: agg._sum.unreadCount || 0 });
  } catch (e) {
    return errorResponse(e);
  }
}
