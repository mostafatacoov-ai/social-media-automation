import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db";
import { mediaAbsPath, mediaService, MEDIA_DIR } from "@/lib/media";import { errorResponse, getActiveCompanyId, parseJsonBody, requireUser } from "@/lib/api-helpers";

// Branded template image rendered by the Python media service → MediaAsset.
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<{
      companyId?: string;
      template: string; // quote | stat | announcement | showcase | tip
      aspect?: "square" | "portrait" | "story";
      headline?: string;
      subline?: string;
      badge?: string;
      footer?: string;
    }>(req);

    const companyId = body.companyId || (await getActiveCompanyId());
    if (!companyId) return NextResponse.json({ error: "Create a company first." }, { status: 400 });
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const sizes = {
      square: { width: 1080, height: 1080 },
      portrait: { width: 1080, height: 1350 },
      story: { width: 1080, height: 1920 },
    };
    const size = sizes[body.aspect || "square"];

    const result = await mediaService<{ file_path: string; width: number; height: number }>(
      "/render/image",
      {
        method: "POST",
        body: JSON.stringify({
          template: body.template,
          size,
          brand: {
            name: company.name,
            primary: company.primaryColor,
            secondary: company.secondaryColor,
            website: company.website,
            logo_path: company.logoPath ? mediaAbsPath(company.logoPath) : null,
          },
          fields: {
            headline: body.headline || "",
            subline: body.subline || "",
            badge: body.badge || "",
            footer: body.footer || company.website || "",
          },
          media_dir: MEDIA_DIR,
          out_subdir: "templates",
        }),
      }
    );

    // Verify the file landed inside the shared media dir
    const rel = path.relative(MEDIA_DIR, mediaAbsPath(result.file_path));
    const asset = await prisma.mediaAsset.create({
      data: {
        companyId,
        kind: "template_image",
        filePath: rel.split(path.sep).join("/"),
        mimeType: "image/png",
        width: result.width || size.width,
        height: result.height || size.height,
        meta: JSON.stringify({ template: body.template }),
      },
    });
    return NextResponse.json({ asset });
  } catch (e) {
    return errorResponse(e);
  }
}
