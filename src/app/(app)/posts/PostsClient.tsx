"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PenLine, Plus, Rocket, Trash2, Pencil, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader, Spinner, EmptyState, Tabs, Stagger, StaggerItem } from "@/components/ui/Misc";
import { PlatformChip, StatusBadge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { formatDate } from "@/lib/utils";

interface MediaAssetLite {
  id: string;
  filePath: string;
  mimeType: string;
}
interface Post {
  id: string;
  platform: string;
  contentType: string;
  caption: string;
  hashtags: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
  error: string | null;
  company?: { name: string };
  campaign?: { name: string } | null;
  medias: { mediaAsset: MediaAssetLite }[];
}

export function PostsClient() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [tab, setTab] = useState("all");
  const [busy, setBusy] = useState("");

  async function load() {
    const res = await api<{ posts: Post[] }>(`/api/posts?status=${tab}`);
    setPosts(res.posts);
  }
  useEffect(() => {
    load().catch((e) => toast(e.message, "error"));
  }, [tab]);

  async function publishNow(p: Post) {
    setBusy(p.id);
    try {
      const res = await api<{ status: string; message?: string }>(`/api/posts/${p.id}/publish`, {
        method: "POST",
        json: {},
      });
      if (res.status === "published") toast("Published successfully", "success");
      else if (res.status === "needs_manual") toast(res.message || "Ready for manual posting", "info");
      else toast(res.message || `Publish failed: ${res.status}`, "error");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy("");
    }
  }

  async function remove(p: Post) {
    if (!confirm("Delete this post?")) return;
    try {
      await api(`/api/posts/${p.id}`, { method: "DELETE" });
      toast("Post deleted", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  const counts = (posts || []).reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Posts"
        subtitle="AI-written posts with branded media, scheduled and published automatically."
        actions={
          <Link href="/posts/new">
            <Button><Plus size={15} /> New post</Button>
          </Link>
        }
      />
      <Tabs
        tabs={[
          { id: "all", label: "All" },
          { id: "draft", label: "Drafts", count: counts.draft },
          { id: "scheduled", label: "Scheduled", count: counts.scheduled },
          { id: "published", label: "Published", count: counts.published },
          { id: "failed", label: "Failed", count: counts.failed },
          { id: "needs_manual", label: "Manual", count: counts.needs_manual },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {!posts ? (
          <Spinner label="Loading posts…" />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<PenLine size={40} />}
            title="No posts here yet"
            description="Create a post with AI captions and branded images, or generate a marketing plan and materialize its calendar into drafts."
            action={
              <Link href="/posts/new">
                <Button><Plus size={15} /> Create your first post</Button>
              </Link>
            }
          />
        ) : (
          <Stagger className="space-y-3">
            {posts.map((p) => (
              <StaggerItem key={p.id}>
              <Card className="flex items-center gap-4 p-4 transition-shadow hover:shadow-md">
                <PlatformChip platform={p.platform} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-800">{p.caption || "(no caption)"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <StatusBadge status={p.status} />
                    {p.campaign && <span>· {p.campaign.name}</span>}
                    {p.scheduledAt && <span>· {formatDate(p.scheduledAt, true)}</span>}
                    {p.publishedAt && <span>· published {formatDate(p.publishedAt, true)}</span>}
                    {p.medias.length > 0 && (
                      <span className="flex items-center gap-1">
                        ·
                        {p.medias.slice(0, 3).map((m, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={`/api/media/${m.mediaAsset.filePath}`}
                            alt=""
                            className={`h-8 w-8 rounded object-cover ${m.mediaAsset.mimeType.startsWith("video/") ? "hidden" : ""}`}
                          />
                        ))}
                        {p.medias[0]?.mediaAsset.mimeType.startsWith("video/") && "🎬 video"}
                      </span>
                    )}
                  </div>
                  {p.error && <p className="mt-1 line-clamp-1 text-[11px] text-rose-500">{p.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {p.externalUrl && (
                    <a
                      href={p.externalUrl}
                      target="_blank"
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="View on platform"
                    >
                      <Download size={14} />
                    </a>
                  )}
                  {(p.status === "draft" || p.status === "failed") && (
                    <button
                      onClick={() => publishNow(p)}
                      disabled={busy === p.id}
                      className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                      title="Publish now"
                    >
                      <Rocket size={14} className={busy === p.id ? "animate-pulse" : ""} />
                    </button>
                  )}
                  {p.status === "failed" && (
                    <button
                      onClick={() => publishNow(p)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Retry"
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                  <Link
                    href={`/posts/new?id=${p.id}`}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </Link>
                  <button
                    onClick={() => remove(p)}
                    className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  );
}
