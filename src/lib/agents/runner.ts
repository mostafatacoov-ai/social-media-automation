import { prisma } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";

// DB-backed agent run tracker: every agent action becomes an AgentRun row
// with a step log, so the client can watch agents work live.

export interface RunStep {
  t: number;
  msg: string;
}

export async function startRun(opts: {
  agentKey: string;
  companyId?: string | null;
  autopilotId?: string | null;
  action: string;
  input?: unknown;
}): Promise<string> {
  const run = await prisma.agentRun.create({
    data: {
      agentKey: opts.agentKey,
      companyId: opts.companyId || null,
      autopilotId: opts.autopilotId || null,
      action: opts.action,
      input: JSON.stringify(opts.input ?? {}).slice(0, 4000),
      status: "running",
    },
  });
  return run.id;
}

export async function logStep(runId: string, msg: string) {
  try {
    const run = await prisma.agentRun.findUnique({ where: { id: runId } });
    if (!run) return;
    const steps = safeJsonParse<RunStep[]>(run.steps, []);
    steps.push({ t: Date.now(), msg: String(msg).slice(0, 300) });
    await prisma.agentRun.update({
      where: { id: runId },
      data: { steps: JSON.stringify(steps.slice(-50)) },
    });
  } catch {
    /* logging must never break a run */
  }
}

export async function finishRun(
  runId: string,
  status: "done" | "failed",
  output?: unknown
) {
  try {
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status,
        output: output !== undefined ? JSON.stringify(output).slice(0, 6000) : undefined,
      },
    });
  } catch {
    /* ignore */
  }
}

// Wraps a task with a run: records steps and result automatically.
export async function tracked<T>(
  agentKey: string,
  action: string,
  opts: { companyId?: string | null; autopilotId?: string | null; input?: unknown },
  fn: (log: (msg: string) => void) => Promise<T>
): Promise<T> {
  const runId = await startRun({ agentKey, action, ...opts });
  try {
    const result = await fn((msg) => logStep(runId, msg));
    await finishRun(runId, "done", { ok: true, summary: summarize(result) });
    return result;
  } catch (e) {
    await finishRun(runId, "failed", { error: e instanceof Error ? e.message : "failed" });
    throw e;
  }
}

function summarize(result: unknown): string {
  if (result === undefined) return "";
  if (typeof result === "string") return result.slice(0, 200);
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.summary === "string") return r.summary.slice(0, 200);
    if (typeof r.note === "string") return r.note.slice(0, 200);
  }
  return "";
}
