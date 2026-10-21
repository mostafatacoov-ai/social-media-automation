import { NextRequest, NextResponse } from "next/server";
import { tracked } from "@/lib/agents/runner";
import { generateAiImage, Aspect } from "@/lib/designer";
import { errorResponse, getActiveCompanyId, parseJsonBody, requireUser } from "@/lib/api-helpers";

// AI text-to-image generation → MediaAsset.
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<{
      prompt: string;
      aspect?: Aspect;
      companyId?: string;
    }>(req);
    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: "Image prompt is required." }, { status: 400 });
    }
    const companyId = body.companyId || (await getActiveCompanyId());

    const asset = await tracked(
      "designer",
      "AI image generation",
      { companyId, input: { prompt: body.prompt, aspect: body.aspect } },
      async (log) => {
        log("Generating with the AI image model…");
        const a = await generateAiImage(companyId, body.prompt, body.aspect || "square");
        log("Image ready");
        return a;
      }
    );

    return NextResponse.json({ asset });
  } catch (e) {
    return errorResponse(e);
  }
}
