"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, PenLine, Video, ClipboardList, CalendarClock, Plug, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Misc";
import { PlatformChip, StatusBadge } from "@/components/ui/Badge";
import { api } from "@/lib/client";
import { formatDate, timeAgo } from "@/lib/utils";

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

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Companies", value: data.companies, icon: Building2, href: "/companies" },
          { label: "Posts", value: totalPosts, icon: PenLine, href: "/posts", sub: `${statusCount("scheduled")} scheduled · ${statusCount("published")} published` },
          { label: "Reels", value: data.reels, icon: Video, href: "/reels" },
          { label: "Marketing plans", value: data.plans, icon: ClipboardList, href: "/plans" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="p-5 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-black text-slate-900">{s.value}</div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">{s.label}</div>
                    {s.sub && <div className="mt-1 text-[11px] text-slate-400">{s.sub}</div>}
                  </div>
                  <div className="rounded-xl bg-accent-soft p-2.5 text-[var(--accent)]">
                    <Icon size={18} />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

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

        {/* Setup checklist */}
        <Card>
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
                      c.done ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
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
