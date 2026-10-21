import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MEDIA_DIR, mediaAbsPath, mediaService } from "@/lib/media";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";
import { safeJsonParse } from "@/lib/utils";
import type { ReelScript } from "@/lib/ai/prompts";

// Start rendering the reel in the Python media service.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    await parseJsonBody(req).catch(() => ({}));
    const { id } = await params;

    const reel = await prisma.reel.findUnique({ where: { id }, include: { company: true } });
    if (!reel) return NextResponse.json({ error: "Reel not found" }, { status: 404 });
    if (reel.status === "rendering") return NextResponse.json({ error: "Already rendering" }, { status: 400 });

    const script = safeJsonParse<ReelScript>(reel.scriptData, {
      title: "", hook: "", scenes: [], cta: "", voiceoverScript: "", musicMood: "",
    });
    if (!script.scenes?.length) {
      return NextResponse.json({ error: "The reel has no scenes — generate a script first." }, { status: 400 });
    }

    const musicPath = reel.musicAssetId
      ? (await prisma.mediaAsset.findUnique({ where: { id: reel.musicAssetId } }))?.filePath
      : null;

    const payload = {
      template: reel.template,
      size: { width: 1080, height: 1920 },
      brand: {
        name: reel.company.name,
        primary: reel.company.primaryColor,
        secondary: reel.company.secondaryColor,
        website: reel.company.website,
        logo_path: reel.company.logoPath ? mediaAbsPath(reel.company.logoPath) : null,
      },
      language: reel.language,
      scenes: script.scenes.map((s) => ({
        text: s.text,
        image_path: s.imagePath ? mediaAbsPath(s.imagePath) : null,
        duration_sec: Math.min(8, Math.max(2, s.durationSec || 4)),
      })),
      cta: script.cta || "",
      subtitles: reel.subtitles,
      voiceover: reel.voiceover
        ? { voice: reel.voice, text: script.voiceoverScript || script.scenes.map((s) => s.text).join(". ") }
        : null,
      music_path: musicPath ? mediaAbsPath(musicPath) : null,
      media_dir: MEDIA_DIR,
      out_subdir: "reels",
    };

    const res = await mediaService<{ job_id: string }>("/render/reel/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    await prisma.renderJob.create({
      data: {
        companyId: reel.companyId,
        type: "reel_render",
        serviceJobId: res.job_id,
        status: "processing",
        payload: JSON.stringify({ reelId: id }),
      },
    });
    await prisma.reel.update({
      where: { id },
      data: { status: "rendering", progress: 5, error: null },
    });
    return NextResponse.json({ ok: true, jobId: res.job_id });
  } catch (e) {
    return errorResponse(e);
  }
}
