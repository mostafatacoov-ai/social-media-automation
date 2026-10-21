"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, ImageIcon, Upload, Rocket, CalendarClock, Save, X, Wand2, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { PageHeader, Spinner, Tabs } from "@/components/ui/Misc";
import { PlatformChip } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { CONTENT_TYPES, PLATFORMS } from "@/lib/constants";

interface Asset { id: string; filePath: string; mimeType: string }
interface Variant { caption: string; hashtags: string }
interface Option { id: string; name: string }

const TEMPLATES = [
  { id: "quote", label: "Quote / message" },
  { id: "stat", label: "Stat / number" },
  { id: "announcement", label: "Announcement" },
  { id: "showcase", label: "Showcase" },
  { id: "tip", label: "Tip / educational" },
];

export function PostComposer() {
  return (
    <Suspense fallback={<Spinner label="Loading composer…" />}>
      <ComposerInner />
    </Suspense>
  );
}

function ComposerInner() {
  const router = useRouter();
  const search = useSearchParams();
  const editId = search.get("id");

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Option[]>([]);
  const [campaigns, setCampaigns] = useState<Option[]>([]);
  const [health, setHealth] = useState<{ aiTextConfigured: boolean; aiImageConfigured: boolean } | null>(null);

  const [companyId, setCompanyId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [platform, setPlatform] = useState("meta_instagram");
  const [contentType, setContentType] = useState("image");
  const [language, setLanguage] = useState("en");
  const [topic, setTopic] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [status, setStatus] = useState("draft");
  const [assets, setAssets] = useState<Asset[]>([]);

  const [genLoading, setGenLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState("");
  const [mediaTab, setMediaTab] = useState("template");
  const [tpl, setTpl] = useState({ template: "quote", aspect: "square", headline: "", subline: "", badge: "" });
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAspect, setAiAspect] = useState("square");
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [comps, h] = await Promise.all([
          api<{ companies: (Option & { language: string })[] }>("/api/companies"),
          api<{ aiTextConfigured: boolean; aiImageConfigured: boolean }>("/api/system/health"),
        ]);
        setCompanies(comps.companies);
        setHealth(h);
        if (comps.companies[0]) {
          setCompanyId(comps.companies[0].id);
          setLanguage(comps.companies[0].language === "both" ? "ar" : comps.companies[0].language);
        }
        if (editId) {
          const res = await api<{
            post: {
              companyId: string; campaignId: string | null; platform: string; contentType: string;
              caption: string; hashtags: string; ctaUrl: string; language: string;
              scheduledAt: string | null; status: string;
              medias: { mediaAsset: Asset }[];
            };
          }>(`/api/posts/${editId}`);
          const p = res.post;
          setCompanyId(p.companyId);
          setCampaignId(p.campaignId || "");
          setPlatform(p.platform);
          setContentType(p.contentType);
          setCaption(p.caption);
          setHashtags(p.hashtags);
          setCtaUrl(p.ctaUrl);
          setLanguage(p.language);
          setScheduledAt(p.scheduledAt ? p.scheduledAt.slice(0, 16) : "");
          setStatus(p.status === "scheduled" ? "scheduled" : "draft");
          setAssets(p.medias.map((m) => m.mediaAsset));
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to load", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  useEffect(() => {
    if (!companyId) return;
    api<{ campaigns: Option[] }>(`/api/campaigns?companyId=${companyId}`)
      .then((r) => setCampaigns(r.campaigns))
      .catch(() => setCampaigns([]));
  }, [companyId]);

  async function generate() {
    setGenLoading(true);
    try {
      const res = await api<{ variants: Variant[] }>("/api/posts/generate", {
        method: "POST",
        json: { companyId, campaignId: campaignId || undefined, platform, contentType, topic, language, count: 3 },
      });
      setVariants(res.variants);
      if (!caption && res.variants[0]) {
        setCaption(res.variants[0].caption);
        setHashtags(res.variants[0].hashtags || "");
      }
      toast(`${res.variants.length} caption options generated`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Generation failed", "error");
    } finally {
      setGenLoading(false);
    }
  }

  async function renderTemplate() {
    if (!tpl.headline.trim() && tpl.template !== "stat") return toast("Add a headline first", "error");
    setImgLoading("template");
    try {
      const res = await api<{ asset: Asset }>("/api/images/template", {
        method: "POST",
        json: { companyId, ...tpl },
      });
      setAssets((a) => [...a, res.asset]);
      toast("Design rendered", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Render failed", "error");
    } finally {
      setImgLoading("");
    }
  }

  async function generateAiImage() {
    if (!aiPrompt.trim()) return toast("Describe the image first", "error");
    setImgLoading("ai");
    try {
      const res = await api<{ asset: Asset }>("/api/images/ai", {
        method: "POST",
        json: { prompt: aiPrompt, aspect: aiAspect, companyId },
      });
      setAssets((a) => [...a, res.asset]);
      toast("Image generated", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Generation failed", "error");
    } finally {
      setImgLoading("");
    }
  }

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "upload");
    fd.append("companyId", companyId);
    try {
      const res = await api<{ asset: Asset }>("/api/upload", { method: "POST", body: fd });
      setAssets((a) => [...a, res.asset]);
      toast("Uploaded", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    }
  }

  async function save(publishNow: boolean) {
    if (!companyId) return toast("Create a company first", "error");
    if (!caption.trim()) return toast("Add a caption (generate or write one)", "error");
    const payload = {
      companyId,
      campaignId: campaignId || null,
      platform,
      contentType,
      caption,
      hashtags,
      ctaUrl,
      language,
      scheduledAt: status === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      status: status === "scheduled" && scheduledAt ? "scheduled" : "draft",
      mediaAssetIds: assets.map((a) => a.id),
    };
    try {
      let id = editId;
      if (editId) {
        await api(`/api/posts/${editId}`, { method: "PATCH", json: payload });
      } else {
        const res = await api<{ post: { id: string } }>("/api/posts", { method: "POST", json: payload });
        id = res.post.id;
      }
      if (publishNow && id) {
        const res = await api<{ status: string; message?: string }>(`/api/posts/${id}/publish`, {
          method: "POST",
          json: {},
        });
        if (res.status === "published") toast("Published!", "success");
        else if (res.status === "needs_manual") toast(res.message || "Ready for manual posting", "info");
        else toast(res.message || `Publish result: ${res.status}`, "error");
      } else {
        toast(status === "scheduled" ? "Post scheduled" : "Draft saved", "success");
      }
      router.push("/posts");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    }
  }

  if (loading) return <Spinner label="Loading composer…" />;

  return (
    <div>
      <PageHeader
        title={editId ? "Edit post" : "New post"}
        subtitle="Generate captions with AI, design branded media, schedule or publish immediately."
      />
      {health && !health.aiTextConfigured && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No AI text provider configured yet — add an API key in Settings → AI to generate captions.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: content + media */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="1 · Caption" subtitle="Describe what the post is about — the AI writes it in the company's voice." />
            <div className="space-y-4 p-5">
              <Field label="Topic / brief">
                <Textarea
                  rows={2}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Announce our new Riyadh office opening next month with a free consultation day"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Field label="Platform">
                  <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                    {PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Type">
                  <Select value={contentType} onChange={(e) => setContentType(e.target.value)}>
                    {CONTENT_TYPES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Language">
                  <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="ar">Arabic</option>
                    <option value="en">English</option>
                  </Select>
                </Field>
                <div className="flex items-end">
                  <Button onClick={generate} loading={genLoading} className="w-full">
                    <Sparkles size={15} /> Generate
                  </Button>
                </div>
              </div>

              {variants.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Options — click to use</p>
                  {variants.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCaption(v.caption);
                        setHashtags(v.hashtags || "");
                      }}
                      className={`w-full rounded-lg border p-3 text-left text-xs leading-relaxed transition-colors hover:border-[var(--accent)] ${
                        caption === v.caption ? "border-[var(--accent)] bg-accent-soft" : "border-slate-200 bg-white"
                      }`}
                    >
                      <span className="line-clamp-3 text-slate-700">{v.caption}</span>
                      {v.hashtags && <span className="mt-1 block text-[11px] text-sky-600">{v.hashtags}</span>}
                    </button>
                  ))}
                </div>
              )}

              <Field label="Caption (editable)">
                <Textarea rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} dir="auto" />
              </Field>
              <Field label="Hashtags">
                <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} dir="auto" placeholder="#tag1 #tag2" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="2 · Media" subtitle="Branded template designs, AI images, or your own files." />
            <div className="p-5">
              <Tabs
                tabs={[
                  { id: "template", label: "Template design" },
                  { id: "ai", label: "AI image" },
                  { id: "upload", label: "Upload" },
                ]}
                active={mediaTab}
                onChange={setMediaTab}
              />

              {mediaTab === "template" && (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Template">
                    <Select value={tpl.template} onChange={(e) => setTpl({ ...tpl, template: e.target.value })}>
                      {TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Size">
                    <Select value={tpl.aspect} onChange={(e) => setTpl({ ...tpl, aspect: e.target.value })}>
                      <option value="square">Square 1080×1080</option>
                      <option value="portrait">Portrait 1080×1350</option>
                      <option value="story">Story 1080×1920</option>
                    </Select>
                  </Field>
                  <div className="md:col-span-2">
                    <Field label={tpl.template === "stat" ? "Number / statistic" : "Headline"}>
                      <Input value={tpl.headline} onChange={(e) => setTpl({ ...tpl, headline: e.target.value })} dir="auto" placeholder={tpl.template === "stat" ? "98%" : "Big bold message"} />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Sub-line">
                      <Input value={tpl.subline} onChange={(e) => setTpl({ ...tpl, subline: e.target.value })} dir="auto" placeholder="Supporting detail" />
                    </Field>
                  </div>
                  <Field label="Badge (optional)">
                    <Input value={tpl.badge} onChange={(e) => setTpl({ ...tpl, badge: e.target.value })} dir="auto" placeholder="NEW / TIP / 2026" />
                  </Field>
                  <div className="flex items-end">
                    <Button onClick={renderTemplate} loading={imgLoading === "template"} className="w-full">
                      <LayoutTemplate size={15} /> Render design
                    </Button>
                  </div>
                </div>
              )}

              {mediaTab === "ai" && (
                <div className="mt-4 space-y-3">
                  {health && !health.aiImageConfigured && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      No image provider configured — add an OpenAI or Google key in Settings → AI, or use template designs.
                    </p>
                  )}
                  <Field label="Image prompt (English works best)">
                    <Textarea rows={2} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Modern Riyadh skyline at golden hour, luxury real estate photography, cinematic lighting" />
                  </Field>
                  <div className="flex gap-3">
                    <div className="w-44">
                      <Field label="Aspect">
                        <Select value={aiAspect} onChange={(e) => setAiAspect(e.target.value)}>
                          <option value="square">Square</option>
                          <option value="portrait">Portrait</option>
                          <option value="landscape">Landscape</option>
                        </Select>
                      </Field>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={generateAiImage} loading={imgLoading === "ai"}>
                        <Wand2 size={15} /> Generate image
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {mediaTab === "upload" && (
                <div className="mt-4">
                  <input ref={uploadRef} type="file" accept="image/*,video/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                  <Button variant="outline" onClick={() => uploadRef.current?.click()}>
                    <Upload size={15} /> Choose image or video
                  </Button>
                </div>
              )}

              {assets.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-3">
                  {assets.map((a) => (
                    <div key={a.id} className="group relative">
                      {a.mimeType.startsWith("video/") ? (
                        <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-slate-900 text-xs text-white">Video</div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/media/${a.filePath}`} alt="" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
                      )}
                      <button
                        onClick={() => setAssets((prev) => prev.filter((x) => x.id !== a.id))}
                        className="absolute -right-2 -top-2 rounded-full bg-rose-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: publish settings */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="3 · Publish" />
            <div className="space-y-4 p-5">
              <Field label="Company">
                <Select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setCampaignId(""); }}>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Campaign (optional)">
                <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                  <option value="">— none —</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <PlatformChip platform={platform} /> {contentType} post
              </div>
              <Field label="Link / CTA URL (optional)">
                <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Schedule">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="draft">Save as draft</option>
                  <option value="scheduled">Schedule for later</option>
                </Select>
              </Field>
              {status === "scheduled" && (
                <Field label="Date & time">
                  <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </Field>
              )}
              <div className="space-y-2 pt-1">
                <Button onClick={() => save(false)} className="w-full" variant="secondary">
                  <Save size={15} /> {editId ? "Save changes" : status === "scheduled" ? "Schedule post" : "Save draft"}
                </Button>
                <Button onClick={() => save(true)} className="w-full">
                  <Rocket size={15} /> Save & publish now
                </Button>
                <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <CalendarClock size={12} /> Scheduled posts publish automatically every minute.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <ImageIcon size={14} /> Preview
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-7 w-7 rounded-full" style={{ background: "var(--accent)" }} />
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {companies.find((c) => c.id === companyId)?.name || "Company"}
                  </div>
                  <div className="text-[10px] text-slate-400">just now</div>
                </div>
              </div>
              {assets[0] && !assets[0].mimeType.startsWith("video/") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${assets[0].filePath}`} alt="" className="mb-2 max-h-64 w-full rounded-lg object-cover" />
              )}
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700" dir="auto">
                {caption || "Caption preview…"}
              </p>
              {hashtags && <p className="mt-1 text-[11px] text-sky-600" dir="auto">{hashtags}</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
