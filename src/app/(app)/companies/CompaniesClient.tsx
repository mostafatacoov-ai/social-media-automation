"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Plus, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, Spinner, EmptyState, Stagger, StaggerItem } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { LANGUAGES } from "@/lib/constants";

interface Company {
  id: string;
  name: string;
  industry: string;
  description: string;
  targetAudience: string;
  toneOfVoice: string;
  language: string;
  primaryColor: string;
  secondaryColor: string;
  logoPath?: string;
  website: string;
  city: string;
  createdAt: string;
  _count?: { posts: number; campaigns: number; accounts: number; plans: number; reels: number };
}

const EMPTY_FORM = {
  name: "", industry: "", description: "", targetAudience: "",
  toneOfVoice: "professional", language: "both", primaryColor: "#6d28d9",
  secondaryColor: "#0f172a", logoPath: "", website: "", city: "",
};

export function CompaniesClient() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await api<{ companies: Company[] }>("/api/companies");
    setCompanies(res.companies);
  }
  useEffect(() => {
    load().catch((e) => toast(e.message, "error"));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }
  function openEdit(c: Company) {
    setEditing(c);
    setForm({
      name: c.name, industry: c.industry, description: c.description,
      targetAudience: c.targetAudience, toneOfVoice: c.toneOfVoice, language: c.language,
      primaryColor: c.primaryColor, secondaryColor: c.secondaryColor,
      logoPath: c.logoPath || "", website: c.website, city: c.city,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast("Company name is required", "error");
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/companies/${editing.id}`, { method: "PATCH", json: form });
        toast("Company updated", "success");
      } else {
        await api("/api/companies", { method: "POST", json: form });
        toast("Company created", "success");
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Company) {
    if (!confirm(`Delete "${c.name}"? This deletes its posts, campaigns, plans, reels and connections.`)) return;
    try {
      await api(`/api/companies/${c.id}`, { method: "DELETE" });
      toast("Company deleted", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle="Each company is a client workspace with its own brand, campaigns and social accounts."
        actions={<Button onClick={openCreate}><Plus size={15} /> New company</Button>}
      />
      {!companies ? (
        <Spinner label="Loading companies…" />
      ) : companies.length === 0 ? (
        <EmptyState
          icon={<Building2 size={40} />}
          title="No companies yet"
          description="Create your first client company — the AI uses this profile to write captions, plans and reels in the company's voice."
          action={<Button onClick={openCreate}><Plus size={15} /> Create company</Button>}
        />
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((c) => (
            <StaggerItem key={c.id} className="h-full">
            <Card className="h-full p-5 transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white"
                    style={{ background: c.primaryColor }}
                  >
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.industry || "—"}</div>
                  </div>
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
              {c.description && (
                <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-slate-500">{c.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                <Badge color="purple">{c._count?.campaigns ?? 0} campaigns</Badge>
                <Badge color="blue">{c._count?.posts ?? 0} posts</Badge>
                <Badge color="green">{c._count?.accounts ?? 0} connected</Badge>
                <Badge color="slate">{c._count?.reels ?? 0} reels</Badge>
              </div>
            </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : "New company"}
        wide
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Company name" required>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Takamol Consulting" />
          </Field>
          <Field label="Industry">
            <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Real estate consulting" />
          </Field>
          <div className="md:col-span-2">
            <Field label="About the company" hint="Used by the AI as brand context — the more detail, the better the content.">
              <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Target audience">
              <Input value={form.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} placeholder="e.g. Property investors aged 30-55 in Riyadh" />
            </Field>
          </div>
          <Field label="Tone of voice">
            <Select value={form.toneOfVoice} onChange={(e) => set("toneOfVoice", e.target.value)}>
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="luxury">Luxury / premium</option>
              <option value="bold">Bold / energetic</option>
              <option value="educational">Educational</option>
              <option value="playful">Playful</option>
            </Select>
          </Field>
          <Field label="Content language">
            <Select value={form.language} onChange={(e) => set("language", e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Primary brand color">
            <div className="flex gap-2">
              <input type="color" value={form.primaryColor} onChange={(e) => set("primaryColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-slate-300" />
              <Input value={form.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} />
            </div>
          </Field>
          <Field label="Secondary brand color">
            <div className="flex gap-2">
              <input type="color" value={form.secondaryColor} onChange={(e) => set("secondaryColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-slate-300" />
              <Input value={form.secondaryColor} onChange={(e) => set("secondaryColor", e.target.value)} />
            </div>
          </Field>
          <Field label="Logo" hint="Rendered onto generated post designs and reels.">
            <div className="flex items-center gap-3">
              {form.logoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${form.logoPath}`} alt="logo" className="h-10 rounded border border-slate-200 bg-white p-1" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-slate-300 text-slate-300">
                  <Building2 size={16} />
                </div>
              )}
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.append("file", f);
                  fd.append("kind", "logo");
                  fd.append("companyId", editing?.id || "");
                  try {
                    const res = await api<{ asset: { filePath: string } }>("/api/upload", { method: "POST", body: fd });
                    setForm((prev) => ({ ...prev, logoPath: res.asset.filePath }));
                    toast("Logo uploaded — remember to save", "success");
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Upload failed", "error");
                  }
                }}
              />
              <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
                <Upload size={13} /> Upload
              </Button>
              {form.logoPath && (
                <Button variant="ghost" size="sm" onClick={() => setForm((p) => ({ ...p, logoPath: "" }))}>
                  Remove
                </Button>
              )}
            </div>
          </Field>
          <Field label="Website">
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="City / country">
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Riyadh, Saudi Arabia" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save} loading={saving}>{editing ? "Save changes" : "Create company"}</Button>
        </div>
      </Modal>
    </div>
  );
}
