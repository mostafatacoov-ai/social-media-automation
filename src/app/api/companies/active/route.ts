import { NextRequest, NextResponse } from "next/server";
import { errorResponse, parseJsonBody, requireUser, setActiveCompanyId } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const { id } = await parseJsonBody<{ id: string }>(req);
    await setActiveCompanyId(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
