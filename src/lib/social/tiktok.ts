import fs from "fs";
import crypto from "crypto";
import { apiFetch, PublishInput, PublishResult, SocialPublisher, socialError } from "./types";

// TikTok Content Posting API — direct post with SINGLE_PUT file upload.
// Note: unaudited apps can only post as SELF_ONLY (private) on the connected account.

async function publish(input: PublishInput): Promise<PublishResult> {
  const token = input.account.accessToken;
  const video = input.medias.find((m) => m.mimeType.startsWith("video/"));
  if (!video) {
    throw socialError("tiktok", 400, "TikTok posts require a video. Attach a reel video to the post.");
  }

  const stat = fs.statSync(video.absPath);
  const size = stat.size;

  const init = (await apiFetch("tiktok", "https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      post_info: {
        title: input.caption.slice(0, 150),
        privacy_level: "SELF_ONLY",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: size,
        total_chunk_count: 1,
      },
    }),
  })) as {
    data?: { publish_id?: string; upload_url?: string };
  };
  const publishId = init.data?.publish_id;
  const uploadUrl = init.data?.upload_url;
  if (!publishId || !uploadUrl) {
    throw socialError("tiktok", 500, "Failed to initialize TikTok upload (is the app approved for Content Posting API?)");
  }

  const buf = fs.readFileSync(video.absPath);
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    body: new Uint8Array(buf),
  });
  if (!res.ok) throw socialError("tiktok", res.status, await res.text());

  return {
    externalId: publishId,
    message: "Uploaded to TikTok. Unaudited apps post as private (SELF_ONLY) — open TikTok to review/publish.",
  };
}

export const tiktokPublisher: SocialPublisher = { platform: "tiktok", publish };
