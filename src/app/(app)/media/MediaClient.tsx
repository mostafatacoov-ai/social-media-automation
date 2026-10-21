"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Trash2, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader, Spinner, Tabs, EmptyState, Stagger, StaggerItem } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { timeAgo } from "@/lib/utils";
import { useRef } from "react";

interface Asset {
  id: string;
  kind: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: string;
  companyId: string | null;
}

const KINDS: Record<string, string> = {
  ai_image: "AI image",
  template_image: "Design",
  scene_image: "Reel scene",
  reel_video: "Reel video",
  audio: "Audio",
  music: "Music",
  logo: "Logo",
  upload: "Upload",
};

export function MediaClient() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [tab, setTab] = useState("all");
  const uploadRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await api<{ assets: Asset[] }>("/api/media-assets");
    setAssets(res.assets);
  }
  useEffect(() => {
    load().catch((e) => toast(e.message, "error"));
  }, []);

  async function remove(a: Asset) {
    if (!confirm("Delete this asset?")) return;
    try {
      await api(`/api/media-assets?id=${a.id}`, { method: "DELETE" });
      setAssets((prev) => prev?.filter((x) => x.id !== a.id) || null);
      toast("Deleted", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "upload");
    try {
      await api("/api/upload", { method: "POST", body: fd });
      toast("Uploaded", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    }
  }

  const filtered = (assets || []).filter((a) => tab === "all" || a.kind === tab);
  const counts = (assets || []).reduce<Record<string, number>>((acc, a) => {
    acc[a.kind] = (acc[a.kind] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Media Library"
        subtitle="Every AI image, rendered design, scene and reel video generated in the app."
        actions={
          <>
            <input ref={uploadRef} type="file" accept="image/*,video/*,audio/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button variant="outline" onClick={() => uploadRef.current?.click()}>
              <Upload size={15} /> Upload
            </Button>
          </>
        }
      />
      {!assets ? (
        <Spinner label="Loading media…" />
      ) : assets.length === 0 ? (
        <EmptyState icon={<ImageIcon size={40} />} title="No media yet" description="Generated images, designs and reel videos will appear here." />
      ) : (
        <>
          <Tabs
            tabs={[
              { id: "all", label: "All", count: assets.length },
              ...Object.keys(counts).map((k) => ({ id: k, label: KINDS[k] || k, count: counts[k] })),
            ]}
            active={tab}
            onChange={setTab}
          />
          <Stagger className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {filtered.map((a) => (
              <StaggerItem key={a.id}>
              <Card className="overflow-hidden transition-shadow hover:shadow-md">
                <div className="relative aspect-square bg-slate-100">
                  {a.mimeType.startsWith("video/") ? (
                    <video src={`/api/media/${a.filePath}`} className="h-full w-full object-cover" preload="metadata" />
                  ) : a.mimeType.startsWith("audio/") ? (
                    <div className="flex h-full items-center justify-center text-slate-300"><audio controls src={`/api/media/${a.filePath}`} className="w-11/12" /></div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/media/${a.filePath}`} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                  <div className="absolute right-1.5 top-1.5 flex gap-1">
                    <a
                      href={`/api/media/${a.filePath}`}
                      download
                      className="rounded-lg bg-white/90 p-1.5 text-slate-600 shadow hover:text-slate-900"
                      title="Download"
                    >
                      <Download size={13} />
                    </a>
                    <button
                      onClick={() => remove(a)}
                      className="rounded-lg bg-white/90 p-1.5 text-rose-500 shadow hover:text-rose-700"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="px-3 py-2">
                  <Badge color="slate">{KINDS[a.kind] || a.kind}</Badge>
                  <div className="mt-1 text-[10px] text-slate-400">
                    {timeAgo(a.createdAt)}
                    {a.sizeBytes ? ` · ${(a.sizeBytes / 1024 / 1024).toFixed(1)} MB` : ""}
                  </div>
                </div>
              </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </>
      )}
    </div>
  );
}
