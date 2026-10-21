import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, getActiveCompanyId, parseJsonBody, requireUser } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const url = new URL(req.url);
    let companyId = url.searchParams.get("companyId") || (await getActiveCompanyId());
    if (companyId === "all") companyId = undefined;
    const campaigns = await prisma.campaign.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: "desc" },
      include: { company: { select: { name: true } }, _count: { select: { posts: true, plans: true, reels: true } } },
    });
    return NextResponse.json({ campaigns });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<Record<string, string>>(req);
    const companyId = body.companyId || (await getActiveCompanyId());
    if (!companyId) {
      return NextResponse.json({ error: "Create a company first." }, { status: 400 });
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
    }
    const campaign = await prisma.campaign.create({
      data: {
        companyId,
        name: body.name.trim(),
        objective: body.objective || "awareness",
        description: body.description || "",
        targetAudience: body.targetAudience || "",
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        budget: body.budget || "",
        status: body.status || "active",
      },
    });
    return NextResponse.json({ campaign });
  } catch (e) {
    return errorResponse(e);
  }
}
