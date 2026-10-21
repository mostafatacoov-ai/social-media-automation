import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tracked } from "@/lib/agents/runner";
import { generateCaptions } from "@/lib/agents/tasks";
import { errorResponse, getActiveCompanyId, parseJsonBody, requireUser } from "@/lib/api-helpers";

// AI caption generation (Copywriter agent).
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

    const variants = await tracked(
      "copywriter",
      "Captions for post composer",
      { companyId, input: { topic: body.topic, platform: body.platform, language: body.language } },
      async (log) => {
        log(`Writing ${Math.min(5, Math.max(1, body.count || 3))} options for ${body.platform}…`);
        const v = await generateCaptions({
          company,
          campaign,
          platform: body.platform,
          contentType: body.contentType,
          topic: body.topic || "",
          language: body.language || company.language || "en",
          count: body.count,
          extraContext: body.extraContext,
        });
        log(`${v.length} caption options ready`);
        return v;
      }
    );

    return NextResponse.json({ variants });
  } catch (e) {
    return errorResponse(e);
  }
}
