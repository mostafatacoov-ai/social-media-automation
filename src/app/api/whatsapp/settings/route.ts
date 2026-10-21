import { NextRequest, NextResponse } from "next/server";
import {
  getWhatsAppCreds,
  getWhatsAppMasked,
  saveWhatsAppCreds,
  setAutoReply,
} from "@/lib/whatsapp";
import { errorResponse, parseJsonBody, requireUser } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json(await getWhatsAppMasked());
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireUser();
    const body = await parseJsonBody<{
      phoneNumberId?: string;
      wabaId?: string;
      token?: string;
      verifyToken?: string;
      autoReply?: { companyId: string; enabled: boolean };
    }>(req);

    if (body.autoReply) {
      await setAutoReply(body.autoReply.companyId, body.autoReply.enabled);
    }
    const creds: Record<string, string> = {};
    if (body.phoneNumberId !== undefined) creds.phoneNumberId = body.phoneNumberId;
    if (body.wabaId !== undefined) creds.wabaId = body.wabaId;
    if (body.token !== undefined) creds.token = body.token;
    if (body.verifyToken !== undefined) creds.verifyToken = body.verifyToken;
    if (Object.keys(creds).length > 0) {
      await saveWhatsAppCreds(creds);
    }
    return NextResponse.json(await getWhatsAppMasked());
  } catch (e) {
    return errorResponse(e);
  }
}

// Quick connectivity test.
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    await parseJsonBody(req).catch(() => ({}));
    const creds = await getWhatsAppCreds();
    if (!creds.phoneNumberId || !creds.token) {
      return NextResponse.json({ error: "Add the phone number ID and token first." }, { status: 400 });
    }
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${creds.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating&access_token=${creds.token}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: `Meta rejected the credentials (${res.status}): ${JSON.stringify(data?.error || data).slice(0, 200)}` },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      name: data.verified_name,
      phone: data.display_phone_number,
      quality: data.quality_rating,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
