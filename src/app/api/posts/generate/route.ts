import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTextProvider } from "@/lib/ai";
import { captionPrompts, CaptionVariant } from "@/lib/ai/prompts";
import { errorResponse, getActiveCompanyId, parseJsonBody, requireUser } from "@/lib/api-helpers";

// AI caption generation.
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<{
      companyId?: string;
      campaignId?: string;
      platform: string;
      contentType?: string;
      topic?: string;
      language?: string;
      count?: number;
      extraContext?: string;
    }>(req);

    const companyId = body.companyId || (await getActiveCompanyId());
    if (!companyId) return NextResponse.json({ error: "Create a company first." }, { status: 400 });
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    const campaign = body.campaignId
      ? await prisma.campaign.findUnique({ where: { id: body.campaignId } })
      : null;

    const provider = await getTextProvider();
    const { system, user } = captionPrompts({
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
        ? {
            name: campaign.name,
            objective: campaign.objective,
            description: campaign.description,
            targetAudience: campaign.targetAudience,
          }
        : undefined,
      platform: body.platform,
      contentType: body.contentType || "image",
      topic: body.topic || "",
      language: body.language || company.language || "en",
      count: Math.min(5, Math.max(1, body.count || 3)),
      extraContext: body.extraContext,
    });

    const result = await provider.generateJSON<{ variants: CaptionVariant[] }>(system, user, {
      maxTokens: 4000,
    });
    if (!Array.isArray(result.variants)) {
      return NextResponse.json({ error: "AI returned no variants — try again." }, { status: 502 });
    }
    return NextResponse.json({ variants: result.variants });
  } catch (e) {
    return errorResponse(e);
  }
}
