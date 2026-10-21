import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";
import { safeJsonParse } from "@/lib/utils";

// Turn one week of the plan's calendar into draft posts.

const PLATFORM_ALIASES: Record<string, string> = {
  instagram: "meta_instagram",
  "instagram ": "meta_instagram",
  ig: "meta_instagram",
  facebook: "meta_facebook",
  fb: "meta_facebook",
  linkedin: "linkedin",
  twitter: "x",
  x: "x",
  tiktok: "tiktok",
  snapchat: "snapchat",
  snap: "snapchat",
};

function normalizePlatform(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (["meta_instagram", "meta_facebook", "linkedin", "x", "tiktok", "snapchat"].includes(key)) return key;
  return PLATFORM_ALIASES[key] || "meta_instagram";
}

function normalizeContentType(raw: string): string {
  const key = (raw || "").toLowerCase();
  if (key.includes("carousel")) return "carousel";
  if (key.includes("reel") || key.includes("video")) return "reel";
  if (key.includes("story")) return "image";
  if (key.includes("text")) return "text";
  return "image";
}

interface CalendarDay {
  day?: string;
  platform?: string;
  contentType?: string;
  pillar?: string;
  topic?: string;
  cta?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const body = await parseJsonBody<{ week?: number }>(req);
    const plan = await prisma.marketingPlan.findUnique({ where: { id } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const data = safeJsonParse<{ weeklyCalendar?: { week: number; theme?: string; days?: CalendarDay[] }[] }>(
      plan.planData,
      {}
    );
    const weekEntry = (data.weeklyCalendar || []).find(
      (w) => w.week === (body.week ?? 1)
    );
    if (!weekEntry?.days?.length) {
      return NextResponse.json({ error: `Week ${body.week} not found in this plan.` }, { status: 400 });
    }

    const posts = [];
    for (const day of weekEntry.days) {
      const platform = normalizePlatform(day.platform || "instagram");
      const post = await prisma.post.create({
        data: {
          companyId: plan.companyId,
          campaignId: plan.campaignId,
          planId: plan.id,
          platform,
          contentType: normalizeContentType(day.contentType || "post"),
          caption: `${day.topic || "Planned post"}${day.cta ? `\n\nCTA: ${day.cta}` : ""}`,
          language: plan.language === "both" ? "ar" : plan.language,
          status: "draft",
        },
      });
      posts.push(post);
    }
    return NextResponse.json({ created: posts.length, posts });
  } catch (e) {
    return errorResponse(e);
  }
}
