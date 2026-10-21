import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        company: true,
        campaign: true,
        medias: { orderBy: { order: "asc" }, include: { mediaAsset: true } },
      },
    });
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ post });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const body = await parseJsonBody<Record<string, unknown>>(req);
    const data: Record<string, unknown> = {};
    for (const k of ["platform", "contentType", "caption", "hashtags", "ctaUrl", "language", "campaignId", "status"]) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.scheduledAt !== undefined) {
      data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt as string) : null;
    }
    if (body.mediaAssetIds !== undefined && Array.isArray(body.mediaAssetIds)) {
      await prisma.postMedia.deleteMany({ where: { postId: id } });
      if (body.mediaAssetIds.length) {
        await prisma.postMedia.createMany({
          data: (body.mediaAssetIds as string[]).map((mid, i) => ({ postId: id, mediaAssetId: mid, order: i })),
        });
      }
    }
    const post = await prisma.post.update({ where: { id }, data });
    return NextResponse.json({ post });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    await prisma.post.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
