"use client";

import { useEffect, useState } from "react";
import { Megaphone, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, Spinner, EmptyState, Stagger, StaggerItem } from "@/components/ui/Misc";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { formatDate } from "@/lib/utils";

interface Campaign {
  id: string;
  name: string;
  objective: string;
  description: string;
  targetAudience: string;
  startDate: string | null;
  endDate: string | null;
  budget: string;
  status: string;
  company?: { name: string };
  _count?: { posts: number; plans: number; reels: number };
}

const OBJECTIVES = [
  { id: "awareness", label: "Brand awareness" },
  { id: "engagement", label: "Engagement" },
  { id: "leads", label: "Lead generation" },
  { id: "traffic", label: "Website traffic" },
  { id: "sales", label: "Sales / conversions" },
];

const EMPTY = {
  name: "", objective: "awareness", description: "", targetAudience: "",
  startDate: "", endDate: "", budget: "", status: "active",
};

export function CampaignsClient() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await api<{ campaigns: Campaign[] }>("/api/campaigns");
    setCampaigns(res.campaigns);
  }
  useEffect(() => {
    load().catch((e) => toast(e.message, "error"));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setOpen(true);
  }
  function openEdit(c: Campaign) {
    setEditing(c);
    setForm({
      name: c.name, objective: c.objective, description: c.description,
      targetAudience: c.targetAudience,
      startDate: c.startDate ? c.startDate.slice(0, 10) : "",
      endDate: c.endDate ? c.endDate.slice(0, 10) : "",
      budget: c.budget, status: c.status,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast("Campaign name is required", "error");
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/campaigns/${editing.id}`, { method: "PATCH", json: form });
        toast("Campaign updated", "success");
      } else {
        await api("/api/campaigns", { method: "POST", json: form });
        toast("Campaign created", "success");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Campaign) {
    if (!confirm(`Delete campaign "${c.name}"?`)) return;
    try {
      await api(`/api/campaigns/${c.id}`, { method: "DELETE" });
      toast("Campaign deleted", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle="Campaigns focus the AI: posts, plans and reels generated for a campaign follow its objective and audience."
        actions={<Button onClick={openCreate}><Plus size={15} /> New campaign</Button>}
      />
      {!campaigns ? (
        <Spinner label="Loading campaigns…" />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={40} />}
          title="No campaigns yet"
          description="Create a campaign (e.g. 'Ramadan offers' or 'Q4 awareness') and then generate posts and marketing plans under it."
          action={<Button onClick={openCreate}><Plus size={15} /> Create campaign</Button>}
        />
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <StaggerItem key={c.id} className="h-full">
            <Card className="h-full p-5 transition-shadow hover:shadow-md">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">{c.name}</div>
                  {c.company && <div className="mt-0.5 text-xs text-slate-400">{c.company.name}</div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => remove(c)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <StatusBadge status={c.status} />
                <Badge color="purple">{OBJECTIVES.find((o) => o.id === c.objective)?.label || c.objective}</Badge>
              </div>
              {c.description && <p className="mb-3 line-clamp-2 text-xs text-slate-500">{c.description}</p>}
              <div className="text-[11px] text-slate-400">
                {formatDate(c.startDate)} → {formatDate(c.endDate)}
                {c.budget && ` · Budget: ${c.budget}`}
              </div>
              <div className="mt-3 flex gap-1.5">
                <Badge color="blue">{c._count?.posts ?? 0} posts</Badge>
                <Badge color="slate">{c._count?.plans ?? 0} plans</Badge>
                <Badge color="green">{c._count?.reels ?? 0} reels</Badge>
              </div>
            </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : "New campaign"} wide>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Campaign name" required>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Summer listings push" />
          </Field>
          <Field label="Objective">
            <Select value={form.objective} onChange={(e) => set("objective", e.target.value)}>
              {OBJECTIVES.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Description / brief">
              <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What is this campaign about? Key messages, offers, dates…" />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Target audience (optional — overrides company default)">
              <Input value={form.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} />
            </Field>
          </div>
          <Field label="Start date">
            <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          <Field label="End date">
            <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </Field>
          <Field label="Budget (optional)">
            <Input value={form.budget} onChange={(e) => set("budget", e.target.value)} placeholder="e.g. SAR 20,000" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </Select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} loading={saving}>{editing ? "Save changes" : "Create campaign"}</Button>
        </div>
      </Modal>
    </div>
  );
}
