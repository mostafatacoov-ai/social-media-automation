import { NextResponse } from "next/server";
import { publishDuePosts } from "@/lib/publish";
import { errorResponse } from "@/lib/api-helpers";

// External cron entry point (e.g. Windows Task Scheduler / Vercel Cron hitting this URL every minute).
export async function GET() {
  try {
    const published = await publishDuePosts();
    return NextResponse.json({ ok: true, published });
  } catch (e) {
    return errorResponse(e);
  }
}
