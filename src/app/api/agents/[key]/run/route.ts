import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AGENT_MAP } from "@/lib/agents/registry";
import { tracked } from "@/lib/agents/runner";
import {
  buildAnalystReport,
  generateCaptions,
  generateReelScript,
} from "@/lib/agents/tasks";
import { renderTemplateImage, TemplateId, Aspect } from "@/lib/designer";
import { errorResponse, getActiveCompanyId, parseJsonBody, requireUser } from "@/lib/api-helpers";

// Quick manual tasks — run a single agent on demand from the Agents page.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await requireUser();
    const { key } = await params;
    const agent = AGENT_MAP[key];
    if (!agent) return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
    if (!agent.manualTask) {
      return NextResponse.json(
        { error: `${agent.name} works automatically — ${agent.worksVia}.` },
        { status: 400 }
      );
    }
    const body = await parseJsonBody<Record<string, string>>(req);
    const companyId = body.companyId || (await getActiveCompanyId());
    if (!companyId) return NextResponse.json({ error: "Create a company first." }, { status: 400 });
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    switch (agent.manualTask) {
      case "copywriter": {
        const variants = await tracked(
          "copywriter",
          "Quick captions",
          { companyId, input: { topic: body.topic, platform: body.platform } },
          async (log) => {
            log(`Writing for ${body.platform || "instagram"} in ${company.toneOfVoice} tone…`);
            const v = await generateCaptions({
              company,
              platform: body.platform || "meta_instagram",
              topic: body.topic || "",
              language: body.language || company.language || "en",
              count: 3,
            });
            log("3 caption options ready");
            return v;
          }
        );
        return NextResponse.json({ variants });
      }

      case "designer": {
        const asset = await tracked(
          "designer",
          "Quick design",
          { companyId, input: { template: body.template, headline: body.headline } },
          async (log) => {
            log(`Rendering a ${body.template || "quote"} design in ${company.name} brand colors…`);
            const a = await renderTemplateImage(
              company as Parameters<typeof renderTemplateImage>[0],
              {
                template: (body.template || "quote") as TemplateId,
                aspect: (body.aspect || "square") as Aspect,
                headline: body.headline || "Hello",
                subline: body.subline || "",
                badge: body.badge || "",
              }
            );
            log("Design rendered");
            return a;
          }
        );
        return NextResponse.json({ asset });
      }

      case "director": {
        const reel = await tracked(
          "director",
          "Quick reel script",
          { companyId, input: { topic: body.topic } },
          async (log) => {
            log(`Writing the scene script for: ${body.topic?.slice(0, 60) || "brand highlight"}…`);
            const script = await generateReelScript({
              company,
              topic: body.topic || "",
              template: body.template || "minimal",
              language: body.language || company.language || "en",
              sceneCount: 4,
              withVoiceover: true,
            });
            log(`${script.scenes.length} scenes scripted`);
            const r = await prisma.reel.create({
              data: {
                companyId,
                title: script.title?.slice(0, 120) || "Agent reel",
                template: body.template || "minimal",
                language: body.language || company.language || "en",
                voiceover: true,
                voice: (body.language || company.language) === "ar" ? "ar-SA-ZariyahNeural" : "en-US-AriaNeural",
                scriptData: JSON.stringify(script),
                status: "draft",
              },
            });
            return r;
          }
        );
        return NextResponse.json({ reel });
      }

      case "analyst": {
        const report = await tracked(
          "analyst",
          "Company report",
          { companyId, input: {} },
          async (log) => {
            log("Counting posts, publishes and reels…");
            const r = await buildAnalystReport(companyId);
            log(r.summary);
            return r;
          }
        );
        return NextResponse.json({ report });
      }

      default:
        return NextResponse.json({ error: "Task not available" }, { status: 400 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
