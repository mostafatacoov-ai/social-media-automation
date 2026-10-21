import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mediaService } from "@/lib/media";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";
import type { ReelScript } from "@/lib/ai/prompts";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    let reel = await prisma.reel.findUnique({
      where: { id },
      include: { company: true, videoAsset: true, sceneMedia: true, campaign: true },
    });
    if (!reel) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // If rendering, poll the media service for progress
    if (reel.status === "rendering") {
      const job = await prisma.renderJob.findFirst({
        where: { type: "reel_render", status: { in: ["queued", "processing"] } },
        orderBy: { createdAt: "desc" },
      });
      const serviceJobId = job?.serviceJobId;
      if (serviceJobId) {
        try {
          const st = await mediaService<{ status: string; progress?: number; file_path?: string; error?: string }>(
            `/render/reel/status/${serviceJobId}`,
            { method: "GET", timeoutMs: 8000 }
          );
          if (st.status === "processing" || st.status === "queued") {
            const progress = st.progress ?? reel.progress;
            if (progress !== reel.progress) {
              reel = await prisma.reel.update({ where: { id }, data: { progress }, include: { company: true, videoAsset: true, sceneMedia: true, campaign: true } });
            }
          } else if (st.status === "done" && st.file_path) {
            const asset = await prisma.mediaAsset.create({
              data: {
                companyId: reel.companyId,
                reelId: reel.id,
                kind: "reel_video",
                filePath: st.file_path.split("\\").join("/"),
                mimeType: "video/mp4",
              },
            });
            await prisma.renderJob.updateMany({ where: { id: job.id }, data: { status: "done" } });
            reel = await prisma.reel.update({
              where: { id },
              data: { status: "ready", videoAssetId: asset.id, progress: 100 },
              include: { company: true, videoAsset: true, sceneMedia: true, campaign: true },
            });
          } else if (st.status === "failed") {
            await prisma.renderJob.updateMany({ where: { id: job.id }, data: { status: "failed", error: st.error } });
            reel = await prisma.reel.update({
              where: { id },
              data: { status: "failed", error: st.error || "Render failed" },
              include: { company: true, videoAsset: true, sceneMedia: true, campaign: true },
            });
          }
        } catch {
          /* media service unreachable — keep current state */
        }
      }
    }

    return NextResponse.json({ reel });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const body = await parseJsonBody<{
      title?: string;
      script?: ReelScript;
      voice?: string;
      voiceover?: boolean;
      musicAssetId?: string | null;
      subtitles?: boolean;
    }>(req);
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.voice !== undefined) data.voice = body.voice;
    if (body.voiceover !== undefined) data.voiceover = body.voiceover;
    if (body.subtitles !== undefined) data.subtitles = body.subtitles;
    if (body.musicAssetId !== undefined) data.musicAssetId = body.musicAssetId;
    if (body.script !== undefined) data.scriptData = JSON.stringify(body.script);
    const reel = await prisma.reel.update({ where: { id }, data });
    return NextResponse.json({ reel });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    await prisma.reel.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
