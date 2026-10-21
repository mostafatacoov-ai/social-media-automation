import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startAutopilot } from "@/lib/agents/autopilot";
import { errorResponse, getActiveCompanyId, parseJsonBody, requireUser } from "@/lib/api-helpers";
import { safeJsonParse } from "@/lib/utils";
import { PLATFORMS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<{
      companyId?: string;
      campaignId?: string;
      platforms?: string[];
      weeks?: number;
      includeReel?: boolean;
      language?: string;
    }>(req);
    const companyId = body.companyId || (await getActiveCompanyId());
    if (!companyId) {
      return NextResponse.json({ error: "Create a company first." }, { status: 400 });
    }
    const valid = PLATFORMS.map((p) => p.id);
    const platforms = (body.platforms || ["meta_instagram", "meta_facebook", "linkedin", "x"]).filter(
      (p) => valid.includes(p)
    );
    if (platforms.length === 0) {
      return NextResponse.json({ error: "Select at least one platform." }, { status: 400 });
    }

    const autopilot = await startAutopilot({
      companyId,
      campaignId: body.campaignId || null,
      platforms,
      weeks: Math.min(4, Math.max(1, body.weeks || 2)),
      includeReel: body.includeReel !== false,
      language: body.language || "en",
    });
    return NextResponse.json({ autopilot });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const companyId = new URL(req.url).searchParams.get("companyId");
    const latest = await prisma.autopilot.findFirst({
      where: companyId && companyId !== "all" ? { companyId } : undefined,
      orderBy: { createdAt: "desc" },
    });
    if (!latest) return NextResponse.json({ autopilot: null });
    return NextResponse.json({
      autopilot: {
        id: latest.id,
        status: latest.status,
        currentStep: latest.currentStep,
        steps: safeJsonParse<{ key: string; label: string; status: string; note: string }[]>(latest.steps, []),
        createdAt: latest.createdAt,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
