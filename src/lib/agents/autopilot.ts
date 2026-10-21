import { prisma } from "@/lib/db";
import { generateCaptions, generatePlan, generateReelScript, CompanyRecord } from "./tasks";
import { renderTemplateImage } from "@/lib/designer";
import { startRun, logStep, finishRun } from "./runner";
import { safeJsonParse } from "@/lib/utils";
import { getTextProvider } from "@/lib/ai";
import { MEDIA_DIR, mediaAbsPath, mediaService } from "@/lib/media";

// The Autopilot: runs the full agent pipeline for a company, step by step.
// Every step creates an AgentRun so the client can watch the team work live.

const BEST_TIMES: Record<string, string> = {
  meta_instagram: "18:00",
  meta_facebook: "12:30",
  linkedin: "09:00",
  x: "13:00",
  tiktok: "20:00",
  snapchat: "19:00",
};

interface StepDef {
  key: string;
  label: string;
}

function stepDefs(includeReel: boolean): StepDef[] {
  const steps: StepDef[] = [
    { key: "strategist", label: "Layla is building your marketing strategy" },
    { key: "copywriter", label: "Omar is writing week-1 posts" },
    { key: "designer", label: "Noor is designing branded visuals" },
  ];
  if (includeReel) steps.push({ key: "director", label: "Rayan is producing a reel" });
  steps.push(
    { key: "scheduler", label: "Sara is scheduling the calendar" },
    { key: "publisher", label: "Adam is arming the publishing queue" },
    { key: "analyst", label: "Hind is compiling the launch report" }
  );
  return steps;
}

export async function startAutopilot(opts: {
  companyId: string;
  campaignId?: string | null;
  platforms: string[];
  weeks: number;
  includeReel: boolean;
  language: string;
}) {
  // Fail fast with a clear message when the team can't work yet
  const { getAiSettings } = await import("@/lib/settings");
  const ai = await getAiSettings();
  if (!ai.providers[ai.textProvider]?.apiKey) {
    throw new Error(
      `The agents need an AI brain first — add an API key for "${ai.textProvider}" in Settings → AI.`
    );
  }
  const company = await prisma.company.findUnique({ where: { id: opts.companyId } });
  if (!company) throw new Error("Company not found");

  const steps = stepDefs(opts.includeReel).map((s) => ({ ...s, status: "pending", note: "" }));
  const autopilot = await prisma.autopilot.create({
    data: {
      companyId: opts.companyId,
      campaignId: opts.campaignId || null,
      status: "running",
      config: JSON.stringify(opts),
      steps: JSON.stringify(steps),
      currentStep: 0,
    },
  });

  // Fire and forget — the pipeline updates rows as it goes; the UI polls.
  runAutopilot(autopilot.id).catch((e) => console.error("[autopilot]", e));
  return autopilot;
}

async function setStep(autopilotId: string, index: number, patch: Partial<{ status: string; note: string }>) {
  const ap = await prisma.autopilot.findUnique({ where: { id: autopilotId } });
  if (!ap) return;
  const steps = safeJsonParse<{ key: string; label: string; status: string; note: string }[]>(ap.steps, []);
  if (steps[index]) steps[index] = { ...steps[index], ...patch };
  await prisma.autopilot.update({
    where: { id: autopilotId },
    data: { steps: JSON.stringify(steps), currentStep: index },
  });
}

async function completeAutopilot(autopilotId: string, status: "done" | "failed") {
  await prisma.autopilot.update({ where: { id: autopilotId }, data: { status } });
}

