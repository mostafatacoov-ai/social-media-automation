"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, Printer } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Spinner, ProgressBar } from "@/components/ui/Misc";
import { PlatformChip, Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { safeJsonParse } from "@/lib/utils";

interface PlanRow {
  id: string;
  title: string;
  durationWeeks: number;
  language: string;
  platforms: string;
  planData: string;
  company?: { name: string };
  campaign?: { name: string } | null;
}

interface PlanData {
  executiveSummary?: string;
  objectives?: string[];
  kpis?: { name: string; target: string }[];
  personas?: { name: string; description: string; interests?: string; platforms?: string }[];
  messaging?: { tagline?: string; voiceGuidelines?: string; keyMessages?: string[] };
  contentPillars?: { name: string; description: string; mix?: number; exampleTopics?: string[] }[];
  platformStrategies?: { platform: string; strategy: string; postTypes?: string; frequency?: string; bestTimes?: string }[];
  weeklyCalendar?: { week: number; theme?: string; days?: { day?: string; platform?: string; contentType?: string; pillar?: string; topic?: string; cta?: string }[] }[];
  hashtags?: { platform: string; tags?: string[] }[];
  paidSuggestions?: { platform?: string; audience?: string; budget?: string; objective?: string; note?: string }[];
  budgetAllocation?: { channel?: string; percent?: number; note?: string }[];
  measurement?: { cadence?: string; tools?: string; reviewPoints?: string[] };
}

export function PlanViewer({ planId }: { planId: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [data, setData] = useState<PlanData | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api<{ plan: PlanRow }>(`/api/plans/${planId}`)
      .then((r) => {
        setPlan(r.plan);
        setData(safeJsonParse<PlanData>(r.plan.planData, {}));
      })
      .catch((e) => toast(e.message, "error"));
  }, [planId]);

  async function materialize(week: number) {
    setBusy(String(week));
    try {
      const res = await api<{ created: number }>(`/api/plans/${planId}/materialize`, {
        method: "POST",
        json: { week },
      });
      toast(`Week ${week}: ${res.created} draft posts created — open Posts to edit & schedule them`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy("");
    }
  }

  if (!plan || !data) return <Spinner label="Loading plan…" />;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => router.push("/plans")} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
            <ArrowLeft size={13} /> All plans
          </button>
          <h1 className="text-xl font-bold text-slate-900">{plan.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {plan.company?.name}{plan.campaign && ` · ${plan.campaign.name}`} · {plan.durationWeeks} weeks
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer size={15} /> Print / PDF
        </Button>
      </div>

      <div className="space-y-5">
        {data.executiveSummary && (
          <Card className="p-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Executive summary</h2>
            <p className="text-sm leading-relaxed text-slate-700" dir="auto">{data.executiveSummary}</p>
          </Card>
        )}

        {data.objectives?.length ? (
          <Card className="p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Objectives</h2>
            <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-700" dir="auto">
              {data.objectives.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </Card>
        ) : null}

        {data.kpis?.length ? (
          <Card>
            <CardHeader title="KPIs & targets" />
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.kpis.map((k, i) => (
                <div key={i} className="rounded-lg bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-800" dir="auto">{k.name}</div>
                  <div className="mt-1 text-xs text-[var(--accent)] font-bold" dir="auto">{k.target}</div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {data.personas?.length ? (
          <Card>
            <CardHeader title="Audience personas" />
            <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3">
              {data.personas.map((p, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-4">
                  <div className="text-sm font-bold text-slate-800" dir="auto">{p.name}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600" dir="auto">{p.description}</p>
                  {p.interests && <p className="mt-2 text-[11px] text-slate-400" dir="auto">Interests: {p.interests}</p>}
                  {p.platforms && <p className="text-[11px] text-slate-400" dir="auto">Platforms: {p.platforms}</p>}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {data.messaging && (
          <Card className="p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Brand messaging</h2>
            {data.messaging.tagline && (
              <p className="mb-2 text-base font-bold text-[var(--accent)]" dir="auto">“{data.messaging.tagline}”</p>
            )}
            {data.messaging.voiceGuidelines && (
              <p className="mb-3 text-sm leading-relaxed text-slate-600" dir="auto">{data.messaging.voiceGuidelines}</p>
            )}
            {data.messaging.keyMessages?.length ? (
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-700" dir="auto">
                {data.messaging.keyMessages.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            ) : null}
          </Card>
        )}

        {data.contentPillars?.length ? (
          <Card>
            <CardHeader title="Content pillars" />
            <div className="space-y-4 p-5">
              {data.contentPillars.map((p, i) => (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800" dir="auto">{p.name}</span>
                    {typeof p.mix === "number" && <Badge color="purple">{p.mix}%</Badge>}
                  </div>
                  <p className="mb-2 text-xs leading-relaxed text-slate-600" dir="auto">{p.description}</p>
                  {typeof p.mix === "number" && <ProgressBar value={p.mix} />}
                  {p.exampleTopics?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.exampleTopics.map((t, j) => (
                        <span key={j} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600" dir="auto">{t}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {data.platformStrategies?.length ? (
          <Card>
            <CardHeader title="Platform strategies" />
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              {data.platformStrategies.map((s, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-2 text-sm font-bold capitalize text-slate-800">{s.platform}</div>
                  <p className="text-xs leading-relaxed text-slate-600" dir="auto">{s.strategy}</p>
                  <div className="mt-3 space-y-1 text-[11px] text-slate-500">
                    {s.postTypes && <div><strong>Formats:</strong> {s.postTypes}</div>}
                    {s.frequency && <div><strong>Frequency:</strong> {s.frequency}</div>}
                    {s.bestTimes && <div><strong>Best times:</strong> {s.bestTimes}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {data.weeklyCalendar?.length ? (
          <Card>
            <CardHeader
              title="Weekly content calendar"
              subtitle="Materialize a week to create its posts as drafts (then generate captions & media per post)."
            />
            <div className="space-y-5 p-5">
              {data.weeklyCalendar.map((w) => (
                <motion.div
                  key={w.week}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-800">
                      Week {w.week}
                      {w.theme && <span className="ml-2 font-normal text-slate-500" dir="auto">— {w.theme}</span>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => materialize(w.week)} loading={busy === String(w.week)}>
                      <CalendarPlus size={13} /> Create drafts
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Day</th>
                          <th className="px-3 py-2 font-semibold">Platform</th>
                          <th className="px-3 py-2 font-semibold">Format</th>
                          <th className="px-3 py-2 font-semibold">Topic</th>
                          <th className="px-3 py-2 font-semibold">CTA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(w.days || []).map((d, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-slate-700">{d.day}</td>
                            <td className="px-3 py-2"><PlatformChip platform={normalizePlatformKey(d.platform)} /></td>
                            <td className="px-3 py-2 text-slate-600">{d.contentType}</td>
                            <td className="px-3 py-2 text-slate-700" dir="auto">
                              {d.topic}
                              {d.pillar && <span className="ml-1 text-[10px] text-slate-400">({d.pillar})</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-500" dir="auto">{d.cta}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {data.hashtags?.length ? (
            <Card className="p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Hashtag strategy</h2>
              {data.hashtags.map((h, i) => (
                <div key={i} className="mb-3">
                  <div className="mb-1 text-xs font-bold capitalize text-slate-700">{h.platform}</div>
                  <div className="flex flex-wrap gap-1">
                    {(h.tags || []).map((t, j) => (
                      <span key={j} className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">#{String(t).replace(/^#/, "")}</span>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          ) : null}

          {data.paidSuggestions?.length ? (
            <Card className="p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Paid boost suggestions</h2>
              {data.paidSuggestions.map((s, i) => (
                <div key={i} className="mb-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                  <div className="font-bold capitalize">{s.platform}{s.objective && ` · ${s.objective}`}</div>
                  {s.audience && <div className="mt-1"><strong>Audience:</strong> {s.audience}</div>}
                  {s.budget && <div><strong>Budget:</strong> {s.budget}</div>}
                  {s.note && <div className="mt-1 text-slate-500" dir="auto">{s.note}</div>}
                </div>
              ))}
            </Card>
          ) : null}

          {data.budgetAllocation?.length ? (
            <Card className="p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Budget allocation</h2>
              {data.budgetAllocation.map((b, i) => (
                <div key={i} className="mb-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">{b.channel}</span>
                    <span className="text-[var(--accent)] font-bold">{b.percent}%</span>
                  </div>
                  {typeof b.percent === "number" && <div className="mt-1"><ProgressBar value={b.percent} /></div>}
                  {b.note && <p className="mt-1 text-[11px] text-slate-500" dir="auto">{b.note}</p>}
                </div>
              ))}
            </Card>
          ) : null}

          {data.measurement && (
            <Card className="p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Measurement</h2>
              <p className="text-xs text-slate-600"><strong>Cadence:</strong> {data.measurement.cadence}</p>
              {data.measurement.tools && <p className="mt-1 text-xs text-slate-600"><strong>Tools:</strong> {data.measurement.tools}</p>}
              {data.measurement.reviewPoints?.length ? (
                <ul className="mt-2 list-inside list-disc text-xs text-slate-600" dir="auto">
                  {data.measurement.reviewPoints.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              ) : null}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function normalizePlatformKey(raw?: string): string {
  const key = (raw || "").trim().toLowerCase();
  const map: Record<string, string> = {
    instagram: "meta_instagram", ig: "meta_instagram",
    facebook: "meta_facebook", fb: "meta_facebook",
    linkedin: "linkedin", twitter: "x", x: "x",
    tiktok: "tiktok", snapchat: "snapchat", snap: "snapchat",
  };
  return map[key] || "meta_instagram";
}
