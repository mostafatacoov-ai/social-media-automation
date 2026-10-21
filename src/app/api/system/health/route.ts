import { NextResponse } from "next/server";
import { checkMediaService } from "@/lib/media";
import { getAiSettings } from "@/lib/settings";
import { errorResponse } from "@/lib/api-helpers";

export async function GET() {
  try {
    const [media, ai] = await Promise.all([checkMediaService(), getAiSettings()]);
    return NextResponse.json({
      media,
      aiTextConfigured: Boolean(ai.providers[ai.textProvider]?.apiKey),
      aiImageConfigured: ai.imageProvider !== "none" && Boolean(ai.providers[ai.imageProvider]?.apiKey),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
