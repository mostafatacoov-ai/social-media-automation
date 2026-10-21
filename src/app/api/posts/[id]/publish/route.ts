import { NextRequest, NextResponse } from "next/server";
import { publishPost } from "@/lib/publish";
import { startRun, finishRun } from "@/lib/agents/runner";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";

// Publish now (bypasses the schedule) — recorded as a Publisher agent run.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    await parseJsonBody(req).catch(() => ({}));
    const { id } = await params;
    const runId = await startRun({ agentKey: "publisher", action: "Manual publish now", input: { postId: id } });
    try {
      const result = await publishPost(id);
      await finishRun(runId, result.status === "failed" ? "failed" : "done", { summary: result.status });
      return NextResponse.json(result);
    } catch (e) {
      await finishRun(runId, "failed", { error: e instanceof Error ? e.message : "failed" });
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
