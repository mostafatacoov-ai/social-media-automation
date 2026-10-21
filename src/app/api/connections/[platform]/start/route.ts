import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConnections } from "@/lib/settings";
import { buildAuthorize } from "@/lib/social/oauth";
import { errorResponse } from "@/lib/api-helpers";

// Starts the OAuth flow: returns/redirects to the platform's authorize URL.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;
    const companyId = new URL(req.url).searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    const creds = (await getConnections())[platform];
    if (!creds?.clientId || !creds?.clientSecret) {
      return NextResponse.json(
        { error: `Add the ${platform} client ID and secret in Settings → Connections first.` },
        { status: 400 }
      );
    }
    const redirectUri = `${process.env.PUBLIC_BASE_URL || new URL(req.url).origin}/api/connections/${platform}/callback`;
    const { url, codeVerifier } = buildAuthorize(platform, creds, redirectUri, companyId);
    if (codeVerifier) {
      const store = await cookies();
      store.set("ss_pkce", codeVerifier, {
        httpOnly: true,
        maxAge: 600,
        path: "/",
        sameSite: "lax",
      });
    }
    return NextResponse.redirect(url);
  } catch (e) {
    return errorResponse(e);
  }
}
