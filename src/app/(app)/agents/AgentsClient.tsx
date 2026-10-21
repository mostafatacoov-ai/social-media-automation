"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Form";
import { PageHeader, Spinner } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";
import { PLATFORMS } from "@/lib/constants";
import type { AgentDef } from "@/lib/agents/registry";

interface RunStep {
  t: number;
  msg: string;
}
interface AgentRunRow {
  id: string;
  agentKey: string;
  action: string;
  status: string;
  steps: RunStep[];
  output: unknown;
  createdAt: string;
}
interface ApStep {
  key: string;
  label: string;
  status: string;
  note: string;
}
interface AgentsData {
  agents: AgentDef[];
  running: string[];
  runs: AgentRunRow[];
  stats: Record<string, number>;
  autopilot: { id: string; status: string; currentStep: number; steps: ApStep[]; createdAt: string } | null;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 24 } },
};

export function AgentsClient() {
  const [data, setData] = useState<AgentsData | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string; language: string }[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    companyId: "",
    campaignId: "",
    weeks: 2,
    includeReel: true,
    language: "en",
    platforms: ["meta_instagram", "meta_facebook", "linkedin", "x"] as string[],
  });
  const [launching, setLaunching] = useState(false);
  const [quickBusy, setQuickBusy] = useState("");
  const [quickResult, setQuickResult] = useState<Record<string, unknown>>({});
  const [quickForm, setQuickForm] = useState<Record<string, string>>({});
  const firstLoad = useRef(true);

  useEffect(() => {
    api<{ companies: { id: string; name: string; language: string }[] }>("/api/companies").then((r) => {
      setCompanies(r.companies);
      if (r.companies[0]) {
        setForm((f) => ({
          ...f,
          companyId: r.companies[0].id,
          language: r.companies[0].language === "both" ? "ar" : r.companies[0].language,
        }));
      }
    });
  }, []);

  useEffect(() => {
    if (!form.companyId) return;
    api<{ campaigns: { id: string; name: string }[] }>(`/api/campaigns?companyId=${form.companyId}`)
      .then((r) => setCampaigns(r.campaigns))
      .catch(() => setCampaigns([]));
  }, [form.companyId]);

  // Live polling — the page feels alive while agents work
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const qs = form.companyId ? `?companyId=${form.companyId}` : "";
        const res = await api<AgentsData>(`/api/agents${qs}`);
        if (alive) setData(res);
      } catch {
        /* keep last state */
      } finally {
        if (alive && firstLoad.current) firstLoad.current = false;
      }
    };
    load();
    const t = setInterval(load, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [form.companyId]);

  async function launch() {
    if (!form.companyId) return toast("Create a company first", "error");
    setLaunching(true);
    try {
      await api("/api/autopilot", {
        method: "POST",
        json: { ...form, campaignId: form.campaignId || undefined, weeks: Number(form.weeks) },
      });
      toast("Autopilot launched — watch the team work below", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Launch failed", "error");
    } finally {
      setLaunching(false);
    }
  }

  async function runQuick(agent: AgentDef) {
    if (!agent.manualTask || !form.companyId) return;
    setQuickBusy(agent.key);
    try {
      const res = await api<Record<string, unknown>>(`/api/agents/${agent.key}/run`, {
        method: "POST",
        json: { ...quickForm, companyId: form.companyId, language: form.language },
      });
      setQuickResult((r) => ({ ...r, [agent.key]: res }));
      toast(`${agent.name} finished the task`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Task failed", "error");
    } finally {
      setQuickBusy("");
    }
  }

  if (!data) return <Spinner label="Waking up the agents…" />;

  const ap = data.autopilot;
  const apRunning = ap?.status === "running";

  return (
    <div>
      <PageHeader
        title="AI Agents"
        subtitle="Your always-on marketing team. Launch Autopilot and watch every agent pick up its part of the work — live."
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* ── Autopilot ─────────────────────────────────── */}
        <motion.div variants={item} initial="hidden" animate="show" className="xl:col-span-2">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 bg-gradient-to-r from-[var(--accent-soft)] to-transparent px-5 py-4">
              <div className="flex items-center gap-2.5">
                <motion.div
                  animate={apRunning ? { rotate: [0, 10, -10, 0], scale: [1, 1.12, 1] } : {}}
                  transition={{ repeat: apRunning ? Infinity : 0, duration: 1.6 }}
                  className="text-2xl"
                >
                  ⚡
                </motion.div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Autopilot</h3>
                  <p className="text-xs text-slate-500">
                    One click → the whole team: strategy → copy → design → reel → schedule → publish → report
                  </p>
                </div>
                {ap && (
                  <div className="ml-auto">
                    <Badge color={ap.status === "running" ? "amber" : ap.status === "done" ? "green" : "red"}>
                      {ap.status === "running" && (
                        <Loader2 size={10} className="mr-1 inline animate-spin" />
                      )}
                      {ap.status}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5">
              {/* Launch form */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Field label="Company">
                  <Select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value, campaignId: "" })}>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Campaign">
                  <Select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
                    <option value="">— none —</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Plan length">
                  <Select value={form.weeks} onChange={(e) => setForm({ ...form, weeks: Number(e.target.value) })}>
                    {[1, 2, 4].map((w) => (
                      <option key={w} value={w}>{w} week{w > 1 ? "s" : ""}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Language">
                  <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                    <option value="ar">Arabic</option>
                    <option value="en">English</option>
                  </Select>
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {PLATFORMS.map((p) => {
                  const on = form.platforms.includes(p.id);
                  return (
                    <motion.button
                      key={p.id}
                      whileTap={{ scale: 0.94 }}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          platforms: on ? f.platforms.filter((x) => x !== p.id) : [...f.platforms, p.id],
                        }))
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                        on
                          ? "border-[var(--accent)] bg-accent-soft text-[var(--accent)] shadow-sm"
                          : "border-slate-200 text-slate-400 hover:border-slate-300"
                      )}
                    >
                      {p.label}
                    </motion.button>
                  );
                })}
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setForm((f) => ({ ...f, includeReel: !f.includeReel }))}
                  className={cn(
                    "ml-1 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                    form.includeReel
                      ? "border-pink-400 bg-pink-50 text-pink-600 shadow-sm"
                      : "border-slate-200 text-slate-400"
                  )}
                >
                  🎬 Include a reel
                </motion.button>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={launch} loading={launching} disabled={apRunning} size="lg">
                  {apRunning ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Team is working…
                    </>
                  ) : (
                    <>
                      <Zap size={16} /> Launch Autopilot
                    </>
                  )}
                </Button>
              </div>

              {/* Live pipeline */}
              <AnimatePresence>
                {ap && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                      {ap.steps.map((s, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-start gap-3 text-sm"
                        >
                          <span className="mt-0.5">
                            {s.status === "done" ? (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                                className="block text-emerald-500"
                              >
                                <CheckCircle2 size={16} />
                              </motion.span>
                            ) : s.status === "failed" ? (
                              <XCircle size={16} className="text-rose-500" />
                            ) : s.status === "running" ? (
                              <Loader2 size={16} className="animate-spin text-amber-500" />
                            ) : (
                              <span className="block h-4 w-4 rounded-full border-2 border-slate-300" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <span
                              className={cn(
                                "font-medium",
                                s.status === "pending" ? "text-slate-400" : "text-slate-800"
                              )}
                            >
                              {s.label}
                            </span>
                            {s.note && <p className="text-xs leading-relaxed text-slate-500">{s.note}</p>}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>

        {/* ── Live activity feed ────────────────────────── */}
        <motion.div variants={item} initial="hidden" animate="show">
          <Card className="flex h-full max-h-[640px] flex-col">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
              <motion.span
                className="h-2 w-2 rounded-full bg-emerald-500"
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
              />
              <h3 className="text-sm font-bold text-slate-800">Live activity</h3>
              <span className="ml-auto text-[11px] text-slate-400">auto-refreshing</span>
            </div>
            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              <AnimatePresence initial={false}>
                {data.runs.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm text-slate-400">
                    No agent activity yet.
                    <br />Launch Autopilot or run a quick task.
                  </p>
                )}
                {data.runs.map((r) => {
                  const agent = data.agents.find((a) => a.key === r.agentKey);
                  return (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="px-5 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{agent?.emoji}</span>
                        <span className="text-xs font-bold text-slate-800">{agent?.name || r.agentKey}</span>
                        <span className="truncate text-[11px] text-slate-400">{r.action}</span>
                        <span className="ml-auto text-[10px] text-slate-400">{timeAgo(r.createdAt)}</span>
                      </div>
                      {r.steps.length > 0 && (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                          {r.status === "running" && (
                            <Loader2 size={9} className="mr-1 inline animate-spin text-amber-500" />
                          )}
                          {r.steps[r.steps.length - 1]?.msg}
                        </p>
                      )}
                      {r.status === "failed" && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-rose-500">
                          {String((r.output as { error?: string })?.error || "failed")}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ── Agent grid ──────────────────────────────────── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        {data.agents.map((agent) => {
          const isRunning = data.running.includes(agent.key);
          const runs = data.stats[agent.key] || 0;
          return (
            <motion.div key={agent.key} variants={item} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>
              <Card className="relative h-full overflow-hidden p-5">
                {/* running glow */}
                <AnimatePresence>
                  {isRunning && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="pointer-events-none absolute inset-0"
                      style={{ boxShadow: `inset 0 0 24px ${agent.color}22` }}
                    />
                  )}
                </AnimatePresence>
                <div className="relative">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="relative">
                      <motion.div
                        animate={isRunning ? { scale: [1, 1.08, 1] } : {}}
                        transition={{ repeat: isRunning ? Infinity : 0, duration: 1.4 }}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                        style={{ background: `${agent.color}1a` }}
                      >
                        {agent.emoji}
                      </motion.div>
                      {isRunning && (
                        <motion.span
                          className="absolute inset-0 rounded-2xl border-2"
                          style={{ borderColor: agent.color }}
                          animate={{ scale: [1, 1.35], opacity: [0.8, 0] }}
                          transition={{ repeat: Infinity, duration: 1.4 }}
                        />
                      )}
                    </div>
                    <div className="text-right">
                      <Badge color={isRunning ? "amber" : "green"}>
                        {isRunning ? (
                          <>
                            <Loader2 size={10} className="mr-1 inline animate-spin" /> working
                          </>
                        ) : (
                          "idle"
                        )}
                      </Badge>
                      <div className="mt-1.5 text-[10px] text-slate-400">{runs} run{runs === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {agent.name} <span className="font-medium text-slate-400">· {agent.title}</span>
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{agent.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {agent.capabilities.map((c) => (
                      <span
                        key={c}
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: `${agent.color}14`, color: agent.color }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* Quick task */}
                  {agent.manualTask && (
                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <p className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        <Sparkles size={11} /> Quick task
                      </p>
                      {agent.manualTask === "copywriter" && (
                        <>
                          <Input
                            placeholder="Topic — e.g. weekend offer"
                            value={quickForm.copywriter_topic || ""}
                            onChange={(e) => setQuickForm({ ...quickForm, copywriter_topic: e.target.value })}
                            className="mb-2 text-xs"
                            dir="auto"
                          />
                          <Select
                            className="mb-2 text-xs"
                            value={quickForm.copywriter_platform || "meta_instagram"}
                            onChange={(e) => setQuickForm({ ...quickForm, copywriter_platform: e.target.value })}
                          >
                            {PLATFORMS.map((p) => (
                              <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                          </Select>
                        </>
                      )}
                      {agent.manualTask === "designer" && (
                        <>
                          <Input
                            placeholder="Headline for the design"
                            value={quickForm.designer_headline || ""}
                            onChange={(e) => setQuickForm({ ...quickForm, designer_headline: e.target.value })}
                            className="mb-2 text-xs"
                            dir="auto"
                          />
                          <Select
                            className="mb-2 text-xs"
                            value={quickForm.designer_template || "quote"}
                            onChange={(e) => setQuickForm({ ...quickForm, designer_template: e.target.value })}
                          >
                            <option value="quote">Quote</option>
                            <option value="stat">Stat</option>
                            <option value="announcement">Announcement</option>
                            <option value="showcase">Showcase</option>
                            <option value="tip">Tip</option>
                          </Select>
                        </>
                      )}
                      {agent.manualTask === "director" && (
                        <Input
                          placeholder="Reel topic"
                          value={quickForm.director_topic || ""}
                          onChange={(e) => setQuickForm({ ...quickForm, director_topic: e.target.value })}
                          className="mb-2 text-xs"
                          dir="auto"
                        />
                      )}
                      {agent.manualTask === "analyst" && (
                        <p className="mb-2 text-[11px] text-slate-500">
                          Generates a performance report with next actions for the selected company.
                        </p>
                      )}
                      <Button size="sm" variant="outline" onClick={() => runQuick(agent)} loading={quickBusy === agent.key}>
                        <Play size={11} /> Run task
                      </Button>

                      {/* Result */}
                      <AnimatePresence>
                        {quickResult[agent.key] && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <QuickResult agent={agent} result={quickResult[agent.key]} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {!agent.manualTask && (
                    <p className="mt-4 text-[11px] italic text-slate-400">{agent.worksVia}</p>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

function QuickResult({ agent, result }: { agent: AgentDef; result: unknown }) {
  const r = result as Record<string, unknown>;
  if (agent.manualTask === "copywriter") {
    const variants = (r.variants as { caption: string; hashtags?: string }[]) || [];
    return (
      <div className="mt-2 space-y-1.5">
        {variants.map((v, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-2 text-[11px] leading-relaxed text-slate-600" dir="auto">
            {v.caption}
            {v.hashtags && <span className="mt-0.5 block text-sky-600">{v.hashtags}</span>}
          </div>
        ))}
      </div>
    );
  }
  if (agent.manualTask === "designer") {
    const asset = r.asset as { filePath: string } | undefined;
    if (!asset) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/media/${asset.filePath}`} alt="design" className="mt-2 w-full rounded-lg border border-slate-200" />
    );
  }
  if (agent.manualTask === "director") {
    const reel = r.reel as { id: string; title: string } | undefined;
    if (!reel) return null;
    return (
      <Link href={`/reels/${reel.id}`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:underline">
        Open “{reel.title}” in the Reel studio <ArrowRight size={11} />
      </Link>
    );
  }
  if (agent.manualTask === "analyst") {
    const report = r.report as { summary: string; next: string[] } | undefined;
    if (!report) return null;
    return (
      <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-relaxed text-slate-600">
        <p className="font-semibold text-slate-700">{report.summary}</p>
        <ul className="mt-1.5 list-inside list-disc space-y-0.5">
          {report.next.slice(0, 3).map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>
    );
  }
  return null;
}
