"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Plus, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, Spinner, EmptyState } from "@/components/ui/Misc";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { REEL_TEMPLATES, TTS_VOICES } from "@/lib/constants";

interface Reel {
  id: string;
  title: string;
  template: string;
  status: string;
  progress: number;
  createdAt: string;
  company?: { name: string };
  videoAsset?: { filePath: string } | null;
}
interface Option { id: string; name: string }

export function ReelsClient() {
  const router = useRouter();
  const [reels, setReels] = useState<Reel[] | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [companies, setCompanies] = useState<Option[]>([]);
  const [campaigns, setCampaigns] = useState<Option[]>([]);

  const [form, setForm] = useState({
    companyId: "", campaignId: "", topic: "", template: "minimal",
    language: "en", sceneCount: 5, voiceover: true, voice: "en-US-AriaNeural",
  });

  async function load() {
    const res = await api<{ reels: Reel[] }>("/api/reels");
    setReels(res.reels);
  }
  useEffect(() => {
    load().catch((e) => toast(e.message, "error"));
    api<{ companies: Option[] }>("/api/companies").then((r) => {
      setCompanies(r.companies);
      if (r.companies[0]) setForm((f) => ({ ...f, companyId: r.companies[0].id }));
    });
  }, []);

  useEffect(() => {
    if (!form.companyId) return;
    api<{ campaigns: Option[] }>(`/api/campaigns?companyId=${form.companyId}`)
      .then((r) => setCampaigns(r.campaigns))
      .catch(() => setCampaigns([]));
  }, [form.companyId]);

  async function create() {
    if (!form.topic.trim()) return toast("Describe the reel topic first", "error");
    setCreating(true);
    try {
      const res = await api<{ reel: { id: string } }>("/api/reels", {
        method: "POST",
        json: { ...form, campaignId: form.campaignId || undefined, sceneCount: Number(form.sceneCount) },
      });
      toast("Script generated — add scene images and render", "success");
      setOpen(false);
      router.push(`/reels/${res.reel.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Script generation failed", "error");
    } finally {
      setCreating(false);
    }
  }

  async function remove(r: Reel) {
    if (!confirm(`Delete reel "${r.title}"?`)) return;
    try {
      await api(`/api/reels/${r.id}`, { method: "DELETE" });
      toast("Reel deleted", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Reels"
        subtitle="AI writes the scene script, generates scene images, adds free Arabic/English voiceover and renders a branded 1080×1920 video."
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> New reel</Button>}
      />
      {!reels ? (
        <Spinner label="Loading reels…" />
      ) : reels.length === 0 ? (
        <EmptyState
          icon={<Video size={40} />}
          title="No reels yet"
          description="Describe a topic — the AI writes scene-by-scene copy, generates images per scene, synthesizes a voiceover and renders everything into a ready-to-post vertical video."
          action={<Button onClick={() => setOpen(true)}><Plus size={15} /> Create your first reel</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reels.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">{r.title}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{r.company?.name}</div>
                </div>
                <button onClick={() => remove(r)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <StatusBadge status={r.status} />
                <Badge color="purple">{REEL_TEMPLATES.find((t) => t.id === r.template)?.label || r.template}</Badge>
                <Badge color="slate">{formatDate(r.createdAt)}</Badge>
              </div>
              {r.videoAsset ? (
                <video src={`/api/media/${r.videoAsset.filePath}`} className="mb-3 w-full rounded-lg" controls preload="metadata" />
              ) : null}
              <button
                onClick={() => router.push(`/reels/${r.id}`)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                Open studio <ChevronRight size={13} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New reel" wide>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Company" required>
            <Select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value, campaignId: "" })}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Campaign (optional)">
            <Select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
              <option value="">— none —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="What is the reel about?" required>
              <Textarea
                rows={2}
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="e.g. 5 reasons investors are choosing Riyadh in 2026"
              />
            </Field>
          </div>
          <Field label="Style template">
            <Select value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}>
              {REEL_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>
              ))}
            </Select>
          </Field>
          <Field label="Language">
            <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value, voice: e.target.value === "ar" ? "ar-SA-ZariyahNeural" : "en-US-AriaNeural" })}>
              <option value="ar">Arabic</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field label="Scenes">
            <Select value={form.sceneCount} onChange={(e) => setForm({ ...form, sceneCount: Number(e.target.value) })}>
              {[3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n} scenes</option>
              ))}
            </Select>
          </Field>
          <Field label="Voiceover">
            <Select
              value={form.voiceover ? form.voice : "none"}
              onChange={(e) => setForm({ ...form, voiceover: e.target.value !== "none", voice: e.target.value })}
            >
              <option value="none">No voiceover</option>
              {TTS_VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={create} loading={creating}><Plus size={15} /> Generate script</Button>
        </div>
      </Modal>
    </div>
  );
}
