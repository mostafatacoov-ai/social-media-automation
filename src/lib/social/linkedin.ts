import fs from "fs";
import crypto from "crypto";
import { apiFetch, PublishInput, PublishResult, SocialPublisher, socialError } from "./types";

// LinkedIn UGC posts (member share) with optional image upload.

async function uploadImage(
  token: string,
  authorUrn: string,
  media: PublishInput["medias"][0]
): Promise<string> {
  const register = (await apiFetch("linkedin", "https://api.linkedin.com/v2/assets?action=registerUpload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: authorUrn,
        serviceRelationships: [
          { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
        ],
      },
    }),
  })) as {
    value?: {
      asset?: string;
      uploadMechanism?: {
        "com.linkedin.digitalmedia.uploading.MultipartUpload"?: { uploadUrl?: string; uploadInstructions?: unknown[] };
      };
    };
  };
  const asset = register.value?.asset;
  const uploadUrl =
    register.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MultipartUpload"]?.uploadUrl;
  if (!asset || !uploadUrl) throw socialError("linkedin", 500, "Image registration failed");

  const buf = fs.readFileSync(media.absPath);
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": media.mimeType },
    body: new Uint8Array(buf),
  });
  if (!res.ok) throw socialError("linkedin", res.status, await res.text());

  // Wait briefly for the asset to be processed
  await new Promise((r) => setTimeout(r, 3000));
  return asset;
}

async function publish(input: PublishInput): Promise<PublishResult> {
  const token = input.account.accessToken;
  const memberId = input.account.externalId;
  const authorUrn = `urn:li:person:${memberId}`;

  let mediaUrn: string | null = null;
  const first = input.medias[0];
  if (first && first.mimeType.startsWith("image/")) {
    mediaUrn = await uploadImage(token, authorUrn, first);
  }

  const body: Record<string, unknown> = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: input.caption },
        shareMediaCategory: mediaUrn ? "IMAGE" : "NONE",
        ...(mediaUrn
          ? {
              media: [
                {
                  status: "READY",
                  description: { text: input.caption.slice(0, 200) },
                  media: mediaUrn,
                  title: { text: "Post" },
                },
              ],
            }
          : {}),
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const res = (await apiFetch("linkedin", "https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": "202405",
    },
    body: JSON.stringify(body),
  })) as { id?: string };
  return {
    externalId: res.id || crypto.randomUUID(),
    externalUrl: res.id ? `https://www.linkedin.com/feed/update/${res.id}` : undefined,
  };
}

export const linkedinPublisher: SocialPublisher = { platform: "linkedin", publish };
