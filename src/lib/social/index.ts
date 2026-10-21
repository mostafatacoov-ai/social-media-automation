import { SocialPublisher } from "./types";
import { metaFacebookPublisher, metaInstagramPublisher } from "./meta";
import { linkedinPublisher } from "./linkedin";
import { xPublisher } from "./x";
import { tiktokPublisher } from "./tiktok";
import { snapchatPublisher } from "./snapchat";

const PUBLISHERS: Record<string, SocialPublisher> = {
  meta_facebook: metaFacebookPublisher,
  meta_instagram: metaInstagramPublisher,
  linkedin: linkedinPublisher,
  x: xPublisher,
  tiktok: tiktokPublisher,
  snapchat: snapchatPublisher,
};

export function getPublisher(platform: string): SocialPublisher {
  const p = PUBLISHERS[platform];
  if (!p) throw new Error(`No publisher for platform "${platform}"`);
  return p;
}

export * from "./types";
