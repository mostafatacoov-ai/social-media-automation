// Prompt builders for captions, marketing plans and reel scripts.
// All prompts are bilingual-aware (Arabic / English) and company-branded.

export interface CompanyBrief {
  name: string;
  industry: string;
  description: string;
  targetAudience: string;
  toneOfVoice: string;
  city: string;
  website: string;
}

export interface CampaignBrief {
  name?: string;
  objective?: string;
  description?: string;
  targetAudience?: string;
}

function companyBlock(c: CompanyBrief): string {
  return [
    `Company name: ${c.name}`,
    c.industry && `Industry: ${c.industry}`,
    c.description && `About: ${c.description}`,
    (c.targetAudience || c.targetAudience) && `Target audience: ${c.targetAudience}`,
    `Tone of voice: ${c.toneOfVoice}`,
    c.city && `City/country: ${c.city}`,
    c.website && `Website: ${c.website}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function campaignBlock(c?: CampaignBrief): string {
  if (!c?.name) return "No specific campaign — general content.";
  return [
    `Campaign: ${c.name}`,
    c.objective && `Campaign objective: ${c.objective}`,
    c.description && `Campaign brief: ${c.description}`,
    c.targetAudience && `Campaign audience: ${c.targetAudience}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const langInstruction = (language: string) =>
  language === "ar"
    ? "Write ALL text content in Arabic (Modern Standard Arabic with a natural Gulf-friendly tone)."
    : language === "en"
    ? "Write ALL text content in English."
    : "Write ALL text content in BOTH Arabic first, then English, separated by a blank line.";

// ============ CAPTIONS ============

export interface CaptionRequest {
  company: CompanyBrief;
  campaign?: CampaignBrief;
  platform: string;
  contentType: string;
  topic: string;
  language: string; // ar | en | both
  count: number;
  extraContext?: string;
}

export interface CaptionVariant {
  caption: string;
  hashtags: string;
}

const PLATFORM_RULES: Record<string, string> = {
  meta_instagram:
    "Instagram: warm, visual language, 3-4 short paragraphs max, emoji allowed (2-6), end with a call to action. 5-15 relevant hashtags.",
  meta_facebook:
    "Facebook: conversational, storytelling angle, 1-3 paragraphs, moderate emoji use (1-4), question or CTA at the end. 3-6 hashtags.",
  linkedin:
    "LinkedIn: professional and insight-driven, lead with a hook or statistic, 150-250 words, minimal emoji (0-2), industry hashtags 3-5.",
  x: "X (Twitter): max 260 characters, punchy single idea, 1-2 emoji max, 0-2 hashtags.",
  tiktok:
    "TikTok: casual, trend-aware hook in the first line, short caption (under 150 characters), 3-5 hashtags.",
  snapchat: "Snapchat: playful, ultra-short (under 100 characters), direct and personal, 0-1 hashtags.",
};

export function captionPrompts(req: CaptionRequest): { system: string; user: string } {
  const rules = PLATFORM_RULES[req.platform] || "Write an engaging social media caption.";
  const system = `You are an expert social media copywriter for brands. You write scroll-stopping, authentic, high-converting captions tailored to each platform's culture and format. ${langInstruction(
    req.language
  )} Return ONLY valid JSON, no markdown fences, no commentary.`;

  const user = `Write ${req.count} different caption options for a social media post.

COMPANY:
${companyBlock(req.company)}

CAMPAIGN:
${campaignBlock(req.campaign)}

TOPIC / BRIEF FOR THIS POST:
${req.topic || "Choose a fresh, relevant topic for this company and campaign."}
${req.extraContext ? `\nEXTRA CONTEXT:\n${req.extraContext}` : ""}

PLATFORM RULES — ${rules}

REQUIREMENTS:
- Match the company's tone of voice.
- Each option must take a clearly different angle (e.g. educational, story, promotional, question, behind-the-scenes).
- Include the caption text and a separate hashtags string.

Return JSON in exactly this shape:
{"variants":[{"caption":"...","hashtags":"#tag1 #tag2"}]}`;

  return { system, user };
}

// ============ MARKETING PLAN ============

export interface PlanRequest {
  company: CompanyBrief;
  campaign?: CampaignBrief;
  platforms: string[];
  weeks: number;
  language: string;
  goals?: string;
  budget?: string;
}

export function marketingPlanPrompts(req: PlanRequest): { system: string; user: string } {
  const system = `You are a senior social media strategist who builds complete, actionable marketing plans for real businesses. You are specific, realistic and metric-driven — never generic filler. ${langInstruction(
    req.language
  )} Return ONLY valid JSON, no markdown fences, no commentary. All string values must be plain text (no nested markdown).`;

  const user = `Build a complete ${req.weeks}-week social media marketing plan.

COMPANY:
${companyBlock(req.company)}

CAMPAIGN:
${campaignBlock(req.campaign)}

PLATFORMS TO COVER: ${req.platforms.join(", ")}
${req.goals ? `BUSINESS GOALS: ${req.goals}` : ""}
${req.budget ? `BUDGET: ${req.budget}` : ""}

The plan must include, for the TOTAL duration of ${req.weeks} weeks:
1. Executive summary (3-5 sentences)
2. 3-5 SMART objectives
3. 4-6 KPIs with concrete targets
4. 2-3 audience personas
5. Brand messaging: tagline suggestion, voice guidelines, 3-5 key messages
6. 4-5 content pillars, each with: name, description, percentage of the content mix (must total 100), and 3 example topics
7. A strategy per platform: approach, best content types, posting frequency per week, best posting times
8. A week-by-week content calendar covering EVERY week (week 1 through ${req.weeks}), each week with a theme and 4-7 day entries. Each day entry: day name, platform (from the list above), content type (post/image/carousel/reel/story), which pillar it belongs to, the specific topic, and the call to action. Distribute across platforms sensibly — do not put everything on one platform.
9. Hashtag strategy per platform (8-15 tags each, mix of niche and broad)
10. 2-4 paid boost suggestions (platform, audience, objective, note)
11. Budget allocation guidance (channel + percent + note) — percents should total 100
12. Measurement plan: review cadence and what to check

Return JSON in exactly this shape:
{
 "executiveSummary": "...",
 "objectives": ["..."],
 "kpis": [{"name":"...","target":"..."}],
 "personas": [{"name":"...","description":"...","interests":"...","platforms":"..."}],
 "messaging": {"tagline":"...","voiceGuidelines":"...","keyMessages":["..."]},
 "contentPillars": [{"name":"...","description":"...","mix":25,"exampleTopics":["...","...","..."]}],
 "platformStrategies": [{"platform":"...","strategy":"...","postTypes":"...","frequency":"...","bestTimes":"..."}],
 "weeklyCalendar": [{"week":1,"theme":"...","days":[{"day":"Sunday","platform":"...","contentType":"...","pillar":"...","topic":"...","cta":"..."}]}],
 "hashtags": [{"platform":"...","tags":["..."]}],
 "paidSuggestions": [{"platform":"...","audience":"...","budget":"...","objective":"...","note":"..."}],
 "budgetAllocation": [{"channel":"...","percent":40,"note":"..."}],
 "measurement": {"cadence":"...","tools":"...","reviewPoints":["..."]}
}`;

  return { system, user };
}

// ============ REEL SCRIPT ============

export interface ReelScriptRequest {
  company: CompanyBrief;
  campaign?: CampaignBrief;
  template: string; // minimal | showcase | stats | story | announcement
  topic: string;
  language: string;
  sceneCount: number;
  withVoiceover: boolean;
}

export interface ReelScene {
  text: string;
  imagePrompt: string;
  durationSec: number;
  imagePath?: string; // media-relative path once the scene image is generated
}

export interface ReelScript {
  title: string;
  hook: string;
  scenes: ReelScene[];
  cta: string;
  voiceoverScript: string;
  musicMood: string;
}

const TEMPLATE_GUIDE: Record<string, string> = {
  minimal:
    "Minimal Text style: short bold statements, one idea per scene, large typography, abstract/clean AI backgrounds.",
  showcase:
    "Showcase style: present the product/service/project with a benefit per scene; image prompts should show the offering beautifully (photorealistic).",
  stats:
    "Stats & Numbers style: each scene highlights one impressive number or fact about the company/offer; bold numerals.",
  story:
    "Story style: problem → agitation → solution → proof arc across scenes; relatable situations in image prompts.",
  announcement:
    "Announcement style: build excitement — teaser, big reveal, details, urgency; celebratory visuals.",
};

export function reelScriptPrompts(req: ReelScriptRequest): { system: string; user: string } {
  const system = `You are a short-form video scriptwriter for vertical reels (9:16). You write scroll-stopping hooks and tight, rhythmic scene copy. ${langInstruction(
    req.language
  )} Image prompts must ALWAYS be written in English regardless of output language (they go to an image model). Return ONLY valid JSON, no markdown fences.`;

  const user = `Write a reel script.

COMPANY:
${companyBlock(req.company)}

CAMPAIGN:
${campaignBlock(req.campaign)}

TOPIC: ${req.topic}
STYLE TEMPLATE: ${TEMPLATE_GUIDE[req.template] || TEMPLATE_GUIDE.minimal}
SCENES: exactly ${req.sceneCount} scenes, each 3-5 seconds.
${req.withVoiceover ? "Include a full voiceover script (natural spoken language, matches scene order)." : "No voiceover needed — set voiceoverScript to empty string."}

REQUIREMENTS:
- The first scene text is the HOOK: max 8 words, must stop the scroll.
- Scene text: max 14 words each — they render as on-screen text.
- imagePrompt: rich English text-to-image prompt (subject, style, lighting, mood, no text/words/logos in image, no brand names). Consistent visual style across all scenes.
- cta: final on-screen call to action, max 8 words.

Return JSON in exactly this shape:
{
 "title":"...",
 "hook":"...",
 "scenes":[{"text":"...","imagePrompt":"...","durationSec":4}],
 "cta":"...",
 "voiceoverScript":"...",
 "musicMood":"..."
}`;

  return { system, user };
}
