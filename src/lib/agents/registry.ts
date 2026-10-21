// The AI workforce. Each agent has a speciality and appears in the
// "AI Agents" page where the client can see who is working and what it does.

export interface AgentDef {
  key: string;
  name: string;
  emoji: string;
  color: string;
  title: string;
  description: string;
  capabilities: string[];
  /** Which quick task this agent accepts manually (see /api/agents/[key]/run) */
  manualTask?: "copywriter" | "designer" | "director" | "analyst";
  worksVia: string;
}

export const AGENTS: AgentDef[] = [
  {
    key: "strategist",
    name: "Layla",
    emoji: "🧠",
    color: "#8b5cf6",
    title: "Strategy Agent",
    description:
      "Builds complete marketing plans: objectives, KPIs, audience personas, content pillars, per-platform strategies, hashtag strategy and the week-by-week content calendar.",
    capabilities: ["Marketing plans", "Personas", "Content pillars", "KPIs"],
    worksVia: "Autopilot step 1 · Marketing Plans page",
  },
  {
    key: "copywriter",
    name: "Omar",
    emoji: "✍️",
    color: "#0ea5e9",
    title: "Copywriter Agent",
    description:
      "Writes scroll-stopping captions in Arabic or English, tuned per platform culture (Instagram, X, LinkedIn, TikTok…), in the company's tone of voice with hashtags.",
    capabilities: ["Captions", "Hashtags", "AR/EN", "Platform tone"],
    manualTask: "copywriter",
    worksVia: "Autopilot step 2 · Post composer · Quick task",
  },
  {
    key: "designer",
    name: "Noor",
    emoji: "🎨",
    color: "#f59e0b",
    title: "Designer Agent",
    description:
      "Creates branded visuals: on-brand template designs (quotes, stats, announcements, showcases) in company colors with Arabic support, plus AI-generated imagery.",
    capabilities: ["Template designs", "AI images", "Brand colors", "Arabic layouts"],
    manualTask: "designer",
    worksVia: "Autopilot step 3 · Post composer · Quick task",
  },
  {
    key: "director",
    name: "Rayan",
    emoji: "🎬",
    color: "#ec4899",
    title: "Video Director Agent",
    description:
      "Directs vertical reels: writes the scene-by-scene script, art-directs AI scene images, adds voiceover and composes the final 1080×1920 branded video.",
    capabilities: ["Reel scripts", "Scene images", "Voiceover", "Rendering"],
    manualTask: "director",
    worksVia: "Autopilot step 4 · Reels studio · Quick task",
  },
  {
    key: "scheduler",
    name: "Sara",
    emoji: "📅",
    color: "#10b981",
    title: "Scheduler Agent",
    description:
      "Plans the content calendar: spreads posts across the week at each platform's best posting times and queues them for automatic publishing.",
    capabilities: ["Best-time posting", "Calendar spread", "Queueing"],
    worksVia: "Autopilot step 5 · Calendar page",
  },
  {
    key: "publisher",
    name: "Adam",
    emoji: "🚀",
    color: "#ef4444",
    title: "Publisher Agent",
    description:
      "Runs around the clock: picks up scheduled posts every minute, publishes to Instagram, Facebook, LinkedIn, X and TikTok, retries failures and keeps the log.",
    capabilities: ["Auto-publish", "Retries", "Publish log", "Multi-platform"],
    worksVia: "Always on (every minute) · Autopilot step 6",
  },
  {
    key: "analyst",
    name: "Hind",
    emoji: "📊",
    color: "#64748b",
    title: "Analyst Agent",
    description:
      "Reviews results after each run: what was created, scheduled and published per platform, and what to do next to grow engagement.",
    capabilities: ["Run reports", "Publish stats", "Next actions"],
    manualTask: "analyst",
    worksVia: "Autopilot step 7 · Quick task",
  },
];

export const AGENT_MAP: Record<string, AgentDef> = Object.fromEntries(
  AGENTS.map((a) => [a.key, a])
);
