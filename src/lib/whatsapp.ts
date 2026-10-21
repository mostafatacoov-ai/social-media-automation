import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

// WhatsApp Cloud API (official Meta API) client + connection settings.

const GRAPH = "https://graph.facebook.com/v21.0";

export interface WhatsAppCreds {
  phoneNumberId: string;
  wabaId: string;
  token: string; // permanent System User access token
  verifyToken: string; // any string you choose, also set in the Meta webhook config
}

interface WhatsAppSettings extends WhatsAppCreds {
  autoReplyCompanies: string[]; // company ids with AI auto-reply enabled
}

async function readSettings(): Promise<WhatsAppSettings> {
  const row = await prisma.setting.findUnique({ where: { key: "whatsapp" } });
  if (!row) {
    return { phoneNumberId: "", wabaId: "", token: "", verifyToken: "", autoReplyCompanies: [] };
  }
  try {
    const s = JSON.parse(row.value);
    return {
      phoneNumberId: s.phoneNumberId || "",
      wabaId: s.wabaId || "",
      token: s.token ? decrypt(s.token) : "",
      verifyToken: s.verifyToken ? decrypt(s.verifyToken) : "",
      autoReplyCompanies: Array.isArray(s.autoReplyCompanies) ? s.autoReplyCompanies : [],
    };
  } catch {
    return { phoneNumberId: "", wabaId: "", token: "", verifyToken: "", autoReplyCompanies: [] };
  }
}

export async function getWhatsAppCreds(): Promise<WhatsAppCreds> {
  const s = await readSettings();
  return { phoneNumberId: s.phoneNumberId, wabaId: s.wabaId, token: s.token, verifyToken: s.verifyToken };
}

// Masked for the client; empty fields keep their saved values.
export async function getWhatsAppMasked() {
  const s = await readSettings();
  return {
    phoneNumberId: s.phoneNumberId,
    wabaId: s.wabaId,
    token: s.token ? "••••••••" + s.token.slice(-4) : "",
    verifyToken: s.verifyToken ? "configured" : "",
    autoReplyCompanies: s.autoReplyCompanies,
    connected: Boolean(s.phoneNumberId && s.token),
  };
}

export async function saveWhatsAppCreds(update: Partial<WhatsAppCreds>) {
  const current = await readSettings();
  const row = await prisma.setting.findUnique({ where: { key: "whatsapp" } });
  const stored = row ? JSON.parse(row.value) : {};
  const next = {
    ...stored,
    phoneNumberId: update.phoneNumberId ?? current.phoneNumberId,
    wabaId: update.wabaId ?? current.wabaId,
    token: update.token && !update.token.startsWith("•") ? encrypt(update.token.trim()) : stored.token || "",
    verifyToken:
      update.verifyToken && !update.verifyToken.startsWith("•")
        ? encrypt(update.verifyToken.trim())
        : stored.verifyToken || "",
    autoReplyCompanies: current.autoReplyCompanies,
  };
  await prisma.setting.upsert({
    where: { key: "whatsapp" },
    update: { value: JSON.stringify(next) },
    create: { key: "whatsapp", value: JSON.stringify(next) },
  });
}

export async function setAutoReply(companyId: string, enabled: boolean) {
  const s = await readSettings();
  const set = new Set(s.autoReplyCompanies);
  if (enabled) set.add(companyId);
  else set.delete(companyId);
  const row = await prisma.setting.findUnique({ where: { key: "whatsapp" } });
  const stored = row ? JSON.parse(row.value) : {};
  await prisma.setting.upsert({
    where: { key: "whatsapp" },
    update: { value: JSON.stringify({ ...stored, autoReplyCompanies: [...set] }) },
    create: { key: "whatsapp", value: JSON.stringify({ autoReplyCompanies: [...set] }) },
  });
}

export async function isAutoReplyEnabled(companyId: string) {
  const s = await readSettings();
  return s.autoReplyCompanies.includes(companyId);
}

// ── Cloud API calls ────────────────────────────────────────────

async function waPost(creds: WhatsAppCreds, body: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${creds.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `WhatsApp API error ${res.status}: ${JSON.stringify(data?.error || data).slice(0, 300)}`
    );
  }
  return data as { messages?: { id: string }[] };
}

export async function sendText(creds: WhatsAppCreds, to: string, text: string) {
  const r = await waPost(creds, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text, preview_url: true },
  });
  return r.messages?.[0]?.id || "";
}

export async function sendImage(creds: WhatsAppCreds, to: string, publicUrl: string, caption = "") {
  const r = await waPost(creds, {
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: { link: publicUrl, caption: caption || undefined },
  });
  return r.messages?.[0]?.id || "";
}

export async function sendTemplate(
  creds: WhatsAppCreds,
  to: string,
  templateName: string,
  language: string,
  params: string[]
) {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language || "en" },
      ...(params.length
        ? {
            components: [
              {
                type: "body",
                parameters: params.map((p) => ({ type: "text", text: p })),
              },
            ],
          }
        : {}),
    },
  };
  const r = await waPost(creds, body);
  return r.messages?.[0]?.id || "";
}

export async function markRead(creds: WhatsAppCreds, messageId: string) {
  try {
    await waPost(creds, {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });
  } catch {
    /* non-fatal */
  }
}
