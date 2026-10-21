import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tracked } from "@/lib/agents/runner";
import { generateReelScript } from "@/lib/agents/tasks";
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

    const script = await tracked(
      "director",
      "Reel script from Reels page",
      { companyId, input: { topic: body.topic, template: body.template } },
      async (log) => {
        log(`Scripting a ${body.template || "minimal"} reel…`);
        const s = await generateReelScript({
          company,
          campaign,
          topic: body.topic,
          template: body.template || "minimal",
          language: body.language || "en",
          sceneCount: Math.min(8, Math.max(3, body.sceneCount || 5)),
          withVoiceover: body.voiceover !== false,
        });
        log(`${s.scenes.length} scenes ready`);
        return s;
      }
    );

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
