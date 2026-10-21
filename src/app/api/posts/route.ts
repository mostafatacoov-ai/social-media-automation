import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, getActiveCompanyId, parseJsonBody, requireUser } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const url = new URL(req.url);
    let companyId = url.searchParams.get("companyId") || (await getActiveCompanyId());
    if (companyId === "all") companyId = undefined;
    const status = url.searchParams.get("status");
    const platform = url.searchParams.get("platform");
    const posts = await prisma.post.findMany({
      where: {
        ...(companyId ? { companyId } : undefined),
        ...(status && status !== "all" ? { status } : undefined),
        ...(platform && platform !== "all" ? { platform } : undefined),
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      include: {
        company: { select: { name: true } },
        campaign: { select: { name: true } },
        medias: { orderBy: { order: "asc" }, include: { mediaAsset: true } },
      },
    });
    return NextResponse.json({ posts });
  } catch (e) {
    return errorResponse(e);
  }
}

interface CreatePostBody {
  companyId?: string;
  campaignId?: string;
  planId?: string;
  platform: string;
  contentType?: string;
  caption?: string;
  hashtags?: string;
  ctaUrl?: string;
  language?: string;
  scheduledAt?: string | null;
  status?: string;
  mediaAssetIds?: string[];
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<CreatePostBody>(req);
    const companyId = body.companyId || (await getActiveCompanyId());
    if (!companyId) {
      return NextResponse.json({ error: "Create a company first." }, { status: 400 });
    }
    if (!body.platform) {
      return NextResponse.json({ error: "Platform is required." }, { status: 400 });
    }
    const post = await prisma.post.create({
      data: {
        companyId,
        campaignId: body.campaignId || null,
        planId: body.planId || null,
        platform: body.platform,
        contentType: body.contentType || "image",
        caption: body.caption || "",
        hashtags: body.hashtags || "",
        ctaUrl: body.ctaUrl || "",
        language: body.language || "en",
        status: body.status === "scheduled" && body.scheduledAt ? "scheduled" : "draft",
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      },
    });
    if (body.mediaAssetIds?.length) {
      await prisma.postMedia.createMany({
        data: body.mediaAssetIds.map((id, i) => ({ postId: post.id, mediaAssetId: id, order: i })),
      });
    }
    const full = await prisma.post.findUnique({
      where: { id: post.id },
      include: { medias: { include: { mediaAsset: true } } },
    });
    return NextResponse.json({ post: full });
  } catch (e) {
    return errorResponse(e);
  }
}
