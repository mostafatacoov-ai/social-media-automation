"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Plus, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, Spinner, EmptyState } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { PLATFORMS } from "@/lib/constants";

interface Plan {
  id: string;
  title: string;
  durationWeeks: number;
  status: string;
  createdAt: string;
  company?: { name: string };
  campaign?: { name: string } | null;
}

interface Option { id: string; name: string }

export function PlansClient() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<Option[]>([]);
  const [campaigns, setCampaigns] = useState<Option[]>([]);
  const [generating, setGenerating] = useState(false);

  const [form, setForm] = useState({
    companyId: "", campaignId: "", weeks: 4, language: "en",
    goals: "", budget: "",
    platforms: ["meta_instagram", "meta_facebook", "linkedin", "x"] as string[],
  });

  async function load() {
    const res = await api<{ plans: Plan[] }>("/api/plans");
    setPlans(res.plans);
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

  function togglePlatform(id: string) {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(id) ? f.platforms.filter((p) => p !== id) : [...f.platforms, id],
    }));
  }

  async function generate() {
    if (!form.companyId) return toast("Create a company first", "error");
    if (form.platforms.length === 0) return toast("Select at least one platform", "error");
    setGenerating(true);
    try {
      const res = await api<{ plan: { id: string } }>("/api/plans", {
        method: "POST",
        json: {
          ...form,
          campaignId: form.campaignId || undefined,
          weeks: Number(form.weeks),
        },
      });
      toast("Marketing plan generated!", "success");
      setOpen(false);
      router.push(`/plans/${res.plan.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Generation failed", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function remove(p: Plan) {
    if (!confirm(`Delete plan "${p.title}"?`)) return;
    try {
      await api(`/api/plans/${p.id}`, { method: "DELETE" });
      toast("Plan deleted", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Marketing Plans"
        subtitle="Complete AI-generated social media strategies: objectives, pillars, per-platform playbooks and week-by-week calendars."
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Generate plan</Button>}
      />
      {!plans ? (
        <Spinner label="Loading plans…" />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={40} />}
          title="No marketing plans yet"
          description="Generate a full strategy for a company and campaign — objectives, personas, content pillars, platform strategies, hashtags and a weekly content calendar you can turn into draft posts."
          action={<Button onClick={() => setOpen(true)}><Plus size={15} /> Generate your first plan</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">{p.title}</div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {p.company?.name}{p.campaign && ` · ${p.campaign.name}`}
                  </div>
                </div>
                <button onClick={() => remove(p)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <Badge color="purple">{p.durationWeeks} weeks</Badge>
                <Badge color="green">{formatDate(p.createdAt)}</Badge>
              </div>
              <Link
                href={`/plans/${p.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                Open plan <ChevronRight size={13} />
              </Link>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Generate marketing plan" wide>
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
              <option value="">— general strategy —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Duration (weeks)">
            <Select value={form.weeks} onChange={(e) => setForm({ ...form, weeks: Number(e.target.value) })}>
              {[1, 2, 4, 6, 8, 12].map((w) => (
                <option key={w} value={w}>{w} week{w > 1 ? "s" : ""}</option>
              ))}
            </Select>
          </Field>
          <Field label="Content language">
            <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option value="ar">Arabic</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Platforms">
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      form.platforms.includes(p.id)
                        ? "border-[var(--accent)] bg-accent-soft text-[var(--accent)]"
                        : "border-slate-200 text-slate-500"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Business goals (optional)">
              <Textarea rows={2} value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} placeholder="e.g. 30% more qualified leads, grow Instagram to 10k followers" />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Budget (optional)">
              <Input value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="e.g. SAR 30,000 total" />
            </Field>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-slate-400">Takes 15–60 seconds depending on the provider.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={generate} loading={generating}><Plus size={15} /> Generate</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
