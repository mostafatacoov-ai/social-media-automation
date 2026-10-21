import fs from "fs";
import crypto from "crypto";
import { apiFetch, PublishInput, PublishResult, SocialPublisher, socialError } from "./types";

// X (Twitter) — v2 tweets + v2 media upload with OAuth 2.0 user context token.

async function uploadMedia(token: string, media: PublishInput["medias"][0]): Promise<string> {
  const buf = fs.readFileSync(media.absPath);
  const form = new FormData();
  form.append("media", new Blob([new Uint8Array(buf)], { type: media.mimeType }), "media");
  form.append("media_category", media.mimeType.startsWith("video/") ? "tweet_video" : "tweet_image");
  const res = (await apiFetch("x", "https://api.x.com/2/media/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })) as {
    data?: { id?: string; processing_info?: { state?: string; check_after_secs?: number } };
  };
  let mediaId = res.data?.id;
  if (!mediaId) throw socialError("x", 500, "Media upload returned no id");

  // Poll video processing
  let processing = res.data?.processing_info;
  let guard = 0;
  while (processing && processing.state !== "succeeded" && guard++ < 30) {
    await new Promise((r) => setTimeout(r, (processing!.check_after_secs || 2) * 1000));
    const status = (await apiFetch("x", `https://api.x.com/2/media/upload?media_id=${mediaId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })) as { data?: { id?: string; processing_info?: { state?: string; check_after_secs?: number } } };
    mediaId = status.data?.id || mediaId;
    processing = status.data?.processing_info;
    if (processing?.state === "failed") throw socialError("x", 500, "Video processing failed");
  }
  return mediaId;
}

async function publish(input: PublishInput): Promise<PublishResult> {
  const token = input.account.accessToken;
  let mediaId: string | undefined;
  if (input.medias[0]) {
    mediaId = await uploadMedia(token, input.medias[0]);
  }
  const payload: Record<string, unknown> = { text: input.caption.slice(0, 280) };
  if (mediaId) payload.media = { media_ids: [mediaId] };
  const res = (await apiFetch("x", "https://api.x.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })) as { data?: { id?: string } };
  const id = res.data?.id || crypto.randomUUID();
  return { externalId: id, externalUrl: `https://x.com/i/status/${id}` };
}

export const xPublisher: SocialPublisher = { platform: "x", publish };
