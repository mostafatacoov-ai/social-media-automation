import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { getConnections } from "@/lib/settings";
import { decodeState, exchangeCallback } from "@/lib/social/oauth";

// OAuth callback: exchanges the code and saves the connected accounts.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const origin = process.env.PUBLIC_BASE_URL || url.origin;
  const back = (msg: string, ok: boolean) =>
    NextResponse.redirect(`${origin}/settings?tab=connections&${ok ? "connected" : "error"}=${encodeURIComponent(msg)}`);

  try {
    if (!code) return back("Authorization was cancelled or failed.", false);
    const { companyId } = decodeState(state);
    const creds = (await getConnections())[platform];
    if (!creds?.clientId || !creds?.clientSecret) {
      return back(`${platform} credentials are missing in Settings.`, false);
    }
    const store = await cookies();
    const codeVerifier = store.get("ss_pkce")?.value || undefined;
    const redirectUri = `${origin}/api/connections/${platform}/callback`;

    const accounts = await exchangeCallback(platform, creds, code, redirectUri, codeVerifier);

    for (const acc of accounts) {
      // Replace any previous account of the same platform+externalId for this company
      await prisma.socialAccount.deleteMany({
        where: { companyId, platform: acc.platform, externalId: acc.externalId },
      });
      await prisma.socialAccount.create({
        data: {
          companyId,
          platform: acc.platform,
          accountName: acc.accountName,
          externalId: acc.externalId,
          accessToken: encrypt(acc.accessToken),
          refreshToken: encrypt(acc.refreshToken || ""),
          meta: JSON.stringify(acc.meta || {}),
        },
      });
    }
    store.delete("ss_pkce");
    return back(`Connected ${accounts.length} account(s): ${accounts.map((a) => a.accountName).join(", ")}`, true);
  } catch (e) {
    return back(e instanceof Error ? e.message : "OAuth callback failed", false);
  }
}
