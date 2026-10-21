import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTextProvider } from "@/lib/ai";
import { reelScriptPrompts, ReelScript } from "@/lib/ai/prompts";
import { errorResponse, getActiveCompanyId, parseJsonBody, requireUser } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const url = new URL(req.url);
    let companyId = url.searchParams.get("companyId") || (await getActiveCompanyId());
    if (companyId === "all") companyId = undefined;
    const reels = await prisma.reel.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { name: true } },
        videoAsset: true,
      },
    });
    return NextResponse.json({ reels });
  } catch (e) {
    return errorResponse(e);
  }
}

// Generate a reel script with AI (scenes with text + image prompts).
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<{
      companyId?: string;
      campaignId?: string;
      title?: string;
      topic: string;
      template?: string;
      language?: string;
      sceneCount?: number;
      voiceover?: boolean;
      voice?: string;
    }>(req);

    const companyId = body.companyId || (await getActiveCompanyId());
    if (!companyId) return NextResponse.json({ error: "Create a company first." }, { status: 400 });
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    const campaign = body.campaignId
      ? await prisma.campaign.findUnique({ where: { id: body.campaignId } })
      : null;

    const provider = await getTextProvider();
    const { system, user } = reelScriptPrompts({
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
      template: body.template || "minimal",
      topic: body.topic,
      language: body.language || "en",
      sceneCount: Math.min(8, Math.max(3, body.sceneCount || 5)),
      withVoiceover: body.voiceover !== false,
    });

    const script = await provider.generateJSON<ReelScript>(system, user, { maxTokens: 2500 });
    if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
      return NextResponse.json({ error: "AI returned an invalid script — try again." }, { status: 502 });
    }

    const reel = await prisma.reel.create({
      data: {
        companyId,
        campaignId: campaign?.id || null,
        title: body.title?.trim() || script.title?.slice(0, 120) || "Untitled reel",
        template: body.template || "minimal",
        language: body.language || "en",
        voiceover: body.voiceover !== false,
        voice: body.voice || "en-US-AriaNeural",
        scriptData: JSON.stringify(script),
        status: "draft",
      },
    });
    return NextResponse.json({ reel });
  } catch (e) {
    return errorResponse(e);
  }
}
