import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getImageProvider } from "@/lib/ai";
import { saveMediaBuffer } from "@/lib/media";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";
import { safeJsonParse } from "@/lib/utils";
import type { ReelScript } from "@/lib/ai/prompts";

// Generate the AI image for one scene (portrait 1024x1536) and attach it.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const body = await parseJsonBody<{ sceneIndex: number; prompt?: string }>(req);
    const reel = await prisma.reel.findUnique({ where: { id } });
    if (!reel) return NextResponse.json({ error: "Reel not found" }, { status: 404 });
    const script = safeJsonParse<ReelScript>(reel.scriptData, { title: "", hook: "", scenes: [], cta: "", voiceoverScript: "", musicMood: "" });
    const scene = script.scenes[body.sceneIndex];
    if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

    const prompt = body.prompt?.trim() || scene.imagePrompt;
    const provider = await getImageProvider();
    const { base64, mimeType } = await provider.generateImage(
      `${prompt}, vertical composition 9:16, cinematic, high quality, no text, no words, no letters, no watermark`,
      { size: "1024x1536" }
    );
    const ext = mimeType.includes("jpeg") ? "jpg" : "png";
    const { relativePath } = saveMediaBuffer(Buffer.from(base64, "base64"), "scenes", ext);
    const asset = await prisma.mediaAsset.create({
      data: {
        companyId: reel.companyId,
        reelId: reel.id,
        kind: "scene_image",
        filePath: relativePath,
        mimeType,
        width: 1024,
        height: 1536,
        meta: JSON.stringify({ sceneIndex: body.sceneIndex }),
      },
    });

    // Point the scene at the new asset path
    scene.imagePath = relativePath;
    await prisma.reel.update({ where: { id }, data: { scriptData: JSON.stringify(script) } });
    return NextResponse.json({ asset, script });
  } catch (e) {
    return errorResponse(e);
  }
}
