import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/api-helpers";
import { saveMediaBuffer } from "@/lib/media";

// Multipart file upload (logos, music tracks, images) → MediaAsset row.
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kind = (form.get("kind") as string) || "upload";
    const companyId = (form.get("companyId") as string) || null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const allowed = ["png", "jpg", "jpeg", "webp", "gif", "svg", "mp3", "wav", "m4a", "mp4", "mov", "png"];
    if (!allowed.includes(ext)) {
      return NextResponse.json({ error: `File type .${ext} not allowed` }, { status: 400 });
    }
    const { relativePath } = saveMediaBuffer(buf, "uploads", ext);
    const asset = await prisma.mediaAsset.create({
      data: {
        companyId,
        kind,
        filePath: relativePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: buf.length,
      },
    });
    return NextResponse.json({ asset });
  } catch (e) {
    return errorResponse(e);
  }
}
