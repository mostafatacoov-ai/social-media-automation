// Social platform publisher adapters.

export interface PublishMedia {
  absPath: string;
  publicUrl: string; // absolute URL the platform servers can fetch
  mimeType: string;
}

export interface PublishAccount {
  accountName: string;
  externalId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date | null;
  meta: Record<string, unknown>;
}

export interface PublishInput {
  caption: string;
  medias: PublishMedia[];
  contentType: string; // text | image | carousel | reel | video
  account: PublishAccount;
}

export interface PublishResult {
  externalId: string;
  externalUrl?: string;
  manual?: boolean; // export-mode platforms
  message?: string;
}

export interface SocialPublisher {
  platform: string;
  publish(input: PublishInput): Promise<PublishResult>;
}

export function socialError(platform: string, status: number, detail: unknown): Error {
  let msg = `${platform} API error ${status}`;
  if (typeof detail === "string") msg += `: ${detail.slice(0, 300)}`;
  else if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    if (d.error) msg += `: ${JSON.stringify(d.error).slice(0, 300)}`;
    else if (d.detail) msg += `: ${JSON.stringify(d.detail).slice(0, 300)}`;
    else msg += `: ${JSON.stringify(detail).slice(0, 300)}`;
  }
  return new Error(msg);
}

export async function apiFetch(
  platform: string,
  url: string,
  init: RequestInit
): Promise<unknown> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  if (!res.ok) throw socialError(platform, res.status, body);
  return body;
}
