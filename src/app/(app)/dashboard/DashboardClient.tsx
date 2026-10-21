"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Building2, PenLine, Video, ClipboardList, CalendarClock, Plug, Sparkles, ArrowRight, Bot } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Misc";
import { NetworkGraph, GraphNodeInput } from "@/components/ui/NetworkGraph";
import { PlatformChip, StatusBadge } from "@/components/ui/Badge";
import { AGENTS } from "@/lib/agents/registry";
import { PLATFORMS } from "@/lib/constants";
import { api } from "@/lib/client";
import { formatDate, timeAgo } from "@/lib/utils";

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const from = ref.current;
    const duration = 700;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else ref.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display}</>;
}

interface Analytics {
  companies: number;
  postsByStatus: { status: string; count: number }[];
  postsByPlatform: { platform: string; count: number }[];
  reels: number;
  plans: number;
  accounts: number;
  upcoming: { id: string; caption: string; platform: string; scheduledAt: string; company: { name: string } }[];
  recentLogs: { id: string; status: string; message: string | null; createdAt: string; post: { caption: string; platform: string } }[];
  recentPosts: { id: string; caption: string; status: string; createdAt: string; company: { name: string } }[];
}

export function DashboardClient() {
  const [data, setData] = useState<Analytics | null>(null);
  const [health, setHealth] = useState<{ media: boolean; aiTextConfigured: boolean; aiImageConfigured: boolean } | null>(null);

  useEffect(() => {
    api<Analytics>("/api/analytics").then(setData).catch(() => {});
    api<{ media: boolean; aiTextConfigured: boolean; aiImageConfigured: boolean }>("/api/system/health")
      .then(setHealth)
      .catch(() => setHealth({ media: false, aiTextConfigured: false, aiImageConfigured: false }));
  }, []);

  // Nodes for the interactive 3D content universe
  const graphNodes = useMemo<GraphNodeInput[]>(() => {
    const platformHref: Record<string, string> = {
      meta_instagram: "/posts",
      meta_facebook: "/posts",
      linkedin: "/posts",
      x: "/posts",
      tiktok: "/reels",
      snapchat: "/posts",
    };
    const platformLabel: Record<string, string> = { meta_facebook: "Facebook" };
    const counts = new Map((data?.postsByPlatform || []).map((p) => [p.platform, p.count]));
    const platforms: GraphNodeInput[] = PLATFORMS.map((p) => ({
      id: p.id,
      label: platformLabel[p.id] || p.label,
      sub: `${counts.get(p.id) || 0} posts`,
      color: p.color,
      href: platformHref[p.id] || "/posts",
      kind: "platform",
    }));
    platforms.push({ id: "whatsapp", label: "WhatsApp", sub: "Inbox", color: "#25d366", href: "/whatsapp", kind: "platform" });
    const agents: GraphNodeInput[] = AGENTS.map((a) => ({
      id: a.key,
      label: a.name,
      sub: a.title.replace(" Agent", ""),
      color: a.color,
      href: "/agents",
      kind: "agent",
    }));
    return [{ id: "hub", label: "Studio", color: "#d4a94f", kind: "hub" }, ...platforms, ...agents];
  }, [data]);

  if (!data) return <Spinner label="Loading dashboard…" />;

  const statusCount = (s: string) => data.postsByStatus.find((x) => x.status === s)?.count || 0;
  const totalPosts = data.postsByStatus.reduce((a, b) => a + b.count, 0);
  const checklist = [
    { done: data.companies > 0, label: "Create a company", href: "/companies" },
    { done: Boolean(health?.aiTextConfigured), label: "Add an AI provider key", href: "/settings" },
    { done: data.accounts > 0, label: "Connect a social account", href: "/settings" },
    { done: Boolean(health?.media), label: "Start the media service (npm run media)", href: "/settings" },
  ];
  const allDone = checklist.every((c) => c.done);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Everything across your companies: content, plans, reels and publishing.</p>
      </div>

      {/* Hero: interactive 3D content universe + AI team */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3"
      >
        <Card className="relative overflow-hidden lg:col-span-2">
          <div className="pointer-events-none absolute left-5 top-4 z-10">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2dd4bf] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2dd4bf]" />
              </span>
              <h3 className="text-sm font-bold tracking-tight text-slate-900">Content universe</h3>
              <span className="micro-label !text-[9px]">live</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Your platforms and AI agents, orbiting the studio.</p>
          </div>
          <div className="pointer-events-none absolute right-5 top-4 z-10 flex items-center gap-1.5 text-[11px] text-slate-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 12h8M12 8v8"/></svg>
            Drag to rotate · click a node
          </div>
          <div className="h-[380px] w-full">
            <NetworkGraph nodes={graphNodes} />
          </div>
          <div className="pointer-events-none absolute bottom-4 left-5 z-10 flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#e8c877] shadow-[0_0_8px_#e8c877]" />Platforms</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2dd4bf] shadow-[0_0_8px_#2dd4bf]" />AI agents</span>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          {/* AI team banner */}
          <Link href="/agents">
            <Card className="group relative flex-1 overflow-hidden p-5 transition-all hover:shadow-[0_0_0_1px_var(--accent-ring),0_10px_36px_-14px_var(--accent)]">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-soft)] via-transparent to-transparent" />
              <div className="relative flex flex-wrap items-center gap-4">
                <motion.div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-2xl text-[#171207]"
                  animate={{ rotate: [0, 6, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 4, repeatDelay: 1 }}
                >
                  <Bot size={24} />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-900">Your AI marketing team is ready</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    8 agents run your content on Autopilot — plan, write, design, film, schedule, publish, analyze, reply.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--gold-bright)] transition-all group-hover:gap-2">
                  Meet the agents <ArrowRight size={13} />
                </span>
              </div>
            </Card>
          </Link>

          {/* Setup checklist */}
          <Card className="flex-1">
            <CardHeader title="Setup checklist" />
            <div className="space-y-3 p-5">
              {allDone ? (
                <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
                  All set! Generate a <Link href="/plans" className="font-bold underline">marketing plan</Link> or jump straight to <Link href="/posts/new" className="font-bold underline">creating a post</Link>.
                </div>
              ) : (
                checklist.map((c) => (
                  <Link key={c.label} href={c.href} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 text-xs hover:border-[var(--accent)]">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        c.done
                          ? "bg-emerald-100 text-emerald-600"
                          : "border border-white/15 bg-transparent text-slate-500"
                      }`}
                    >
                      {c.done ? "✓" : ""}
                    </span>
                    <span className={c.done ? "text-slate-400 line-through" : "text-slate-700"}>{c.label}</span>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Stat cards */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
        className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {[
          { label: "Companies", value: data.companies, icon: Building2, href: "/companies" },
          { label: "Posts", value: totalPosts, icon: PenLine, href: "/posts", sub: `${statusCount("scheduled")} scheduled · ${statusCount("published")} published` },
          { label: "Reels", value: data.reels, icon: Video, href: "/reels" },
          { label: "Marketing plans", value: data.plans, icon: ClipboardList, href: "/plans" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              whileHover={{ y: -3 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
            >
              <Link href={s.href}>
                <Card className="group relative overflow-hidden p-5 transition-all hover:shadow-[0_0_0_1px_var(--accent-ring),0_10px_36px_-14px_var(--accent)]">
                  <div className="flex items-start justify-between">
                    <motion.div
                      whileHover={{ rotate: 8, scale: 1.1 }}
                      className="rounded-xl bg-accent-soft p-2.5 text-[var(--gold-bright)] shadow-[inset_0_0_0_1px_var(--hairline-soft)]"
                    >
                      <Icon size={18} />
                    </motion.div>
                  </div>
                  <div className="kpi-digit mt-4 text-[42px] leading-none text-slate-900">
                    <CountUp value={s.value} />
                  </div>
                  <div className="micro-label mt-2">{s.label}</div>
                  {s.sub && <div className="mt-1 text-[11px] text-slate-400">{s.sub}</div>}
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Upcoming */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Upcoming scheduled posts"
            actions={<Link href="/calendar" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline">Calendar <ArrowRight size={12} /></Link>}
          />
          <div className="divide-y divide-slate-100">
            {data.upcoming.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-slate-400">Nothing scheduled yet.</p>
            )}
            {data.upcoming.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <PlatformChip platform={p.platform} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700">{p.caption || "(no caption)"}</p>
                  <p className="text-[11px] text-slate-400">{p.company.name}</p>
                </div>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <CalendarClock size={12} /> {formatDate(p.scheduledAt, true)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Publish log */}
        <Card className="lg:col-span-2">
          <CardHeader title="Recent publishing activity" />
          <div className="divide-y divide-slate-100">
            {data.recentLogs.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-slate-400">No publishing activity yet.</p>
            )}
            {data.recentLogs.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                <PlatformChip platform={l.post.platform} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={l.status} />
                    <p className="truncate text-xs text-slate-600">{l.post.caption || l.post.platform}</p>
                  </div>
                  {l.message && l.status !== "published" && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{l.message}</p>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">{timeAgo(l.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader title="Quick actions" />
          <div className="space-y-2 p-5">
            {[
              { href: "/posts/new", label: "New AI post", icon: Sparkles },
              { href: "/reels", label: "Create a reel", icon: Video },
              { href: "/plans", label: "Generate marketing plan", icon: ClipboardList },
              { href: "/settings", label: "Connect accounts", icon: Plug },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <Icon size={15} /> {a.label}
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
