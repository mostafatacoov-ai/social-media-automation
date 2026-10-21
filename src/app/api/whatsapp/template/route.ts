import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWhatsAppCreds, sendTemplate } from "@/lib/whatsapp";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";

// Send an approved template message — required to (re)start a conversation
// outside the 24-hour window.
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<{
      companyId?: string;
      to?: string; // wa id, for new numbers
      contactId?: string; // existing contact
      template: string;
      language?: string;
      params?: string[];
    }>(req);

    const creds = await getWhatsAppCreds();
    if (!creds.phoneNumberId || !creds.token) {
      return NextResponse.json(
        { error: "WhatsApp is not connected — add your Cloud API details on the WhatsApp page first." },
        { status: 400 }
      );
    }

    let to = body.to || "";
    let companyId = body.companyId || "";
    if (body.contactId) {
      const contact = await prisma.whatsAppContact.findUnique({ where: { id: body.contactId } });
      if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      to = contact.waId;
      companyId = contact.companyId;
    }
    if (!to) return NextResponse.json({ error: "Destination number required" }, { status: 400 });

    const externalId = await sendTemplate(
      creds,
      to,
      body.template,
      body.language || "en",
      body.params || []
    );

    const message = body.contactId
      ? await prisma.whatsAppMessage.create({
          data: {
            companyId,
            contactId: body.contactId,
            direction: "out",
            kind: "template",
            body: `[template: ${body.template}] ${(body.params || []).join(" | ")}`,
            template: body.template,
            status: "sent",
            externalId,
          },
        })
      : null;

    return NextResponse.json({ ok: true, message });
  } catch (e) {
    return errorResponse(e);
  }
}
