import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getImageProvider, ImageSize } from "@/lib/ai";
import { saveMediaBuffer } from "@/lib/media";
import { errorResponse, getActiveCompanyId, parseJsonBody, requireUser } from "@/lib/api-helpers";

// AI text-to-image generation → MediaAsset.
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<{
      prompt: string;
      aspect?: "square" | "portrait" | "landscape";
      companyId?: string;
    }>(req);
    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: "Image prompt is required." }, { status: 400 });
    }
    const companyId = body.companyId || (await getActiveCompanyId());
    const size: ImageSize =
      body.aspect === "portrait" ? "1024x1536" : body.aspect === "landscape" ? "1536x1024" : "1024x1024";

    const provider = await getImageProvider();
    const { base64, mimeType } = await provider.generateImage(body.prompt, { size });
    const ext = mimeType.includes("jpeg") ? "jpg" : "png";
    const { relativePath } = saveMediaBuffer(Buffer.from(base64, "base64"), "ai", ext);

    const dims: Record<ImageSize, { width: number; height: number }> = {
      "1024x1024": { width: 1024, height: 1024 },
      "1024x1536": { width: 1024, height: 1536 },
      "1536x1024": { width: 1536, height: 1024 },
    };

    const asset = await prisma.mediaAsset.create({
      data: {
        companyId,
        kind: "ai_image",
        filePath: relativePath,
        mimeType,
        ...dims[size],
        meta: JSON.stringify({ prompt: body.prompt.slice(0, 500) }),
      },
    });
    return NextResponse.json({ asset });
  } catch (e) {
    return errorResponse(e);
  }
}
