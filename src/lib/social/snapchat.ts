import crypto from "crypto";
import { PublishInput, PublishResult, SocialPublisher } from "./types";

// Snapchat has no public third-party posting API.
// Content is generated at 1080×1920 and exported for manual publishing.
export const snapchatPublisher: SocialPublisher = {
  platform: "snapchat",
  async publish(input: PublishInput): Promise<PublishResult> {
    return {
      externalId: crypto.randomUUID(),
      manual: true,
      message: `Ready for manual posting on Snapchat. Media: ${
        input.medias.map((m) => m.publicUrl).join(", ") || "(no media)"
      }`,
    };
  },
};
