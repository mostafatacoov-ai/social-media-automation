"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Spinner, ProgressBar } from "@/components/ui/Misc";
import { PlatformChip } from "@/components/ui/Badge";
import { api } from "@/lib/client";
import { PLATFORM_MAP } from "@/lib/constants";

interface Analytics {
  companies: number;
  postsByStatus: { status: string; count: number }[];
  postsByPlatform: { platform: string; count: number }[];
  reels: number;
  plans: number;
  accounts: number;
}

export function AnalyticsClient() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    api<Analytics>("/api/analytics").then(setData).catch(() => {});
  }, []);

  if (!data) return <Spinner label="Loading analytics…" />;

  const totalPosts = data.postsByStatus.reduce((a, b) => a + b.count, 0) || 1;
  const maxPlatform = Math.max(...data.postsByPlatform.map((p) => p.count), 1);

  const statuses: { id: string; label: string; color: string }[] = [
    { id: "draft", label: "Drafts", color: "bg-slate-400" },
    { id: "scheduled", label: "Scheduled", color: "bg-sky-500" },
    { id: "published", label: "Published", color: "bg-emerald-500" },
    { id: "failed", label: "Failed", color: "bg-rose-500" },
    { id: "needs_manual", label: "Manual", color: "bg-amber-500" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Publishing performance from your own data. (Native platform insights — reach, impressions — are on the roadmap.)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Posts by status" subtitle={`${totalPosts} posts total`} />
          <div className="space-y-4 p-5">
            {statuses.map((s) => {
              const count = data.postsByStatus.find((x) => x.status === s.id)?.count || 0;
              return (
                <div key={s.id}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">{s.label}</span>
                    <span className="text-slate-500">{count} ({Math.round((count / totalPosts) * 100)}%)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${(count / totalPlatform(totalPosts)) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Posts by platform" />
          <div className="space-y-4 p-5">
            {data.postsByPlatform.length === 0 && (
              <p className="text-center text-sm text-slate-400">No posts yet.</p>
            )}
            {data.postsByPlatform.map((p) => (
              <div key={p.platform} className="flex items-center gap-3">
                <PlatformChip platform={p.platform} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">{PLATFORM_MAP[p.platform]?.label || p.platform}</span>
                    <span className="text-slate-500">{p.count}</span>
                  </div>
                  <ProgressBar value={(p.count / maxPlatform) * 100} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Content library" />
          <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
            {[
              { label: "Companies", value: data.companies },
              { label: "Connected accounts", value: data.accounts },
              { label: "Reels", value: data.reels },
              { label: "Marketing plans", value: data.plans },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-slate-50 p-4 text-center">
                <div className="text-2xl font-black text-slate-900">{s.value}</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function totalPlatform(n: number) {
  return n || 1;
}
