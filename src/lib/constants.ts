export type PlatformId =
  | "meta_instagram"
  | "meta_facebook"
  | "linkedin"
  | "x"
  | "tiktok"
  | "snapchat";

export interface PlatformMeta {
  id: PlatformId;
  label: string;
  short: string;
  publishMode: "api" | "manual";
  color: string;
  needsPublicUrl: boolean;
  setupHint: string;
}

export const PLATFORMS: PlatformMeta[] = [
  {
    id: "meta_instagram",
    label: "Instagram",
    short: "IG",
    publishMode: "api",
    color: "#e1306c",
    needsPublicUrl: true,
    setupHint:
      "Meta app with instagram_basic, instagram_content_publish, pages_show_list, pages_manage_posts permissions. Media must be reachable by URL (set PUBLIC_BASE_URL to a public URL when running locally).",
  },
  {
    id: "meta_facebook",
    label: "Facebook Page",
    short: "FB",
    publishMode: "api",
    color: "#1877f2",
    needsPublicUrl: false,
    setupHint:
      "Meta app with pages_show_list, pages_manage_posts, pages_read_engagement permissions.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    short: "IN",
    publishMode: "api",
    color: "#0a66c2",
    needsPublicUrl: false,
    setupHint:
      "LinkedIn app with 'Sign In with LinkedIn using OpenID Connect' + 'Share on LinkedIn' products.",
  },
  {
    id: "x",
    label: "X (Twitter)",
    short: "X",
    publishMode: "api",
    color: "#111827",
    needsPublicUrl: false,
    setupHint: "X Developer app with OAuth 2.0 (scopes: tweet.read tweet.write users.read offline.access).",
  },
  {
    id: "tiktok",
    label: "TikTok",
    short: "TT",
    publishMode: "api",
    color: "#000000",
    needsPublicUrl: true,
    setupHint:
      "TikTok app with Content Posting API (video.publish, video.upload, user.info.basic). Unaudited apps can only post as private/draft on the connected account.",
  },
  {
    id: "snapchat",
    label: "Snapchat",
    short: "SC",
    publishMode: "manual",
    color: "#fffc00",
    needsPublicUrl: false,
    setupHint:
      "Snapchat has no public third-party posting API. Social Studio generates correctly-sized content (1080×1920) and exports it for manual publishing.",
  },
];

export const PLATFORM_MAP: Record<string, PlatformMeta> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p])
);

export const CONTENT_TYPES = [
  { id: "text", label: "Text only" },
  { id: "image", label: "Image post" },
  { id: "carousel", label: "Carousel" },
  { id: "reel", label: "Reel / video" },
];

export const POST_STATUSES = [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "needs_manual",
];

export const REEL_TEMPLATES = [
  { id: "minimal", label: "Minimal Text", desc: "Bold statements on brand gradient" },
  { id: "showcase", label: "Showcase", desc: "Product/project showcase with feature bullets" },
  { id: "stats", label: "Stats & Numbers", desc: "Impact numbers and data highlights" },
  { id: "story", label: "Story", desc: "Problem → solution → CTA narrative" },
  { id: "announcement", label: "Announcement", desc: "Event, launch or offer announcement" },
];

export const TTS_VOICES = [
  { id: "ar-SA-ZariyahNeural", label: "Arabic (Saudi) — Zariyah, female" },
  { id: "ar-SA-HamedNeural", label: "Arabic (Saudi) — Hamed, male" },
  { id: "ar-EG-SalmaNeural", label: "Arabic (Egypt) — Salma, female" },
  { id: "en-US-AriaNeural", label: "English (US) — Aria, female" },
  { id: "en-US-GuyNeural", label: "English (US) — Guy, male" },
  { id: "en-GB-SoniaNeural", label: "English (UK) — Sonia, female" },
];

export const LANGUAGES = [
  { id: "ar", label: "Arabic" },
  { id: "en", label: "English" },
  { id: "both", label: "Arabic + English" },
];
