import fs from "fs";
import { apiFetch, PublishInput, PublishResult, SocialPublisher, socialError } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";

async function fbPublish(input: PublishInput): Promise<PublishResult> {
  const pageId = input.account.externalId;
  const token = input.account.accessToken;
  const media = input.medias[0];

  if (!media && input.contentType !== "text") {
    // text-only post to page feed
    const res = (await apiFetch("meta", `${GRAPH}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input.caption, access_token: token }),
    })) as { id?: string; post_id?: string };
    const id = res.post_id || res.id || "";
    return { externalId: id, externalUrl: `https://facebook.com/${id}` };
  }

  if (!media) {
    const res = (await apiFetch("meta", `${GRAPH}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input.caption, access_token: token }),
    })) as { id?: string; post_id?: string };
    const id = res.post_id || res.id || "";
    return { externalId: id, externalUrl: `https://facebook.com/${id}` };
  }

  if (media.mimeType.startsWith("video/")) {
    const form = new FormData();
    form.append("description", input.caption);
    form.append("access_token", token);
    const buf = fs.readFileSync(media.absPath);
    form.append("source", new Blob([new Uint8Array(buf)], { type: media.mimeType }), "video.mp4");
    const res = (await apiFetch("meta", `${GRAPH}/${pageId}/videos`, {
      method: "POST",
      body: form,
    })) as { id?: string };
    return { externalId: res.id || "", externalUrl: res.id ? `https://facebook.com/${res.id}` : undefined };
  }

  // Photo post (multipart upload works from local files)
  const form = new FormData();
  form.append("caption", input.caption);
  form.append("access_token", token);
  const buf = fs.readFileSync(media.absPath);
  form.append("source", new Blob([new Uint8Array(buf)], { type: media.mimeType }), "image.png");
  const res = (await apiFetch("meta", `${GRAPH}/${pageId}/photos`, {
    method: "POST",
    body: form,
  })) as { id?: string; post_id?: string };
  const id = res.post_id || res.id || "";
  return { externalId: id, externalUrl: id ? `https://facebook.com/${id}` : undefined };
}

async function igPublish(input: PublishInput): Promise<PublishResult> {
  const igUserId = input.account.externalId;
  const token = input.account.accessToken;
  const media = input.medias[0];

  if (!media) {
    throw socialError("instagram", 400, "Instagram requires at least one image or video. Add media to the post.");
  }

  // Instagram's container API fetches media by public URL.
  const isVideo = media.mimeType.startsWith("video/");
  const params = new URLSearchParams({
    caption: input.caption,
    access_token: token,
  });
  if (isVideo) {
    params.set("media_type", "REELS");
    params.set("video_url", media.publicUrl);
    params.set("share_to_feed", "true");
  } else {
    params.set("image_url", media.publicUrl);
  }

  const container = (await apiFetch("meta", `${GRAPH}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })) as { id?: string };

  if (!container.id) throw socialError("meta", 500, "No container id returned");
  const creationId = container.id;

  // Poll container status (video needs processing)
  if (isVideo) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const status = (await apiFetch(
        "meta",
        `${GRAPH}/${creationId}?fields=status_code&access_token=${token}`,
        { method: "GET" }
      )) as { status_code?: string };
      if (status.status_code === "FINISHED") break;
      if (status.status_code === "ERROR") {
        throw socialError("meta", 500, "Instagram video processing failed. Is the video URL public?");
      }
    }
  }

  const published = (await apiFetch("meta", `${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  })) as { id?: string };
  return {
    externalId: published.id || "",
    externalUrl: published.id ? `https://instagram.com/p/${published.id}` : undefined,
  };
}

export const metaFacebookPublisher: SocialPublisher = { platform: "meta_facebook", publish: fbPublish };
export const metaInstagramPublisher: SocialPublisher = { platform: "meta_instagram", publish: igPublish };
