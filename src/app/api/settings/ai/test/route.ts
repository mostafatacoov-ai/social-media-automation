import { NextRequest, NextResponse } from "next/server";
import { getTextProvider } from "@/lib/ai";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";

// Quick connectivity test for the configured text provider.
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    await parseJsonBody(req);
    const provider = await getTextProvider();
    const reply = await provider.generate(
      [{ role: "user", content: "Reply with exactly: OK" }],
      { maxTokens: 10, temperature: 0 }
    );
    return NextResponse.json({ ok: true, reply: reply.slice(0, 50) });
  } catch (e) {
    return errorResponse(e);
  }
}
