"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Misc";
import { PlatformChip, StatusBadge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

interface Post {
  id: string;
  caption: string;
  platform: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  company?: { name: string };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function CalendarClient() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState(() => new Date());

  useEffect(() => {
    api<{ posts: Post[] }>("/api/posts?status=all")
      .then((r) => setPosts(r.posts))
      .catch((e) => toast(e.message, "error"));
  }, []);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  function postsOn(d: Date) {
    if (!posts) return [];
    return posts.filter((p) => {
      const t = p.scheduledAt || p.publishedAt;
      if (!t) return false;
      return sameDay(new Date(t), d);
    });
  }

  const monthLabel = cursor.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const today = new Date();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">Scheduled and published posts across all platforms.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft size={14} />
          </Button>
          <span className="min-w-40 text-center text-sm font-bold text-slate-800">{monthLabel}</span>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
        </div>
      </div>

      {!posts ? (
        <Spinner label="Loading calendar…" />
      ) : (
        <motion.div
          key={monthLabel}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {DAY_NAMES.map((d) => (
              <div key={d} className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const dayPosts = postsOn(d);
              const isToday = sameDay(d, today);
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-28 border-b border-r border-slate-100 p-1.5",
                    !inMonth && "bg-slate-50/60 text-slate-300"
                  )}
                >
                  <div className={cn("mb-1 px-1 text-[11px] font-bold", isToday ? "text-[var(--accent)]" : inMonth ? "text-slate-400" : "")}>
                    {d.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayPosts.slice(0, 3).map((p) => (
                      <Link
                        key={p.id}
                        href={`/posts/new?id=${p.id}`}
                        className="block truncate rounded bg-accent-soft px-1.5 py-1 text-[10px] text-slate-700 hover:bg-[var(--accent-ring)]"
                        title={`${p.caption} — ${p.status}`}
                      >
                        <span className="mr-1 align-middle"><PlatformChip platform={p.platform} /></span>
                        {p.caption || "Post"}
                      </Link>
                    ))}
                    {dayPosts.length > 3 && (
                      <div className="px-1 text-[10px] text-slate-400">+{dayPosts.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
