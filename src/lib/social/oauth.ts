import crypto from "crypto";
import { ConnectionCreds } from "@/lib/settings";

// OAuth2 flows for each platform. Returns account descriptors to persist.

export interface NewSocialAccount {
  platform: string;
  accountName: string;
  externalId: string;
  accessToken: string;
  refreshToken?: string;
  meta?: Record<string, unknown>;
}

export function encodeState(companyId: string): string {
  return Buffer.from(JSON.stringify({ companyId, n: crypto.randomBytes(8).toString("hex") })).toString("base64url");
}

export function decodeState(state: string): { companyId: string } {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid OAuth state");
  }
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { verifier, challenge };
}

export interface StartResult {
  url: string;
  codeVerifier?: string;
}

export function buildAuthorize(
  platform: string,
  creds: ConnectionCreds,
  redirectUri: string,
  companyId: string
): StartResult {
  const state = encodeState(companyId);
  switch (platform) {
    case "meta_facebook":
    case "meta_instagram": {
      const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
      url.searchParams.set("client_id", creds.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set(
        "scope",
        "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish"
      );
      return { url: url.toString() };
    }
    case "linkedin": {
      const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", creds.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("scope", "openid profile w_member_social");
      return { url: url.toString() };
    }
    case "x": {
      const { verifier, challenge } = pkcePair();
      const url = new URL("https://x.com/i/oauth2/authorize");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", creds.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", "tweet.read tweet.write users.read offline.access");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
      return { url: url.toString(), codeVerifier: verifier };
    }
    case "tiktok": {
      const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
      url.searchParams.set("client_key", creds.clientId);
      url.searchParams.set("scope", "user.info.basic,video.publish,video.upload");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      return { url: url.toString() };
    }
    default:
      throw new Error(`No OAuth flow for platform "${platform}"`);
  }
}

async function postForm(url: string, params: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  return body as Record<string, unknown>;
}

export async function exchangeCallback(
  platform: string,
  creds: ConnectionCreds,
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<NewSocialAccount[]> {
  switch (platform) {
    case "meta_facebook":
    case "meta_instagram": {
      // Exchange code → short-lived user token → long-lived → pages (with IG)
      const shortRes = (await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          redirect_uri: redirectUri,
          code,
        })}`,
        { method: "GET" }
      ).then((r) => r.json())) as { access_token?: string; error?: unknown };
      if (!shortRes.access_token) throw new Error("Meta token exchange failed: " + JSON.stringify(shortRes).slice(0, 300));

      const longRes = (await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          fb_exchange_token: shortRes.access_token,
        })}`,
        { method: "GET" }
      ).then((r) => r.json())) as { access_token?: string };
      const userToken = longRes.access_token || shortRes.access_token;

      const pagesRes = (await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?${new URLSearchParams({
          fields: "name,access_token,instagram_business_account{id,username}",
          access_token: userToken,
        })}`,
        { method: "GET" }
      ).then((r) => r.json())) as {
        data?: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[];
        error?: unknown;
      };
      if (pagesRes.error) throw new Error("Failed to list pages: " + JSON.stringify(pagesRes.error).slice(0, 300));

      const accounts: NewSocialAccount[] = [];
      for (const page of pagesRes.data || []) {
        if (page.access_token) {
          accounts.push({
            platform: "meta_facebook",
            accountName: page.name,
            externalId: page.id,
            accessToken: page.access_token,
          });
        }
        const ig = page.instagram_business_account;
        if (ig?.id && page.access_token) {
          accounts.push({
            platform: "meta_instagram",
            accountName: ig.username ? `@${ig.username}` : `${page.name} · Instagram`,
            externalId: ig.id,
            accessToken: page.access_token,
            meta: { username: ig.username || "" },
          });
        }
      }
      if (accounts.length === 0) {
        throw new Error("No Facebook pages found. Make sure your account administers at least one page (Instagram requires a linked business account).");
      }
      return accounts;
    }

    case "linkedin": {
      const tokenRes = await postForm("https://www.linkedin.com/oauth/v2/accessToken", {
        grant_type: "authorization_code",
        code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: redirectUri,
      });
      const token = tokenRes.access_token as string;
      const user = (await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json())) as { sub?: string; name?: string; email?: string };
      if (!user.sub) throw new Error("Failed to fetch LinkedIn profile");
      return [
        {
          platform: "linkedin",
          accountName: user.name || user.email || "LinkedIn member",
          externalId: user.sub,
          accessToken: token,
        },
      ];
    }

    case "x": {
      const tokenRes = await postForm("https://api.x.com/2/oauth2/token", {
        grant_type: "authorization_code",
        code,
        code_verifier: codeVerifier || "",
        client_id: creds.clientId,
        redirect_uri: redirectUri,
      });
      const token = tokenRes.access_token as string;
      const refresh = tokenRes.refresh_token as string | undefined;
      const me = (await fetch("https://api.x.com/2/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json())) as { data?: { id: string; name: string; username: string } };
      if (!me.data) throw new Error("Failed to fetch X profile");
      return [
        {
          platform: "x",
          accountName: `@${me.data.username}`,
          externalId: me.data.id,
          accessToken: token,
          refreshToken: refresh,
        },
      ];
    }

    case "tiktok": {
      const tokenRes = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
        client_key: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      });
      const token = tokenRes.access_token as string;
      const openId = tokenRes.open_id as string;
      const me = (await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
        { headers: { Authorization: `Bearer ${token}` } }
      ).then((r) => r.json())) as { data?: { user?: { display_name?: string } } };
      return [
        {
          platform: "tiktok",
          accountName: me.data?.user?.display_name || "TikTok account",
          externalId: openId,
          accessToken: token,
        },
      ];
    }

    default:
      throw new Error(`No OAuth callback for platform "${platform}"`);
  }
}
