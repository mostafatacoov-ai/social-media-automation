import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWhatsAppCreds, isAutoReplyEnabled } from "@/lib/whatsapp";

// Public Meta webhook: verification handshake + incoming messages/statuses.
// Configure in Meta → WhatsApp → Configuration with:
//   <PUBLIC_BASE_URL>/api/whatsapp/webhook?company=<companyId>

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && challenge) {
    const creds = await getWhatsAppCreds();
    if (creds.verifyToken && token === creds.verifyToken) {
      return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse("Forbidden", { status: 403 });
  }
  return NextResponse.json({ ok: true });
}

interface WaWebhookBody {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: {
          id: string;
          from: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          image?: { link?: string; caption?: string; id?: string };
          button?: { text?: string };
          interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
        }[];
        statuses?: { id: string; status: string; timestamp?: string }[];
      };
    }[];
  }[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WaWebhookBody;
    const companyId =
      new URL(req.url).searchParams.get("company") ||
      (await prisma.company.findFirst({ orderBy: { createdAt: "asc" } }))?.id;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};

        // Outbound delivery statuses
        for (const st of value.statuses || []) {
          await prisma.whatsAppMessage.updateMany({
            where: { externalId: st.id },
            data: { status: st.status },
          });
        }

        // Incoming messages
        for (const msg of value.messages || []) {
          if (!companyId || !msg.from) continue;
          const name = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name || "";
          const text =
            msg.text?.body ||
            msg.button?.text ||
            msg.interactive?.button_reply?.title ||
            msg.interactive?.list_reply?.title ||
            (msg.image ? `🖼️ ${msg.image.caption || "Photo"}` : "[message]");

          const contact = await prisma.whatsAppContact.upsert({
            where: { companyId_waId: { companyId, waId: msg.from } },
            update: {
              unreadCount: { increment: 1 },
              lastMessageAt: new Date(),
              lastInboundAt: new Date(),
              ...(name ? { name } : {}),
            },
            create: {
              companyId,
              waId: msg.from,
              name,
              lastMessageAt: new Date(),
              lastInboundAt: new Date(),
              unreadCount: 1,
            },
          });

          await prisma.whatsAppMessage.create({
            data: {
              companyId,
              contactId: contact.id,
              direction: "in",
              kind: msg.image ? "image" : "text",
              body: text,
              mediaUrl: msg.image?.link || null,
              status: "received",
              externalId: msg.id,
            },
          });

          // AI auto-reply — fire and forget, never blocks the 200 response
          if (await isAutoReplyEnabled(companyId)) {
            handleAutoReply(companyId, contact.id, msg.from, text, msg.id).catch((e) =>
              console.error("[whatsapp] auto-reply failed:", e)
            );
          }
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[whatsapp] webhook error:", e);
    // Meta retries on non-200; a swallowed error is better than a flood
    return NextResponse.json({ ok: true });
  }
}

async function handleAutoReply(
  companyId: string,
  contactId: string,
  waId: string,
  incoming: string,
  inboundMessageId: string
) {
  const { tracked } = await import("@/lib/agents/runner");
  const { generateWhatsAppReply } = await import("@/lib/agents/tasks");
  const { getWhatsAppCreds, sendText, markRead } = await import("@/lib/whatsapp");

  const reply = await tracked(
    "concierge",
    "WhatsApp auto-reply",
    { companyId, input: { from: waId, incoming: incoming.slice(0, 120) } },
    async (log) => {
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) throw new Error("Company not found");
      const history = await prisma.whatsAppMessage.findMany({
        where: { contactId },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      log(`Replying to ${waId} in ${/[\u0600-\u06FF]/.test(incoming) ? "Arabic" : "English"}…`);
      const text = await generateWhatsAppReply(
        {
          company: {
            name: company.name,
            industry: company.industry,
            description: company.description,
            toneOfVoice: company.toneOfVoice,
            website: company.website,
            city: company.city,
          },
          history: history.reverse().map((m) => ({ direction: m.direction, body: m.body })),
          incoming,
        }
      );
      const creds = await getWhatsAppCreds();
      if (!creds.phoneNumberId || !creds.token) throw new Error("WhatsApp is not connected (Settings in the WhatsApp page)");
      const externalId = await sendText(creds, waId, text);
      markRead(creds, inboundMessageId).catch(() => {});
      await prisma.whatsAppMessage.create({
        data: {
          companyId,
          contactId,
          direction: "out",
          kind: "text",
          body: text,
          status: "sent",
          externalId,
        },
      });
      await prisma.whatsAppContact.update({
        where: { id: contactId },
        data: { lastMessageAt: new Date() },
      });
      log("Reply sent");
      return { summary: text.slice(0, 120) };
    }
  );
  void reply;
}
