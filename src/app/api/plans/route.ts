import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tracked } from "@/lib/agents/runner";
import { generatePlan } from "@/lib/agents/tasks";
import { errorResponse, getActiveCompanyId, parseJsonBody, requireUser } from "@/lib/api-helpers";
import { PLATFORMS } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const url = new URL(req.url);
    let companyId = url.searchParams.get("companyId") || (await getActiveCompanyId());
    if (companyId === "all") companyId = undefined;
    const plans = await prisma.marketingPlan.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: "desc" },
      include: { company: { select: { name: true } }, campaign: { select: { name: true } } },
    });
    return NextResponse.json({ plans });
  } catch (e) {
    return errorResponse(e);
  }
}

// Generate a full marketing plan with AI.
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<{
      companyId?: string;
      campaignId?: string;
      platforms?: string[];
      weeks?: number;
      language?: string;
      goals?: string;
      budget?: string;
      title?: string;
    }>(req);

    const companyId = body.companyId || (await getActiveCompanyId());
    if (!companyId) return NextResponse.json({ error: "Create a company first." }, { status: 400 });
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    const campaign = body.campaignId
      ? await prisma.campaign.findUnique({ where: { id: body.campaignId } })
      : null;

    const validPlatforms = PLATFORMS.map((p) => p.id);
    const selected = (body.platforms || ["meta_instagram", "meta_facebook", "linkedin", "x"]).filter(
      (p) => validPlatforms.includes(p)
    );
    const weeks = Math.min(12, Math.max(1, body.weeks || 4));

    const { planData, title } = await tracked(
      "strategist",
      "Generate marketing plan",
      { companyId, input: { campaign: campaign?.name, weeks, platforms: selected } },
      async (log) => {
        log("Reading the company profile and campaign brief…");
        const result = await generatePlan({
          company,
          campaign,
          platforms: selected,
          weeks,
          language: body.language || company.language || "en",
          goals: body.goals,
          budget: body.budget,
        });
        log("Structure ready: pillars, personas and calendar");
        return result;
      }
    );

    const plan = await prisma.marketingPlan.create({
      data: {
        companyId,
        campaignId: campaign?.id || null,
        title: body.title?.trim() || title,
        durationWeeks: weeks,
        platforms: JSON.stringify(selected),
        planData: JSON.stringify(planData),
        language: body.language || company.language || "en",
        status: "ready",
      },
    });
    return NextResponse.json({ plan });
  } catch (e) {
    return errorResponse(e);
  }
}
