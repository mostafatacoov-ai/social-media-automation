"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clapperboard, ImagePlus, Music, Play, Save, Send } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Spinner, ProgressBar } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { safeJsonParse } from "@/lib/utils";
import { REEL_TEMPLATES, TTS_VOICES, PLATFORM_MAP } from "@/lib/constants";
import type { ReelScript } from "@/lib/ai/prompts";

interface ReelRow {
  id: string;
  title: string;
  template: string;
  language: string;
  status: string;
  progress: number;
  error: string | null;
  voiceover: boolean;
  voice: string;
  subtitles: boolean;
  musicAssetId: string | null;
  scriptData: string;
  companyId: string;
  videoAsset: { id: string; filePath: string } | null;
}

export function ReelStudio({ reelId }: { reelId: string }) {
  const router = useRouter();
  const [reel, setReel] = useState<ReelRow | null>(null);
  const [script, setScript] = useState<ReelScript | null>(null);
  const [busy, setBusy] = useState("");
  const musicRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReel = useCallback(async () => {
    const res = await api<{ reel: ReelRow }>(`/api/reels/${reelId}`);
    setReel(res.reel);
    setScript(safeJsonParse<ReelScript>(res.reel.scriptData, null));
    return res.reel;
  }, [reelId]);

  useEffect(() => {
    fetchReel().catch((e) => toast(e.message, "error"));
  }, [fetchReel]);

  // Poll while rendering
  useEffect(() => {
    if (reel?.status === "rendering") {
      pollRef.current = setInterval(() => {
        fetchReel().catch(() => {});
      }, 3000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [reel?.status, fetchReel]);

  function updateScene(i: number, patch: Partial<ReelScript["scenes"][0]>) {
    setScript((s) => {
      if (!s) return s;
      const scenes = s.scenes.map((sc, j) => (j === i ? { ...sc, ...patch } : sc));
      return { ...s, scenes };
    });
  }

  async function saveScript() {
    if (!script) return;
    setBusy("save");
    try {
      await api(`/api/reels/${reelId}`, {
        method: "PATCH",
        json: { script, title: reel?.title, voice: reel?.voice, voiceover: reel?.voiceover, subtitles: reel?.subtitles },
      });
      toast("Script saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy("");
    }
  }

  async function genSceneImage(i: number, prompt?: string) {
    setBusy(`scene-${i}`);
    try {
      const res = await api<{ script: ReelScript }>(`/api/reels/${reelId}/scene-image`, {
        method: "POST",
        json: { sceneIndex: i, prompt },
      });
      setScript(res.script);
      toast(`Scene ${i + 1} image generated`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy("");
    }
  }

  async function genAllImages() {
    if (!script) return;
    for (let i = 0; i < script.scenes.length; i++) {
      if (!script.scenes[i].imagePath) {
        await genSceneImage(i);
      }
    }
  }

  async function uploadMusic(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "music");
    fd.append("companyId", reel?.companyId || "");
    try {
      const res = await api<{ asset: { id: string; filePath: string } }>("/api/upload", { method: "POST", body: fd });
      await api(`/api/reels/${reelId}`, { method: "PATCH", json: { musicAssetId: res.asset.id } });
      await fetchReel();
      toast("Music attached", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    }
  }

  async function render() {
    setBusy("render");
    try {
      await saveScriptQuiet();
      await api(`/api/reels/${reelId}/render`, { method: "POST", json: {} });
      toast("Rendering started", "success");
      await fetchReel();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Render failed to start", "error");
    } finally {
      setBusy("");
    }
  }

  async function saveScriptQuiet() {
    if (!script) return;
    await api(`/api/reels/${reelId}`, { method: "PATCH", json: { script } });
  }

  async function createPost(platform: string) {
    if (!reel?.videoAsset) return;
    try {
      await api("/api/posts", {
        method: "POST",
        json: {
          companyId: reel.companyId,
          platform,
          contentType: "reel",
          caption: script ? `${script.hook}\n\n${script.scenes.map((s) => s.text).join("\n")}` : "",
          language: reel.language,
          mediaAssetIds: [reel.videoAsset.id],
          status: "draft",
        },
      });
      toast(`Draft ${PLATFORM_MAP[platform]?.label || platform} post created from this reel`, "success");
      router.push("/posts");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  if (!reel || !script) return <Spinner label="Loading reel…" />;

  const imagesMissing = script.scenes.filter((s) => !s.imagePath).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <button onClick={() => router.push("/reels")} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft size={13} /> All reels
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <input
              value={reel.title}
              onChange={(e) => setReel({ ...reel, title: e.target.value })}
              className="w-full rounded-lg border border-transparent bg-transparent px-1 text-xl font-bold text-slate-900 hover:border-slate-300 focus:border-slate-300 focus:outline-none"
            />
            <div className="mt-1 flex items-center gap-2 px-1">
              <Badge color="purple">{REEL_TEMPLATES.find((t) => t.id === reel.template)?.label}</Badge>
              <Badge color="slate">{reel.language === "ar" ? "Arabic" : "English"}</Badge>
              <Badge color={reel.status === "ready" ? "green" : reel.status === "rendering" ? "amber" : reel.status === "failed" ? "red" : "slate"}>
                {reel.status}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveScript} loading={busy === "save"}><Save size={14} /> Save</Button>
            <Button onClick={render} loading={busy === "render"} disabled={reel.status === "rendering"}>
              <Clapperboard size={15} /> {reel.status === "rendering" ? "Rendering…" : "Render video"}
            </Button>
          </div>
        </div>
      </div>

      {reel.status === "rendering" && (
        <Card className="mb-5 p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Rendering — this usually takes 1–5 minutes</span>
            <span className="text-slate-500">{reel.progress}%</span>
          </div>
          <ProgressBar value={reel.progress} />
        </Card>
      )}
      {reel.error && (
        <div className="mb-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{reel.error}</div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader
              title="Scenes"
              subtitle="Edit the on-screen text and image prompts. Generate images per scene (AI, portrait 9:16)."
              actions={
                imagesMissing > 0 ? (
                  <Button size="sm" variant="outline" onClick={genAllImages} loading={busy.startsWith("scene-")}>
                    <ImagePlus size={13} /> Generate missing ({imagesMissing})
                  </Button>
                ) : undefined
              }
            />
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
              className="space-y-4 p-5"
            >
              {script.scenes.map((s, i) => (
                <motion.div
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
                  }}
                  className="flex gap-4 rounded-xl border border-slate-200 p-4 transition-shadow hover:shadow-md"
                >
                  <div className="w-24 shrink-0">
                    {s.imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/media/${s.imagePath}`} alt="" className="h-36 w-24 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-36 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400">SCENE {i + 1}</span>
                      <span className="text-[11px] text-slate-400">· {s.durationSec}s</span>
                    </div>
                    <Input
                      value={s.text}
                      onChange={(e) => updateScene(i, { text: e.target.value })}
                      dir="auto"
                      placeholder="On-screen text"
                    />
                    <Textarea
                      rows={2}
                      value={s.imagePrompt}
                      onChange={(e) => updateScene(i, { imagePrompt: e.target.value })}
                      placeholder="Image prompt (English)"
                      className="text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => genSceneImage(i, s.imagePrompt)} loading={busy === `scene-${i}`}>
                        <ImagePlus size={13} /> {s.imagePath ? "Regenerate image" : "Generate image"}
                      </Button>
                      <Select
                        value={s.durationSec}
                        onChange={(e) => updateScene(i, { durationSec: Number(e.target.value) })}
                        className="w-24"
                      >
                        {[2, 3, 4, 5, 6, 7, 8].map((d) => (
                          <option key={d} value={d}>{d}s</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </motion.div>
              ))}
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Final CTA</div>
                <Input value={script.cta || ""} onChange={(e) => setScript({ ...script, cta: e.target.value })} dir="auto" />
              </div>
            </motion.div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Audio" />
            <div className="space-y-4 p-5">
              <Field label="Voiceover">
                <Select
                  value={reel.voiceover ? reel.voice : "none"}
                  onChange={async (e) => {
                    const v = e.target.value;
                    const upd = { voiceover: v !== "none", voice: v };
                    setReel({ ...reel, ...upd });
                    await api(`/api/reels/${reelId}`, { method: "PATCH", json: upd });
                  }}
                >
                  <option value="none">None</option>
                  {TTS_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </Select>
              </Field>
              {script.voiceoverScript !== undefined && (
                <Field label="Voiceover script">
                  <Textarea
                    rows={4}
                    value={script.voiceoverScript}
                    onChange={(e) => setScript({ ...script, voiceoverScript: e.target.value })}
                    dir="auto"
                  />
                </Field>
              )}
              <Field label="Music (mp3)">
                <div className="flex items-center gap-2">
                  <input
                    ref={musicRef}
                    type="file"
                    accept="audio/*"
                    hidden
                    onChange={(e) => e.target.files?.[0] && uploadMusic(e.target.files[0])}
                  />
                  <Button size="sm" variant="outline" onClick={() => musicRef.current?.click()}>
                    <Music size={13} /> {reel.musicAssetId ? "Replace music" : "Upload music"}
                  </Button>
                  {reel.musicAssetId && (
                    <Button size="sm" variant="ghost" onClick={async () => {
                      await api(`/api/reels/${reelId}`, { method: "PATCH", json: { musicAssetId: null } });
                      await fetchReel();
                    }}>
                      Remove
                    </Button>
                  )}
                </div>
              </Field>
              <p className="text-[11px] text-slate-400">Music is auto-ducked under the voiceover. Upload your own licensed track.</p>
            </div>
          </Card>

          {reel.videoAsset && reel.status === "ready" && (
            <Card>
              <CardHeader title="Result" />
              <div className="p-5">
                <video src={`/api/media/${reel.videoAsset.filePath}`} className="w-full rounded-lg" controls />
                <div className="mt-4 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Create post from this reel</p>
                  <div className="flex flex-wrap gap-2">
                    {(["meta_instagram", "meta_facebook", "tiktok", "snapchat"] as const).map((p) => (
                      <Button key={p} size="sm" variant="outline" onClick={() => createPost(p)}>
                        <Send size={12} /> {PLATFORM_MAP[p]?.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {reel.status === "draft" && (
            <Card className="bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
              <div className="mb-1 flex items-center gap-1.5 font-bold text-slate-700"><Play size={12} /> How it works</div>
              1. Review the scene texts and image prompts.
              <br />2. Generate images for each scene (AI image provider required).
              <br />3. Optionally attach voiceover + music.
              <br />4. Click Render video — then create posts from the result.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
