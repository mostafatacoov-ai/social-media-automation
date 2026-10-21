import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requireUser();
    const [companies, postsByStatus, postsByPlatform, reels, plans, accounts, upcoming, recentLogs, recentPosts] =
      await Promise.all([
        prisma.company.count(),
        prisma.post.groupBy({ by: ["status"], _count: true }),
        prisma.post.groupBy({ by: ["platform"], _count: true }),
        prisma.reel.count(),
        prisma.marketingPlan.count(),
        prisma.socialAccount.count(),
        prisma.post.findMany({
          where: { status: "scheduled", scheduledAt: { gte: new Date() } },
          orderBy: { scheduledAt: "asc" },
          take: 5,
          include: { company: { select: { name: true } } },
        }),
        prisma.publishLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { post: { select: { caption: true, platform: true } } },
        }),
        prisma.post.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { company: { select: { name: true } } },
        }),
      ]);

    return NextResponse.json({
      companies,
      postsByStatus: postsByStatus.map((s) => ({ status: s.status, count: s._count })),
      postsByPlatform: postsByPlatform.map((s) => ({ platform: s.platform, count: s._count })),
      reels,
      plans,
      accounts,
      upcoming,
      recentLogs,
      recentPosts,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
