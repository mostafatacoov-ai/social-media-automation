import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tracked } from "@/lib/agents/runner";
import { renderTemplateImage, Aspect, TemplateId } from "@/lib/designer";
import { errorResponse, getActiveCompanyId, parseJsonBody, requireUser } from "@/lib/api-helpers";

// Branded template image rendered by the Python media service → MediaAsset.
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<{
      companyId?: string;
      template: string;
      aspect?: Aspect;
      headline?: string;
      subline?: string;
      badge?: string;
      footer?: string;
    }>(req);

    const companyId = body.companyId || (await getActiveCompanyId());
    if (!companyId) return NextResponse.json({ error: "Create a company first." }, { status: 400 });
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const asset = await tracked(
      "designer",
      "Template design from composer",
      { companyId, input: { template: body.template, headline: body.headline, aspect: body.aspect } },
      async (log) => {
        log(`Rendering a ${body.template} design in ${company.name} brand…`);
        const a = await renderTemplateImage(company, {
          template: (body.template || "quote") as TemplateId,
          aspect: (body.aspect || "square") as Aspect,
          headline: body.headline || "",
          subline: body.subline || "",
          badge: body.badge || "",
          footer: body.footer || "",
        });
        log("Design rendered");
        return a;
      }
    );

    return NextResponse.json({ asset });
  } catch (e) {
    return errorResponse(e);
  }
}
