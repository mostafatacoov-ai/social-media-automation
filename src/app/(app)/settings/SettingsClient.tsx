"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Plug, CheckCircle2, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Form";
import { PageHeader, Spinner, Tabs } from "@/components/ui/Misc";
import { PlatformChip } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { PLATFORMS } from "@/lib/constants";
import type { AiSettings, BrandingSettings } from "@/lib/settings";

type Creds = { clientId: string; clientSecret: string };
interface Account {
  id: string;
  companyId: string;
  companyName?: string;
  platform: string;
  accountName: string;
  status: string;
}

export function SettingsClient() {
  const [tab, setTab] = useState("branding");
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [ai, setAi] = useState<AiSettings | null>(null);
  const [connections, setConnections] = useState<Record<string, Creds>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [connectCompany, setConnectCompany] = useState("");
  const [saving, setSaving] = useState("");
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, acc, comps] = await Promise.all([
          api<{ branding: BrandingSettings; ai: AiSettings; connections: Record<string, Creds> }>("/api/settings"),
          api<{ accounts: Account[] }>("/api/accounts"),
          api<{ companies: { id: string; name: string }[] }>("/api/companies"),
        ]);
        setBranding(s.branding);
        setAi(s.ai);
        setConnections(s.connections);
        setAccounts(acc.accounts);
        setCompanies(comps.companies);
        if (comps.companies[0]) setConnectCompany(comps.companies[0].id);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to load settings", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveBranding() {
    if (!branding) return;
    setSaving("branding");
    try {
      await api("/api/settings", { method: "PATCH", json: { branding } });
      toast("Branding saved — refresh to see the new theme", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setSaving("");
    }
  }

  async function uploadLogo(file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "logo");
      const res = await api<{ asset: { filePath: string } }>("/api/upload", { method: "POST", body: fd });
      setBranding((b) => (b ? { ...b, logoUrl: `/api/media/${res.asset.filePath}` } : b));
      toast("Logo uploaded — remember to save", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    }
  }

  async function saveAi() {
    if (!ai) return;
    setSaving("ai");
    try {
      await api("/api/settings", { method: "PATCH", json: { ai } });
      toast("AI settings saved", "success");
      const s = await api<{ ai: AiSettings }>("/api/settings");
      setAi(s.ai);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setSaving("");
    }
  }

  async function testAi() {
    setSaving("test");
    try {
      const res = await api<{ reply: string }>("/api/settings/ai/test", { method: "POST", json: {} });
      toast(`AI responded: "${res.reply}"`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Test failed", "error");
    } finally {
      setSaving("");
    }
  }

  async function saveCreds(platform: string) {
    setSaving(platform);
    try {
      await api("/api/settings", {
        method: "PATCH",
        json: { connection: { platform, creds: connections[platform] } },
      });
      toast(`${platform} credentials saved`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setSaving("");
    }
  }

  async function disconnect(account: Account) {
    if (!confirm(`Disconnect ${account.accountName}?`)) return;
    try {
      await api(`/api/accounts/${account.id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      toast("Disconnected", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  async function startConnect(platform: string) {
    if (!connectCompany) return toast("Create a company first", "error");
    try {
      const res = await api<{ url: string }>(
        `/api/connections/${platform}/start?companyId=${connectCompany}`
      );
      window.location.href = res.url;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to start", "error");
    }
  }

  if (loading || !branding || !ai) return <Spinner label="Loading settings…" />;

  return (
    <div>
      <PageHeader title="Settings" subtitle="White-label branding, AI providers and social platform connections." />
      <Tabs
        tabs={[
          { id: "branding", label: "Branding" },
          { id: "ai", label: "AI Providers" },
          { id: "connections", label: "Connections" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-5 space-y-4">
        {tab === "branding" && (
          <Card className="max-w-2xl p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Application name">
                <Input value={branding.appName} onChange={(e) => setBranding({ ...branding, appName: e.target.value })} />
              </Field>
              <Field label="Tagline">
                <Input value={branding.tagline} onChange={(e) => setBranding({ ...branding, tagline: e.target.value })} />
              </Field>
              <Field label="Accent color" hint="Applied to buttons, links and highlights across the app.">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.accent}
                    onChange={(e) => setBranding({ ...branding, accent: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border border-slate-300"
                  />
                  <Input value={branding.accent} onChange={(e) => setBranding({ ...branding, accent: e.target.value })} />
                </div>
              </Field>
              <Field label="Logo">
                <div className="flex items-center gap-3">
                  {branding.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={branding.logoUrl} alt="logo" className="h-10 rounded border border-slate-200 bg-white p-1" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-slate-300 text-slate-300">
                      <Upload size={16} />
                    </div>
                  )}
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                  />
                  <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
                    Upload logo
                  </Button>
                  {branding.logoUrl && (
                    <Button variant="ghost" size="sm" onClick={() => setBranding({ ...branding, logoUrl: "" })}>
                      Remove
                    </Button>
                  )}
                </div>
              </Field>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={saveBranding} loading={saving === "branding"}>Save branding</Button>
            </div>
          </Card>
        )}

        {tab === "ai" && (
          <>
            <Card className="max-w-3xl p-6">
              <h3 className="mb-4 text-sm font-bold text-slate-800">Text generation</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Provider">
                  <Select
                    value={ai.textProvider}
                    onChange={(e) => setAi({ ...ai, textProvider: e.target.value as AiSettings["textProvider"] })}
                  >
                    <option value="openrouter">OpenRouter (recommended — one key, many models)</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="google">Google (Gemini)</option>
                  </Select>
                </Field>
                <Field label="Model" hint="Examples: openai/gpt-4o-mini · gpt-4o · claude-sonnet-4-5 · gemini-2.5-flash">
                  <Input value={ai.textModel} onChange={(e) => setAi({ ...ai, textModel: e.target.value })} />
                </Field>
              </div>
              <h3 className="mb-4 mt-6 text-sm font-bold text-slate-800">Image generation</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Provider">
                  <Select
                    value={ai.imageProvider}
                    onChange={(e) => setAi({ ...ai, imageProvider: e.target.value as AiSettings["imageProvider"] })}
                  >
                    <option value="none">None (template images only)</option>
                    <option value="openai">OpenAI (gpt-image-1)</option>
                    <option value="google">Google (Gemini image)</option>
                  </Select>
                </Field>
                <Field label="Model">
                  <Input value={ai.imageModel} onChange={(e) => setAi({ ...ai, imageModel: e.target.value })} />
                </Field>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={testAi} loading={saving === "test"}>Test connection</Button>
                <Button onClick={saveAi} loading={saving === "ai"}>Save AI settings</Button>
              </div>
            </Card>

            <Card className="max-w-3xl p-6">
              <h3 className="mb-4 text-sm font-bold text-slate-800">API keys</h3>
              <p className="mb-4 text-xs text-slate-500">
                Keys are encrypted at rest. Leave a field empty to keep the saved value. Only the active providers need keys.
              </p>
              <div className="space-y-4">
                {(["openrouter", "openai", "anthropic", "google"] as const).map((id) => (
                  <Field key={id} label={id === "openrouter" ? "OpenRouter API key (openrouter.ai)" : `${id[0].toUpperCase() + id.slice(1)} API key`}>
                    <Input
                      type="password"
                      placeholder={ai.providers[id]?.apiKey || "sk-…"}
                      value={ai.providers[id]?.apiKey?.startsWith("••••") ? "" : ai.providers[id]?.apiKey}
                      onChange={(e) =>
                        setAi({
                          ...ai,
                          providers: { ...ai.providers, [id]: { ...ai.providers[id], apiKey: e.target.value } },
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <div className="mt-5 flex justify-end">
                <Button onClick={saveAi} loading={saving === "ai"}>Save keys</Button>
              </div>
            </Card>
          </>
        )}

        {tab === "connections" && (
          <>
            <Card className="p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Connect a social account</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    The OAuth flow opens the platform&apos;s own page. Accounts connect to the selected company.
                  </p>
                </div>
                <div className="w-64">
                  <Field label="Company">
                    <Select value={connectCompany} onChange={(e) => setConnectCompany(e.target.value)}>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {PLATFORMS.filter((p) => p.publishMode === "api").map((p) => (
                  <Button key={p.id} variant="outline" size="sm" onClick={() => startConnect(p.id)}>
                    <Plug size={14} /> Connect {p.label}
                  </Button>
                ))}
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                  Snapchat: export mode (no public API) — content is generated and downloaded for manual posting.
                </div>
              </div>
            </Card>

            {(accounts.length > 0) && (
              <Card>
                <CardHeader title="Connected accounts" />
                <div className="divide-y divide-slate-100">
                  {accounts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <PlatformChip platform={a.platform} />
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{a.accountName}</div>
                          <div className="text-xs text-slate-400">
                            {a.companyName} · {a.platform.replace(/_/g, " ")}
                          </div>
                        </div>
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      </div>
                      <button onClick={() => disconnect(a)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-6">
              <h3 className="mb-1 text-sm font-bold text-slate-800">Developer app credentials</h3>
              <p className="mb-5 text-xs text-slate-500">
                Create a developer app on each platform, add the redirect URI shown under each field, then paste the
                client ID/secret here. Secrets are encrypted at rest.
              </p>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {PLATFORMS.filter((p) => p.publishMode === "api").map((p) => {
                  const redirect = typeof window !== "undefined"
                    ? `${window.location.origin}/api/connections/${p.id}/callback`
                    : `/api/connections/${p.id}/callback`;
                  return (
                    <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <PlatformChip platform={p.id} />
                        <span className="text-sm font-bold text-slate-800">{p.label}</span>
                      </div>
                      <p className="mb-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
                        {p.setupHint}
                        <br />
                        <span className="mt-1 block font-mono break-all">Redirect URI: {redirect}</span>
                      </p>
                      <div className="space-y-3">
                        <Field label="Client ID / App ID">
                          <Input
                            value={connections[p.id]?.clientId || ""}
                            onChange={(e) =>
                              setConnections((c) => ({
                                ...c,
                                [p.id]: { ...(c[p.id] || { clientId: "", clientSecret: "" }), clientId: e.target.value },
                              }))
                            }
                          />
                        </Field>
                        <Field label="Client secret">
                          <Input
                            type="password"
                            placeholder={connections[p.id]?.clientSecret || ""}
                            onChange={(e) =>
                              setConnections((c) => ({
                                ...c,
                                [p.id]: { ...(c[p.id] || { clientId: "", clientSecret: "" }), clientSecret: e.target.value },
                              }))
                            }
                          />
                        </Field>
                      </div>
                      <div className="mt-3 flex justify-between">
                        <a
                          href={{
                            meta_instagram: "https://developers.facebook.com/apps",
                            meta_facebook: "https://developers.facebook.com/apps",
                            linkedin: "https://www.linkedin.com/developers/apps",
                            x: "https://developer.x.com/en/portal/dashboard",
                            tiktok: "https://developers.tiktok.com/apps",
                          }[p.id]}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
                        >
                          Developer portal <ExternalLink size={11} />
                        </a>
                        <Button size="sm" variant="outline" onClick={() => saveCreds(p.id)} loading={saving === p.id}>
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
