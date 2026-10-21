"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Form";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
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

const TEAL = "#2EE6D6";

export function AgentsClient() {
  const [data, setData] = useState<AgentsData | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string; language: string }[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [clock, setClock] = useState("");
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
    const t = setInterval(() => {
      setClock(new Date().toLocaleTimeString("en-GB"));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!form.companyId) return;
    api<{ campaigns: { id: string; name: string }[] }>(`/api/campaigns?companyId=${form.companyId}`)
      .then((r) => setCampaigns(r.campaigns))
      .catch(() => setCampaigns([]));
  }, [form.companyId]);

  // Live polling
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const qs = form.companyId ? `?companyId=${form.companyId}` : "";
        const res = await api<AgentsData>(`/api/agents${qs}`);
        if (alive) setData(res);
      } catch {
        /* keep last state */
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

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="hud-mono animate-pulse text-sm tracking-[3px]" style={{ color: TEAL }}>
          INITIALIZING OPERATIONS CONSOLE…
        </div>
      </div>
    );
  }

  const ap = data.autopilot;
  const apRunning = ap?.status === "running";
  const tapeItems = data.runs
    .slice(0, 12)
    .map((r) => {
      const agent = data.agents.find((a) => a.key === r.agentKey);
      const t = new Date(r.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const last = r.steps[r.steps.length - 1]?.msg || r.action;
      return `${t} ▸ ${agent?.name || r.agentKey}: ${last}`;
    })
    .join("   ◆   ");
  const tape = tapeItems || "SYSTEM ONLINE ▸ agents standing by ▸ launch autopilot to begin operations";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1F5E70] bg-[#050D14] text-[#E6F2F5]">
      <style>{`
        .hud-rail { background: repeating-linear-gradient(180deg, ${TEAL} 0 6px, transparent 6px 16px); animation: hud-rail 0.9s linear infinite; }
        @keyframes hud-rail { to { background-position-y: 16px; } }
      `}</style>

      {/* ── background layers ── */}
      <div aria-hidden className="hud-grid pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-260px] h-[560px] w-[560px] -translate-x-1/2 rounded-full border border-[#2EE6D6]/20" style={{ background: "conic-gradient(from 0deg, rgba(46,230,214,0) 0deg, rgba(46,230,214,0) 300deg, rgba(46,230,214,.16) 360deg)", animation: "hud-spin 9s linear infinite" }} />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-160px] h-[360px] w-[360px] -translate-x-1/2 rounded-full border border-dashed border-[#2EE6D6]/25 hud-spin-r" />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(5,13,20,0) 0%, rgba(5,13,20,.25) 45%, rgba(5,13,20,.92) 100%)" }} />
      <div aria-hidden className="hud-sweep absolute left-0 top-0 h-[140px] w-full" style={{ background: "linear-gradient(180deg, rgba(46,230,214,0) 0%, rgba(46,230,214,.06) 80%, rgba(46,230,214,.3) 100%)" }} />

      {/* ── header strip ── */}
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#1F5E70] bg-[#0A2532]/80 px-5 py-3">
        <span className="text-lg font-bold tracking-tight">AI Agents · Operations Console</span>
        <span className="text-xs text-[#9DB8C4]">your marketing team is standing by</span>
        <span className="hud-mono hud-flick text-xs" style={{ color: TEAL }}>
          {data.running.length > 0 ? `▲ ${data.running.length} AGENT(S) ACTIVE` : "▲ ALL SYSTEMS NOMINAL"}
        </span>
        <div className="ml-auto flex items-center gap-4">
          <span className="flex items-center gap-2 border border-[#13B6A6] px-3 py-1 text-xs font-semibold text-[#7FE3D8]">
            <span className="hud-blink inline-block h-2 w-2 rounded-full bg-[#13B6A6]" />
            LIVE
          </span>
          <span className="hud-mono min-w-[92px] text-center text-lg tabular-nums" style={{ color: TEAL }}>
            {clock}
          </span>
        </div>
      </div>

      {/* ── telemetry tape ── */}
      <div className="relative overflow-hidden border-b border-[#143746] bg-[#071B26]/60 py-1">
        <div className="hud-tape hud-mono inline-block whitespace-nowrap text-[11px] text-[#5FB8AE]">
          <span className="mr-16">{tape}</span>
          <span className="mr-16">{tape}</span>
        </div>
      </div>

      <div className="relative grid grid-cols-1 gap-5 p-5 xl:grid-cols-3">
        {/* ── LEFT: autopilot + agents ── */}
        <div className="space-y-5 xl:col-span-2">
          {/* Autopilot */}
          <div
            className={cn(
              "relative rounded-xl border bg-[#0A2532]/80 p-5 transition-shadow",
              apRunning ? "hud-think border-[#E0A93B]" : "border-[#17475A]"
            )}
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={cn("text-2xl", apRunning && "inline-block")} style={{ filter: apRunning ? "drop-shadow(0 0 8px #E0A93B)" : undefined }}>⚡</span>
              <div>
                <h3 className="text-sm font-bold tracking-wide">AUTOPILOT</h3>
                <p className="text-[11px] text-[#9DB8C4]">
                  one command → strategy ▸ copy ▸ design ▸ reel ▸ schedule ▸ publish ▸ report
                </p>
              </div>
              {ap && (
                <span
                  className={cn(
                    "ml-auto border px-2.5 py-1 text-[11px] font-bold tracking-wider",
                    ap.status === "running" && "border-[#E0A93B] text-[#F2CB7A]",
                    ap.status === "done" && "border-[#13B6A6] text-[#7FE3D8]",
                    ap.status === "failed" && "border-rose-500 text-rose-300"
                  )}
                >
                  {ap.status === "running" && <Loader2 size={10} className="mr-1 inline animate-spin" />}
                  {ap.status.toUpperCase()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <label className="block">
                <span className="hud-mono mb-1 block text-[10px] text-[#52707D]">COMPANY</span>
                <Select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value, campaignId: "" })} className="hud-input text-xs">
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="hud-mono mb-1 block text-[10px] text-[#52707D]">CAMPAIGN</span>
                <Select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })} className="hud-input text-xs">
                  <option value="">— none —</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="hud-mono mb-1 block text-[10px] text-[#52707D]">PLAN LENGTH</span>
                <Select value={form.weeks} onChange={(e) => setForm({ ...form, weeks: Number(e.target.value) })} className="hud-input text-xs">
                  {[1, 2, 4].map((w) => (
                    <option key={w} value={w}>{w} week{w > 1 ? "s" : ""}</option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="hud-mono mb-1 block text-[10px] text-[#52707D]">LANGUAGE</span>
                <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="hud-input text-xs">
                  <option value="ar">Arabic</option>
                  <option value="en">English</option>
                </Select>
              </label>
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
                      "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
                      on ? "border-[#2EE6D6] bg-[#2EE6D6]/10 text-[#2EE6D6]" : "border-[#17475A] text-[#52707D] hover:border-[#1F8C82]"
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
                  "ml-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
                  form.includeReel ? "border-[#FFB547] bg-[#FFB547]/10 text-[#F2CB7A]" : "border-[#17475A] text-[#52707D]"
                )}
              >
                🎬 Include a reel
              </motion.button>
              <div className="ml-auto flex items-center gap-3">
                {apRunning && (
                  <span className="hud-mono hud-blink text-[11px] text-[#F2CB7A]">PIPELINE EXECUTING…</span>
                )}
                <Button onClick={launch} loading={launching} disabled={apRunning} className="!rounded-md">
                  {apRunning ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> working…
                    </>
                  ) : (
                    <>
                      <Zap size={15} /> LAUNCH AUTOPILOT
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* live pipeline */}
            <AnimatePresence>
              {ap && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 rounded-lg border border-[#143746] bg-[#071B26]/50 p-4">
                    <div className="hud-mono mb-3 text-[10px] tracking-[2px] text-[#52707D]">PIPELINE STATUS</div>
                    <div className="relative pl-7">
                      {/* animated data rail */}
                      <div aria-hidden className="hud-rail absolute bottom-2 left-[7px] top-2 w-[2px]" />
                      {ap.steps.map((s, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="relative mb-3 last:mb-0"
                        >
                          <span
                            className={cn(
                              "absolute -left-7 top-0.5 flex h-4 w-4 items-center justify-center rounded-full border",
                              s.status === "done" && "border-[#13B6A6] bg-[#13B6A6]/20",
                              s.status === "running" && "border-[#E0A93B] bg-[#E0A93B]/20",
                              s.status === "failed" && "border-rose-500 bg-rose-500/20",
                              s.status === "pending" && "border-[#17475A]"
                            )}
                          >
                            {s.status === "done" && <CheckCircle2 size={12} className="text-[#7FE3D8]" />}
                            {s.status === "running" && <Loader2 size={11} className="animate-spin text-[#F2CB7A]" />}
                            {s.status === "failed" && <XCircle size={12} className="text-rose-400" />}
                            {s.status === "pending" && <span className="h-1 w-1 rounded-full bg-[#17475A]" />}
                          </span>
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span
                              className={cn(
                                "text-[13px] font-semibold",
                                s.status === "pending" ? "text-[#52707D]" : "text-[#E6F2F5]"
                              )}
                            >
                              {s.label}
                            </span>
                            {s.status === "running" && (
                              <span className="hud-mono border border-[#E0A93B] px-1.5 text-[9px] text-[#F2CB7A]">EXECUTING</span>
                            )}
                            {s.status === "done" && (
                              <span className="hud-mono border border-[#13B6A6] px-1.5 text-[9px] text-[#7FE3D8]">DONE</span>
                            )}
                          </div>
                          {s.note && <p className="mt-0.5 text-[11px] leading-relaxed text-[#9DB8C4]">{s.note}</p>}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Agent grid */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            {data.agents.map((agent) => {
              const isRunning = data.running.includes(agent.key);
              const runs = data.stats[agent.key] || 0;
              return (
                <motion.div
                  key={agent.key}
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
                  }}
                  whileHover={{ y: -3 }}
                  style={{ ["--agent-color" as string]: agent.color }}
                  className={cn(
                    "relative h-full rounded-xl border bg-[#0A2532]/80 p-4 transition-colors",
                    isRunning ? "hud-glow border-transparent" : "border-[#17475A] hover:border-[#1F8C82]"
                  )}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-lg border text-xl"
                        style={{ borderColor: `${agent.color}55`, background: `${agent.color}14` }}
                      >
                        {agent.emoji}
                      </div>
                      <div>
                        <div className="text-[13px] font-bold">
                          {agent.name}
                          <span className="ml-1.5 font-medium text-[#52707D]">· {agent.title}</span>
                        </div>
                        <div className="hud-mono text-[10px] text-[#52707D]">
                          {runs} RUN{runs === 1 ? "" : "S"}
                        </div>
                      </div>
                    </div>
                    {isRunning ? (
                      <span className="flex items-center gap-1.5 border border-[#13B6A6] px-2 py-0.5 text-[10px] font-bold text-[#7FE3D8]">
                        <span className="hud-blink h-1.5 w-1.5 rounded-full bg-[#13B6A6]" /> ACTIVE
                      </span>
                    ) : (
                      <span className="border border-[#17475A] px-2 py-0.5 text-[10px] text-[#52707D]">STANDBY</span>
                    )}
                  </div>

                  <p className="mb-3 text-[11px] leading-relaxed text-[#9DB8C4]">{agent.description}</p>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {agent.capabilities.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border px-2 py-0.5 text-[9px] font-semibold"
                        style={{ borderColor: `${agent.color}40`, color: agent.color, background: `${agent.color}0d` }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>

                  {agent.manualTask && (
                    <div className="rounded-lg border border-[#143746] bg-[#071B26]/60 p-3">
                      <p className="hud-mono mb-2 flex items-center gap-1 text-[9px] tracking-[2px] text-[#52707D]">
                        <Sparkles size={10} /> QUICK TASK
                      </p>
                      {agent.manualTask === "copywriter" && (
                        <>
                          <Input
                            placeholder="Topic — e.g. weekend offer"
                            value={quickForm.copywriter_topic || ""}
                            onChange={(e) => setQuickForm({ ...quickForm, copywriter_topic: e.target.value })}
                            className="hud-input mb-2 text-xs"
                            dir="auto"
                          />
                          <Select
                            className="hud-input mb-2 text-xs"
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
                            className="hud-input mb-2 text-xs"
                            dir="auto"
                          />
                          <Select
                            className="hud-input mb-2 text-xs"
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
                          className="hud-input mb-2 text-xs"
                          dir="auto"
                        />
                      )}
                      {agent.manualTask === "analyst" && (
                        <p className="mb-2 text-[11px] text-[#9DB8C4]">
                          Generates a performance report with next actions for the selected company.
                        </p>
                      )}
                      <Button size="sm" variant="outline" onClick={() => runQuick(agent)} loading={quickBusy === agent.key} className="!border-[#1F8C82] !text-[#7FE3D8] hover:!bg-[#0A2532]">
                        <Play size={11} /> RUN TASK
                      </Button>
                      <AnimatePresence>
                        {quickResult[agent.key] && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <HudQuickResult agent={agent} result={quickResult[agent.key]} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {!agent.manualTask && (
                    <p className="hud-mono text-[10px] text-[#52707D]">{agent.worksVia.toUpperCase()}</p>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* ── RIGHT: live activity terminal ── */}
        <div className="flex h-full max-h-[760px] flex-col overflow-hidden rounded-xl border border-[#17475A] bg-[#071B26]/70">
          <div className="flex items-center gap-2 border-b border-[#143746] px-4 py-3">
            <span className="hud-hop inline-block h-2 w-2 rounded-full bg-[#13B6A6]" />
            <h3 className="hud-mono text-[11px] font-bold tracking-[2px] text-[#7FE3D8]">LIVE ACTIVITY</h3>
            <span className="hud-mono ml-auto text-[9px] text-[#52707D]">POLL 2.5s</span>
          </div>
          <div className="flex-1 divide-y divide-[#143746]/60 overflow-y-auto">
            <AnimatePresence initial={false}>
              {data.runs.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <p className="hud-mono text-[11px] leading-relaxed text-[#52707D]">
                    NO ACTIVITY LOGGED
                    <br />
                    LAUNCH AUTOPILOT OR RUN A QUICK TASK
                  </p>
                </div>
              )}
              {data.runs.map((r) => {
                const agent = data.agents.find((a) => a.key === r.agentKey);
                const t = new Date(r.createdAt).toLocaleTimeString("en-GB");
                return (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{agent?.emoji}</span>
                      <span className="text-[11px] font-bold text-[#E6F2F5]">{agent?.name || r.agentKey}</span>
                      <span className="truncate text-[10px] text-[#52707D]">{r.action}</span>
                      <span className="hud-mono ml-auto text-[9px] text-[#52707D]">{t}</span>
                    </div>
                    {r.steps.length > 0 && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[#9DB8C4]">
                        {r.status === "running" && (
                          <Loader2 size={9} className="mr-1 inline animate-spin text-[#F2CB7A]" />
                        )}
                        {r.steps[r.steps.length - 1]?.msg}
                      </p>
                    )}
                    {r.status === "failed" && (
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-rose-400">
                        {String((r.output as { error?: string })?.error || "failed")}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          <div className="hud-mono border-t border-[#143746] px-4 py-2 text-[9px] tracking-[2px] text-[#52707D]">
            {data.agents.length} AGENTS · {data.runs.length} RECENT RUNS · EVERY ACTION LOGGED
          </div>
        </div>
      </div>
    </div>
  );
}

function HudQuickResult({ agent, result }: { agent: AgentDef; result: unknown }) {
  const r = result as Record<string, unknown>;
  if (agent.manualTask === "copywriter") {
    const variants = (r.variants as { caption: string; hashtags?: string }[]) || [];
    return (
      <div className="mt-2 space-y-1.5">
        {variants.map((v, i) => (
          <div key={i} className="rounded-md border border-[#143746] bg-[#0A2532] p-2 text-[11px] leading-relaxed text-[#9DB8C4]" dir="auto">
            {v.caption}
            {v.hashtags && <span className="mt-0.5 block" style={{ color: TEAL }}>{v.hashtags}</span>}
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
      <img src={`/api/media/${asset.filePath}`} alt="design" className="mt-2 w-full rounded-md border border-[#143746]" />
    );
  }
  if (agent.manualTask === "director") {
    const reel = r.reel as { id: string; title: string } | undefined;
    if (!reel) return null;
    return (
      <Link href={`/reels/${reel.id}`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold hover:underline" style={{ color: TEAL }}>
        Open “{reel.title}” in the Reel studio <ArrowRight size={11} />
      </Link>
    );
  }
  if (agent.manualTask === "analyst") {
    const report = r.report as { summary: string; next: string[] } | undefined;
    if (!report) return null;
    return (
      <div className="mt-2 rounded-md border border-[#143746] bg-[#0A2532] p-2.5 text-[11px] leading-relaxed text-[#9DB8C4]">
        <p className="font-semibold text-[#E6F2F5]">{report.summary}</p>
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
