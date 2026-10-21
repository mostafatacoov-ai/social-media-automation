import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

// App-wide settings stored as JSON rows in the Setting table.
// Secrets (API keys / OAuth client secrets) are encrypted at rest.

export interface BrandingSettings {
  appName: string;
  tagline: string;
  accent: string;
  logoUrl: string; // media path like /api/media/uploads/logo.png, or "" for none
}

export const DEFAULT_BRANDING: BrandingSettings = {
  appName: "Social Studio",
  tagline: "AI social media marketing platform",
  accent: "#d4a94f",
  logoUrl: "",
};

export type TextProviderId = "openrouter" | "openai" | "anthropic" | "google";
export type ImageProviderId = "openai" | "google";

export interface AiSettings {
  textProvider: TextProviderId;
  textModel: string;
  imageProvider: ImageProviderId | "none";
  imageModel: string;
  providers: Record<string, { apiKey: string; baseUrl?: string }>;
}

export const DEFAULT_AI: AiSettings = {
  textProvider: "openrouter",
  textModel: "openai/gpt-4o-mini",
  imageProvider: "none",
  imageModel: "gpt-image-1",
  providers: {
    openrouter: { apiKey: "" },
    openai: { apiKey: "" },
    anthropic: { apiKey: "" },
    google: { apiKey: "" },
  },
};

export interface ConnectionCreds {
  clientId: string;
  clientSecret: string;
}

export type ConnectionsSettings = Record<string, ConnectionCreds>;

async function getRaw(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setRaw(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getBranding(): Promise<BrandingSettings> {
  const raw = await getRaw("branding");
  if (!raw) return DEFAULT_BRANDING;
  try {
    return { ...DEFAULT_BRANDING, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BRANDING;
  }
}

export async function saveBranding(b: Partial<BrandingSettings>) {
  const current = await getBranding();
  await setRaw("branding", JSON.stringify({ ...current, ...b }));
  return { ...current, ...b };
}

export async function getAiSettings(): Promise<AiSettings> {
  const raw = await getRaw("ai");
  let s = DEFAULT_AI;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      s = {
        ...DEFAULT_AI,
        ...parsed,
        providers: { ...DEFAULT_AI.providers, ...(parsed.providers || {}) },
      };
    } catch {
      /* keep defaults */
    }
  }
  // Decrypt API keys (stored encrypted)
  const out: AiSettings = { ...s, providers: {} };
  for (const [id, cfg] of Object.entries(s.providers)) {
    out.providers[id] = {
      ...cfg,
      apiKey: cfg.apiKey ? decrypt(cfg.apiKey) : "",
    };
  }
  return out;
}

// Returns settings with keys masked — safe to send to the client.
export async function getAiSettingsMasked() {
  const s = await getAiSettings();
  const masked: AiSettings = {
    ...s,
    providers: Object.fromEntries(
      Object.entries(s.providers).map(([id, cfg]) => [
        id,
        { ...cfg, apiKey: cfg.apiKey ? "••••••••" + cfg.apiKey.slice(-4) : "" },
      ])
    ),
  };
  return masked;
}

export async function saveAiSettings(update: Partial<AiSettings>) {
  const current = await getAiSettings();
  const next: AiSettings = { ...current, ...update };
  // Merge provider configs; encrypt any new plaintext keys.
  // Masked values ("••••…", sent back untouched by the settings form) keep the saved key.
  next.providers = Object.fromEntries(
    Object.entries({ ...current.providers, ...(update.providers || {}) }).map(
      ([id, cfg]) => {
        const newKey = update.providers?.[id]?.apiKey;
        const useNew =
          newKey && newKey.trim() && !newKey.startsWith("•")
            ? newKey.trim()
            : null;
        return [
          id,
          { ...cfg, apiKey: useNew ? encrypt(useNew) : current.providers[id]?.apiKey || "" },
        ];
      }
    )
  );
  await setRaw("ai", JSON.stringify(next));
}

export async function getConnections(): Promise<ConnectionsSettings> {
  const raw = await getRaw("connections");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const out: ConnectionsSettings = {};
    for (const [id, cfg] of Object.entries(parsed)) {
      const c = cfg as ConnectionCreds;
      out[id] = {
        clientId: c.clientId || "",
        clientSecret: c.clientSecret ? decrypt(c.clientSecret) : "",
      };
    }
    return out;
  } catch {
    return {};
  }
}

export async function getConnectionsMasked() {
  const c = await getConnections();
  return Object.fromEntries(
    Object.entries(c).map(([id, cfg]) => [
      id,
      { clientId: cfg.clientId, clientSecret: cfg.clientSecret ? "••••••••" : "" },
    ])
  );
}

export async function saveConnectionCreds(
  platform: string,
  creds: ConnectionCreds
) {
  // Read raw so existing encrypted secrets are preserved when not re-entered.
  const raw = await getRaw("connections");
  const parsed = raw ? JSON.parse(raw) : {};
  const next = {
    ...parsed,
    [platform]: {
      clientId: creds.clientId ?? parsed[platform]?.clientId ?? "",
      clientSecret: creds.clientSecret
        ? encrypt(creds.clientSecret)
        : parsed[platform]?.clientSecret ?? "",
    },
  };
  await setRaw("connections", JSON.stringify(next));
}
