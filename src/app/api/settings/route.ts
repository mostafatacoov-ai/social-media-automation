import { NextRequest, NextResponse } from "next/server";
import {
  getAiSettingsMasked,
  getBranding,
  getConnectionsMasked,
  saveAiSettings,
  saveBranding,
  saveConnectionCreds,
  AiSettings,
  BrandingSettings,
  ConnectionCreds,
} from "@/lib/settings";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requireUser();
    const [branding, ai, connections] = await Promise.all([
      getBranding(),
      getAiSettingsMasked(),
      getConnectionsMasked(),
    ]);
    return NextResponse.json({ branding, ai, connections });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<{
      branding?: Partial<BrandingSettings>;
      ai?: Partial<AiSettings>;
      connection?: { platform: string; creds: ConnectionCreds };
    }>(req);

    if (body.branding) await saveBranding(body.branding);
    if (body.ai) await saveAiSettings(body.ai);
    if (body.connection?.platform) {
      await saveConnectionCreds(body.connection.platform, body.connection.creds);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