async function runAutopilot(autopilotId: string) {
  const ap = await prisma.autopilot.findUnique({ where: { id: autopilotId } });
  if (!ap) return;
  const config = safeJsonParse<{
    companyId: string;
    campaignId?: string | null;
    platforms: string[];
    weeks: number;
    includeReel: boolean;
    language: string;
  }>(ap.config, { companyId: ap.companyId, platforms: [], weeks: 1, includeReel: false, language: "en" });

  const company = (await prisma.company.findUnique({
    where: { id: config.companyId },
  })) as CompanyRecord | null;
  if (!company) return void completeAutopilot(autopilotId, "failed");
  const campaign = config.campaignId
    ? await prisma.campaign.findUnique({ where: { id: config.campaignId } })
    : null;

  const steps = safeJsonParse<{ key: string }[]>(ap.steps, []);
  let stepIndex = -1;

  const runStep = async (agentKey: string, action: string, fn: (log: (m: string) => void) => Promise<string>) => {
    stepIndex++;
    const idx = stepIndex;
    await setStep(autopilotId, idx, { status: "running", note: "" });
    const runId = await startRun({
      agentKey,
      companyId: config.companyId,
      autopilotId,
      action,
      input: { campaign: campaign?.name, platforms: config.platforms, weeks: config.weeks },
    });
    try {
      const note = await fn((m) => logStep(runId, m));
      await finishRun(runId, "done", { summary: note });
      await setStep(autopilotId, idx, { status: "done", note });
      return note;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "step failed";
      await finishRun(runId, "failed", { error: msg });
      await setStep(autopilotId, idx, { status: "failed", note: msg });
      throw e;
    }
  };

  try {
    // Ensure provider is reachable before starting (double check after async gap)
    await getTextProvider();

    // ── 1) STRATEGIST ────────────────────────────────────────────
    const planId = await runStep("strategist", "Generate marketing plan", async (log) => {
      log("Reading the company profile and campaign brief…");
      const { planData, title } = await generatePlan({
        company,
        campaign,
        platforms: config.platforms,
        weeks: config.weeks,
        language: config.language,
      });
      log("Structure ready: pillars, personas and calendar");
      const plan = await prisma.marketingPlan.create({
        data: {
          companyId: config.companyId,
          campaignId: campaign?.id || null,
          title,
          durationWeeks: config.weeks,
          platforms: JSON.stringify(config.platforms),
          planData: JSON.stringify(planData),
          language: config.language,
          status: "ready",
        },
      });
      return `Plan created: ${title}`;
    });
    void planId;

    // ── 2) COPYWRITER ────────────────────────────────────────────
    const createdPostIds: string[] = [];
    await runStep("copywriter", "Write week-1 posts", async (log) => {
      const plan = await prisma.marketingPlan.findFirst({
        where: { companyId: config.companyId },
        orderBy: { createdAt: "desc" },
      });
      const data = safeJsonParse<{ weeklyCalendar?: { week: number; days?: { day?: string; platform?: string; contentType?: string; pillar?: string; topic?: string; cta?: string }[] }[] }>(
        plan?.planData || "{}",
        {}
      );
      const week1 = data.weeklyCalendar?.find((w) => w.week === 1)?.days?.slice(0, 4) || [];
      if (week1.length === 0) {
        // Fallback: 3 fresh topics straight from the brief
        log("No calendar found — improvising from the company brief");
      }
      const topics = week1.length
        ? week1.map((d) => ({
            platform: normalizePlatform(d.platform),
            contentType: normalizeType(d.contentType),
            topic: d.topic || "Company highlight",
          }))
        : config.platforms.slice(0, 3).map((p) => ({ platform: p, contentType: "image", topic: "" }));

      const ids: string[] = [];
      for (let i = 0; i < topics.length; i++) {
        const t = topics[i];
        log(`Writing post ${i + 1}/${topics.length} for ${t.platform}…`);
        const variants = await generateCaptions({
          company,
          campaign,
          platform: t.platform,
          contentType: t.contentType,
          topic: t.topic,
          language: config.language,
          count: 1,
        });
        const v = variants[0];
        const post = await prisma.post.create({
          data: {
            companyId: config.companyId,
            campaignId: campaign?.id || null,
            planId: plan?.id,
            platform: t.platform,
            contentType: t.contentType,
            caption: v?.caption || t.topic,
            hashtags: v?.hashtags || "",
            language: config.language,
            status: "draft",
          },
        });
        ids.push(post.id);
        createdPostIds.push(post.id);
      }
      return `${ids.length} posts written`;
    });

    // ── 3) DESIGNER ──────────────────────────────────────────────
    await runStep("designer", "Design post visuals", async (log) => {
      const posts = await prisma.post.findMany({
        where: { id: { in: createdPostIds }, contentType: { in: ["image", "carousel"] } },
      });
      const templates = ["announcement", "quote", "stat", "showcase", "tip"];
      let designed = 0;
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const headline = firstLine(post.caption) || "New from " + company.name;
        log(`Designing ${i + 1}/${posts.length}: “${headline.slice(0, 40)}”`);
        try {
          const asset = await renderTemplateImage(
            company as Parameters<typeof renderTemplateImage>[0],
            {
              template: templates[i % templates.length] as "quote",
              aspect: post.platform === "snapchat" ? "story" : "square",
              headline: headline.slice(0, 80),
              subline: firstLine(post.caption, 1).slice(0, 90),
              badge: config.language === "ar" ? "جديد" : "NEW",
            }
          );
          await prisma.postMedia.create({ data: { postId: post.id, mediaAssetId: asset.id, order: 0 } });
          designed++;
        } catch (e) {
          log(`Design skipped (${e instanceof Error ? e.message.slice(0, 80) : "media service offline"})`);
        }
      }
      return designed > 0 ? `${designed} branded designs created` : "Designs skipped — media service offline";
    });

    // ── 4) DIRECTOR (optional) ───────────────────────────────────
    if (config.includeReel) {
      await runStep("director", "Produce a reel", async (log) => {
        const plan = await prisma.marketingPlan.findFirst({
          where: { companyId: config.companyId },
          orderBy: { createdAt: "desc" },
        });
        const data = safeJsonParse<{ weeklyCalendar?: { week: number; days?: { topic?: string }[] }[] }>(
          plan?.planData || "{}",
          {}
        );
        const topic =
          data.weeklyCalendar?.[0]?.days?.find((d) => d.topic)?.topic ||
          `${company.name} highlight`;
        log(`Scripting the reel: “${topic.slice(0, 50)}”`);
        const script = await generateReelScript({
          company,
          campaign,
          topic,
          template: "minimal",
          language: config.language,
          sceneCount: 4,
          withVoiceover: true,
        });
        log(`Script ready — ${script.scenes.length} scenes`);
        const reel = await prisma.reel.create({
          data: {
            companyId: config.companyId,
            campaignId: campaign?.id || null,
            title: script.title?.slice(0, 120) || "Autopilot reel",
            template: "minimal",
            language: config.language,
            voiceover: true,
            voice: config.language === "ar" ? "ar-SA-ZariyahNeural" : "en-US-AriaNeural",
            scriptData: JSON.stringify(script),
            status: "draft",
          },
        });
        // Submit the render (runs in the media service; the Reels studio shows progress)
        try {
          const res = await mediaService<{ job_id: string }>("/render/reel/start", {
            method: "POST",
            body: JSON.stringify({
              template: reel.template,
              size: { width: 1080, height: 1920 },
              brand: {
                name: company.name,
                primary: (company as unknown as { primaryColor: string }).primaryColor,
                secondary: (company as unknown as { secondaryColor: string }).secondaryColor,
                website: company.website,
                logo_path: (company as unknown as { logoPath: string }).logoPath
                  ? mediaAbsPath((company as unknown as { logoPath: string }).logoPath)
                  : null,
              },
              language: config.language,
              scenes: script.scenes.map((s) => ({
                text: s.text,
                image_path: s.imagePath ? mediaAbsPath(s.imagePath) : null,
                duration_sec: Math.min(8, Math.max(2, s.durationSec || 4)),
              })),
              cta: script.cta || "",
              subtitles: true,
              voiceover: {
                voice: reel.voice,
                text: script.voiceoverScript || script.scenes.map((s) => s.text).join(". "),
              },
              music_path: null,
              media_dir: MEDIA_DIR,
              out_subdir: "reels",
            }),
          });
          await prisma.renderJob.create({
            data: {
              companyId: config.companyId,
              type: "reel_render",
              serviceJobId: res.job_id,
              status: "processing",
              payload: JSON.stringify({ reelId: reel.id }),
            },
          });
          await prisma.reel.update({ where: { id: reel.id }, data: { status: "rendering", progress: 5 } });
          return `Reel rendering in background — watch it in Reels`;
        } catch (e) {
          log(`Render not started (${e instanceof Error ? e.message.slice(0, 80) : "media service offline"})`);
          return `Script saved — open Reels to render manually`;
        }
      });
    }

    // ── 5) SCHEDULER ─────────────────────────────────────────────
    await runStep("scheduler", "Schedule the week", async (log) => {
      const posts = await prisma.post.findMany({
        where: { id: { in: createdPostIds }, status: "draft" },
      });
      const base = new Date();
      base.setDate(base.getDate() + 1); // start tomorrow
      base.setHours(0, 0, 0, 0);
      let slot = 0;
      for (const post of posts) {
        const time = BEST_TIMES[post.platform] || "12:00";
        const when = new Date(base);
        when.setDate(base.getDate() + slot); // one post per day
        const [h, m] = time.split(":").map(Number);
        when.setHours(h, m, 0, 0);
        if (when <= new Date()) when.setDate(when.getDate() + 1);
        await prisma.post.update({
          where: { id: post.id },
          data: { scheduledAt: when, status: "scheduled" },
        });
        log(`Scheduled ${post.platform} post → ${when.toLocaleDateString()} ${time}`);
        slot++;
      }
      return `${posts.length} posts scheduled over ${Math.max(1, slot)} day(s)`;
    });

    // ── 6) PUBLISHER ─────────────────────────────────────────────
    await runStep("publisher", "Arm the publishing queue", async (log) => {
      const queued = await prisma.post.count({
        where: { companyId: config.companyId, status: "scheduled" },
      });
      const accounts = await prisma.socialAccount.count({
        where: { companyId: config.companyId },
      });
      log(`${queued} post(s) in the queue`);
      log(
        accounts > 0
          ? `${accounts} connected account(s) will receive them`
          : "No social accounts connected yet — connect one in Settings so posts can go live automatically"
      );
      return `${queued} posts queued for automatic publishing`;
    });

    // ── 7) ANALYST ───────────────────────────────────────────────
    await runStep("analyst", "Launch report", async (log) => {
      const { buildAnalystReport } = await import("./tasks");
      const report = await buildAnalystReport(config.companyId);
      log(report.summary);
      return report.summary;
    });

    await completeAutopilot(autopilotId, "done");
  } catch (e) {
    console.error("[autopilot] step failed:", e);
    await completeAutopilot(autopilotId, "failed");
  }
}

function normalizePlatform(raw?: string): string {
  const key = (raw || "").trim().toLowerCase();
  const map: Record<string, string> = {
    instagram: "meta_instagram", ig: "meta_instagram",
    facebook: "meta_facebook", fb: "meta_facebook",
    linkedin: "linkedin", twitter: "x", x: "x",
    tiktok: "tiktok", snapchat: "snapchat", snap: "snapchat",
  };
  return map[key] || "meta_instagram";
}

function normalizeType(raw?: string): string {
  const key = (raw || "").toLowerCase();
  if (key.includes("carousel")) return "carousel";
  if (key.includes("reel") || key.includes("video")) return "reel";
  if (key.includes("text")) return "text";
  return "image";
}

function firstLine(text: string, line = 0): string {
  const lines = (text || "").split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
  return (lines[line] || lines[0] || "").trim();
}
