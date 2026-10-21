import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTextProvider } from "@/lib/ai";
import { marketingPlanPrompts } from "@/lib/ai/prompts";
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
    const platformLabels = selected.map((p) => PLATFORMS.find((x) => x.id === p)?.label || p);
    const weeks = Math.min(12, Math.max(1, body.weeks || 4));

    const provider = await getTextProvider();
    const { system, user } = marketingPlanPrompts({
      company: {
        name: company.name,
        industry: company.industry,
        description: company.description,
        targetAudience: company.targetAudience,
        toneOfVoice: company.toneOfVoice,
        city: company.city,
        website: company.website,
      },
      campaign: campaign
        ? { name: campaign.name, objective: campaign.objective, description: campaign.description, targetAudience: campaign.targetAudience }
        : undefined,
      platforms: platformLabels,
      weeks,
      language: body.language || company.language || "en",
      goals: body.goals,
      budget: body.budget || campaign?.budget || undefined,
    });

    const planData = await provider.generateJSON<Record<string, unknown>>(system, user, {
      maxTokens: 8000,
      temperature: 0.6,
    });

    const plan = await prisma.marketingPlan.create({
      data: {
        companyId,
        campaignId: campaign?.id || null,
        title: body.title?.trim() || `${campaign?.name || company.name} — ${weeks}-week plan`,
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
