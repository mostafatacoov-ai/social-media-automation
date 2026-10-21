import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWhatsAppCreds, sendImage, sendText } from "@/lib/whatsapp";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";

// Send a message (text or image) to a contact. Free-form messages are only
// allowed by WhatsApp within 24h of the customer's last message.
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<{
      contactId: string;
      text?: string;
      mediaAssetId?: string;
    }>(req);

    const contact = await prisma.whatsAppContact.findUnique({ where: { id: body.contactId } });
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const creds = await getWhatsAppCreds();
    if (!creds.phoneNumberId || !creds.token) {
      return NextResponse.json(
        { error: "WhatsApp is not connected — add your Cloud API details on the WhatsApp page first." },
        { status: 400 }
      );
    }
    const windowOpen =
      contact.lastInboundAt && Date.now() - new Date(contact.lastInboundAt).getTime() < 24 * 3600 * 1000;
    if (!windowOpen) {
      return NextResponse.json(
        { error: "Outside the 24-hour customer window — send an approved template instead (WhatsApp requires it to start conversations)." },
        { status: 400 }
      );
    }

    let externalId = "";
    let mediaUrl: string | null = null;
    if (body.mediaAssetId) {
      const asset = await prisma.mediaAsset.findUnique({ where: { id: body.mediaAssetId } });
      if (!asset) return NextResponse.json({ error: "Media not found" }, { status: 404 });
      mediaUrl = `${process.env.PUBLIC_BASE_URL || new URL(req.url).origin}/api/media/${asset.filePath}`;
      externalId = await sendImage(creds, contact.waId, mediaUrl, body.text || "");
    } else {
      if (!body.text?.trim()) return NextResponse.json({ error: "Message text is empty" }, { status: 400 });
      externalId = await sendText(creds, contact.waId, body.text.trim());
    }

    const message = await prisma.whatsAppMessage.create({
      data: {
        companyId: contact.companyId,
        contactId: contact.id,
        direction: "out",
        kind: body.mediaAssetId ? "image" : "text",
        body: body.text || "",
        mediaUrl,
        status: "sent",
        externalId,
      },
    });
    await prisma.whatsAppContact.update({
      where: { id: contact.id },
      data: { lastMessageAt: new Date() },
    });
    return NextResponse.json({ message });
  } catch (e) {
    return errorResponse(e);
  }
}
