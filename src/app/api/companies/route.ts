import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requireUser();
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { posts: true, campaigns: true, accounts: true, plans: true, reels: true } },
      },
    });
    return NextResponse.json({ companies });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<Record<string, string>>(req);
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }
    const company = await prisma.company.create({
      data: {
        name: body.name.trim(),
        industry: body.industry || "",
        description: body.description || "",
        targetAudience: body.targetAudience || "",
        toneOfVoice: body.toneOfVoice || "professional",
        language: body.language || "both",
        primaryColor: body.primaryColor || "#6d28d9",
        secondaryColor: body.secondaryColor || "#0f172a",
        logoPath: body.logoPath || "",
        website: body.website || "",
        city: body.city || "",
      },
    });
    return NextResponse.json({ company });
  } catch (e) {
    return errorResponse(e);
  }
}
