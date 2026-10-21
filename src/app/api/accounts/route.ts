import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requireUser();
    const accounts = await prisma.socialAccount.findMany({
      orderBy: { createdAt: "desc" },
      include: { company: { select: { name: true } } },
    });
    return NextResponse.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        companyId: a.companyId,
        companyName: a.company.name,
        platform: a.platform,
        accountName: a.accountName,
        status: a.status,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
