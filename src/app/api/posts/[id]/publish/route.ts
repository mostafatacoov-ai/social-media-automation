import { NextRequest, NextResponse } from "next/server";
import { publishPost } from "@/lib/publish";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";

// Publish now (bypasses the schedule).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    await parseJsonBody(req).catch(() => ({}));
    const { id } = await params;
    const result = await publishPost(id);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
