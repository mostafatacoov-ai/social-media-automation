import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const body = await parseJsonBody<Record<string, string>>(req);
    const allowed = [
      "name", "industry", "description", "targetAudience", "toneOfVoice",
      "language", "primaryColor", "secondaryColor", "logoPath", "website", "city", "isActive",
    ];
    const data: Record<string, string | boolean> = {};
    for (const k of allowed) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    const company = await prisma.company.update({ where: { id }, data });
    return NextResponse.json({ company });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
