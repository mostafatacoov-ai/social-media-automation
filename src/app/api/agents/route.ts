import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AGENTS } from "@/lib/agents/registry";
import { errorResponse, requireUser } from "@/lib/api-helpers";
import { safeJsonParse } from "@/lib/utils";

// Everything the AI Agents page needs in one poll: agent definitions,
// run history with step logs, per-agent stats, and the latest autopilot state.
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId");

    const [runs, autopilot] = await Promise.all([
      prisma.agentRun.findMany({
        where: companyId && companyId !== "all" ? { companyId } : undefined,
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.autopilot.findFirst({
        where: companyId && companyId !== "all" ? { companyId } : undefined,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const [stats] = await Promise.all([
      prisma.agentRun.groupBy({
        by: ["agentKey"],
        where: companyId && companyId !== "all" ? { companyId } : undefined,
        _count: true,
      }),
    ]);

    const running = runs.filter((r) => r.status === "running").map((r) => r.agentKey);

    return NextResponse.json({
      agents: AGENTS,
      running,
      runs: runs.map((r) => ({
        id: r.id,
        agentKey: r.agentKey,
        action: r.action,
        status: r.status,
        steps: safeJsonParse<{ t: number; msg: string }[]>(r.steps, []),
        output: r.output ? safeJsonParse<unknown>(r.output, null) : null,
        createdAt: r.createdAt,
      })),
      stats: Object.fromEntries(stats.map((s) => [s.agentKey, s._count])),
      autopilot: autopilot
        ? {
            id: autopilot.id,
            status: autopilot.status,
            currentStep: autopilot.currentStep,
            steps: safeJsonParse<{ key: string; label: string; status: string; note: string }[]>(autopilot.steps, []),
            createdAt: autopilot.createdAt,
          }
        : null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
