import { prisma } from "@/lib/db";
import { getTextProvider } from "@/lib/ai";
import {
  captionPrompts,
  marketingPlanPrompts,
  reelScriptPrompts,
  CaptionVariant,
  ReelScript,
} from "@/lib/ai/prompts";
import { PLATFORMS } from "@/lib/constants";

// Shared AI task functions used by API routes, quick tasks and Autopilot.

export interface CompanyRecord {
  id: string;
  name: string;
  industry: string;
  description: string;
  targetAudience: string;
  toneOfVoice: string;
  language: string;
  city: string;
  website: string;
}

export function companyBrief(c: CompanyRecord) {
  return {
    name: c.name,
    industry: c.industry,
    description: c.description,
    targetAudience: c.targetAudience,
    toneOfVoice: c.toneOfVoice,
    city: c.city,
    website: c.website,
  };
}

export function campaignBrief(c: { name: string; objective: string; description: string; targetAudience: string } | null) {
  return c ? { name: c.name, objective: c.objective, description: c.description, targetAudience: c.targetAudience } : undefined;
}

// Small-model JSON output can be occasionally malformed — retry once.
async function generateJSONWithRetry<T>(
  provider: Awaited<ReturnType<typeof getTextProvider>>,
  system: string,
  user: string,
  opts?: { maxTokens?: number; temperature?: number }
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await provider.generateJSON<T>(system, user, opts);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function generateCaptions(opts: {
  company: CompanyRecord;
  campaign?: { name: string; objective: string; description: string; targetAudience: string } | null;
  platform: string;
  contentType?: string;
  topic: string;
  language: string;
  count?: number;
  extraContext?: string;
}): Promise<CaptionVariant[]> {
  const provider = await getTextProvider();
  const { system, user } = captionPrompts({
    company: companyBrief(opts.company),
    campaign: campaignBrief(opts.campaign || null),
    platform: opts.platform,
    contentType: opts.contentType || "image",
    topic: opts.topic,
    language: opts.language,
    count: Math.min(5, Math.max(1, opts.count || 3)),
    extraContext: opts.extraContext,
  });
  const result = await generateJSONWithRetry<{ variants: CaptionVariant[] }>(provider, system, user, {
    maxTokens: 4000,
  });
  if (!Array.isArray(result.variants)) {
    throw new Error("AI returned no caption variants — try again");
  }
  return result.variants;
}

export async function generatePlan(opts: {
  company: CompanyRecord;
  campaign?: { name: string; objective: string; description: string; targetAudience: string; budget?: string } | null;
  platforms: string[];
  weeks: number;
  language: string;
  goals?: string;
  budget?: string;
}): Promise<{ planData: Record<string, unknown>; title: string }> {
  const provider = await getTextProvider();
  const labels = opts.platforms.map(
    (p) => PLATFORMS.find((x) => x.id === p)?.label || p
  );
  const { system, user } = marketingPlanPrompts({
    company: companyBrief(opts.company),
    campaign: campaignBrief(
      opts.campaign
        ? {
            name: opts.campaign.name,
            objective: opts.campaign.objective,
            description: opts.campaign.description,
            targetAudience: opts.campaign.targetAudience,
          }
        : null
    ),
    platforms: labels,
    weeks: opts.weeks,
    language: opts.language,
    goals: opts.goals,
    budget: opts.budget || opts.campaign?.budget || undefined,
  });
  const planData = await generateJSONWithRetry<Record<string, unknown>>(provider, system, user, {
    maxTokens: 8000,
    temperature: 0.6,
  });
  const title = `${opts.campaign?.name || opts.company.name} — ${opts.weeks}-week plan`;
  return { planData, title };
}

export async function generateReelScript(opts: {
  company: CompanyRecord;
  campaign?: { name: string; objective: string; description: string; targetAudience: string } | null;
  topic: string;
  template: string;
  language: string;
  sceneCount: number;
  withVoiceover: boolean;
}): Promise<ReelScript> {
  const provider = await getTextProvider();
  const { system, user } = reelScriptPrompts({
    company: companyBrief(opts.company),
    campaign: campaignBrief(opts.campaign || null),
    template: opts.template,
    topic: opts.topic,
    language: opts.language,
    sceneCount: opts.sceneCount,
    withVoiceover: opts.withVoiceover,
  });
  const script = await generateJSONWithRetry<ReelScript>(provider, system, user, { maxTokens: 2500 });
  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error("AI returned an invalid reel script — try again");
  }
  return script;
}

// Deterministic analyst report (no AI key needed).
export async function buildAnalystReport(companyId: string) {
  const [byStatus, byPlatform, scheduled, reels, plans, logs] = await Promise.all([
    prisma.post.groupBy({ by: ["status"], where: { companyId }, _count: true }),
    prisma.post.groupBy({ by: ["platform"], where: { companyId }, _count: true }),
    prisma.post.count({ where: { companyId, status: "scheduled" } }),
    prisma.reel.count({ where: { companyId } }),
    prisma.marketingPlan.count({ where: { companyId } }),
    prisma.publishLog.findMany({
      where: { post: { companyId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { post: { select: { platform: true } } },
    }),
  ]);
  const total = byStatus.reduce((a, b) => a + b._count, 0);
  const published = byStatus.find((s) => s.status === "published")?._count || 0;
  const failed = byStatus.find((s) => s.status === "failed")?._count || 0;
  const topPlatform =
    byPlatform.sort((a, b) => b._count - a._count)[0]?.platform || "none";

  const next: string[] = [];
  if (total === 0) next.push("No content yet — run Autopilot to generate your first week of posts.");
  if (scheduled > 0) next.push(`${scheduled} post(s) queued — the Publisher agent will publish them automatically at their scheduled times.`);
  if (published === 0 && total > 0) next.push("Nothing published yet — connect a social account in Settings → Connections so the Publisher agent can go live.");
  if (failed > 0) next.push(`${failed} publish attempt(s) failed — check the Posts page for the error details and retry.`);
  if (reels === 0) next.push("No reels yet — reels typically get the highest reach. Ask the Video Director agent for one.");
  if (plans === 0) next.push("No marketing plan — ask the Strategy agent for a full strategy first.");
  if (next.length === 0) next.push("Everything looks healthy. Keep the weekly rhythm and review best posting times monthly.");

  const report = {
    summary: `${total} posts created · ${published} published · ${scheduled} queued · ${reels} reels · ${plans} plans. Most active platform: ${topPlatform}.`,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    byPlatform: Object.fromEntries(byPlatform.map((s) => [s.platform, s._count])),
    next,
    recentActivity: logs.map((l) => ({
      platform: l.post.platform,
      status: l.status,
      at: l.createdAt,
    })),
  };
  return report;
}
