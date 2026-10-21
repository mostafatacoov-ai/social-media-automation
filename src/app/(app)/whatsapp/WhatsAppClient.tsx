"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  MessageCircle,
  Send,
  ImagePlus,
  FileText,
  Bot,
  CheckCheck,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, Spinner, Badge } from "@/components/ui/Misc";
import { toast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";

interface Conversation {
  id: string;
  waId: string;
  name: string;
  unread: number;
  windowOpen: boolean;
  lastMessage: { body: string; direction: string; at: string } | null;
}
interface Message {
  id: string;
  direction: string;
  kind: string;
  body: string;
  status: string;
  createdAt: string;
}
interface WaSettings {
  phoneNumberId: string;
  wabaId: string;
  token: string;
  verifyToken: string;
  autoReplyCompanies: string[];
  connected: boolean;
}

export function WhatsAppClient() {
  const [settings, setSettings] = useState<WaSettings | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [tpl, setTpl] = useState({ template: "", language: "en", params: "" });
  const [attachOpen, setAttachOpen] = useState(false);
  const [assets, setAssets] = useState<{ id: string; filePath: string }[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

  // Load settings + companies
  useEffect(() => {
    (async () => {
      const [s, c] = await Promise.all([
        api<WaSettings>("/api/whatsapp/settings"),
        api<{ companies: { id: string; name: string }[] }>("/api/companies"),
      ]);
      setSettings(s);
      setCompanies(c.companies);
      if (c.companies[0]) setCompanyId(c.companies[0].id);
    })().catch((e) => toast(e.message, "error"));
  }, []);

  // Poll conversations
  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    const load = () =>
      api<{ conversations: Conversation[] }>(`/api/whatsapp/conversations?companyId=${companyId}`)
        .then((r) => alive && setConversations(r.conversations))
        .catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [companyId]);

  // Load + poll thread, mark read
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const load = () =>
      api<{ messages: Message[] }>(`/api/whatsapp/messages?contactId=${active.id}`)
        .then((r) => alive && setMessages(r.messages))
        .catch(() => {});
    setMessages(null);
    load();
    api("/api/whatsapp/read", { method: "POST", json: { contactId: active.id } }).catch(() => {});
    setConversations((prev) => prev?.map((c) => (c.id === active.id ? { ...c, unread: 0 } : c)) || null);
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [active?.id]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  async function send(mediaAssetId?: string) {
    if (!active) return;
    if (!text.trim() && !mediaAssetId) return;
    setSending(true);
    try {
      await api("/api/whatsapp/send", {
        method: "POST",
        json: { contactId: active.id, text: text.trim(), mediaAssetId },
      });
      setText("");
      const r = await api<{ messages: Message[] }>(`/api/whatsapp/messages?contactId=${active.id}`);
      setMessages(r.messages);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Send failed", "error");
    } finally {
      setSending(false);
    }
  }

  async function sendTemplate() {
    if (!active || !tpl.template.trim()) return toast("Template name is required", "error");
    try {
      await api("/api/whatsapp/template", {
        method: "POST",
        json: {
          contactId: active.id,
          template: tpl.template.trim(),
          language: tpl.language,
          params: tpl.params ? tpl.params.split("|").map((p) => p.trim()) : [],
        },
      });
      toast("Template sent", "success");
      setTplOpen(false);
      const r = await api<{ messages: Message[] }>(`/api/whatsapp/messages?contactId=${active.id}`);
      setMessages(r.messages);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  async function toggleAutoReply() {
    if (!settings || !companyId) return;
    const enabled = !settings.autoReplyCompanies.includes(companyId);
    const s = await api<WaSettings>("/api/whatsapp/settings", {
      method: "PATCH",
      json: { autoReply: { companyId, enabled } },
    });
    setSettings(s);
    toast(
      enabled
        ? "AI auto-reply ON — Ziad (WhatsApp Concierge) will answer new messages instantly"
        : "AI auto-reply off",
      "success"
    );
  }

  if (!settings) return <Spinner label="Loading WhatsApp…" />;

  const autoReplyOn = settings.autoReplyCompanies.includes(companyId);
  const webhookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/whatsapp/webhook?company=${companyId}`;

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        subtitle="Send and reply to customer messages on your WhatsApp Business number — with an AI concierge that never sleeps."
        actions={
          <div className="flex items-center gap-2">
            <Button variant={autoReplyOn ? "primary" : "outline"} size="sm" onClick={toggleAutoReply}>
              <Bot size={14} className={autoReplyOn ? "animate-pulse" : ""} />
              {autoReplyOn ? "AI auto-reply ON" : "AI auto-reply off"}
            </Button>
          </div>
        }
      />

      {/* Connection setup */}
      <AnimatePresence>
        {!settings.connected && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="mb-5 p-5">
              <h3 className="mb-1 text-sm font-bold text-slate-800">Connect your WhatsApp Business number</h3>
              <p className="mb-4 text-xs leading-relaxed text-slate-500">
                Uses the official <strong>WhatsApp Cloud API</strong> (free tier: unlimited messages within 24h customer
                windows + 1,000 service conversations/month). In{" "}
                <a href="https://developers.facebook.com/apps" target="_blank" className="font-semibold text-[var(--accent)] hover:underline">
                  Meta Developers <ExternalLink size={10} className="inline" />
                </a>{" "}
                create an app with the WhatsApp product, then paste the phone number ID and a permanent token
                (Business Settings → System Users → Generate token with whatsapp_business_messaging permission).
              </p>
              <ConnectionForm settings={settings} onSaved={setSettings} />
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                <strong className="text-slate-700">Webhook (to receive replies):</strong> in Meta → WhatsApp →
                Configuration, set the callback URL to
                <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-[var(--accent)]">{webhookUrl}</code>
                with your verify token. Receiving replies needs a public URL — when running locally, set
                PUBLIC_BASE_URL to a tunnel (e.g. ngrok). Sending works without it.
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inbox */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3" style={{ minHeight: 560 }}>
        {/* Conversations */}
        <Card className="flex flex-col overflow-hidden lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <MessageCircle size={15} className="text-[var(--accent)]" />
            <span className="text-sm font-bold text-slate-800">Conversations</span>
            {companyId && (
              <Select
                className="ml-auto w-36 text-xs"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setActive(null);
                }}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            )}
          </div>
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
            {conversations === null && <Spinner />}
            {conversations?.length === 0 && (
              <p className="px-4 py-10 text-center text-xs leading-relaxed text-slate-400">
                No conversations yet.
                <br />Messages arrive here automatically when customers message your number.
              </p>
            )}
            {conversations?.map((c) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setActive(c)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                  active?.id === c.id ? "bg-accent-soft" : "hover:bg-slate-50"
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                  {(c.name || c.waId).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-bold text-slate-800">{c.name || c.waId}</span>
                    {c.unread > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-slate-400">
                    {c.lastMessage ? `${c.lastMessage.direction === "out" ? "You: " : ""}${c.lastMessage.body}` : "—"}
                  </p>
                </div>
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", c.windowOpen ? "bg-emerald-400" : "bg-slate-300")} title={c.windowOpen ? "24h window open" : "window closed — use a template"} />
              </motion.button>
            ))}
          </div>
        </Card>

        {/* Thread */}
        <Card className="flex flex-col overflow-hidden lg:col-span-2">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-300">
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
                <MessageCircle size={44} />
              </motion.div>
              <p className="text-xs text-slate-400">Select a conversation to start replying</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                  {(active.name || active.waId).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{active.name || active.waId}</div>
                  <div className="text-[11px] text-slate-400">+{active.waId}</div>
                </div>
                <div className="ml-auto">
                  {active.windowOpen ? (
                    <Badge color="green">24h window open</Badge>
                  ) : (
                    <Badge color="amber">window closed — templates only</Badge>
                  )}
                </div>
              </div>

              <div ref={threadRef} className="flex-1 space-y-2 overflow-y-auto bg-slate-50/50 px-4 py-4" style={{ maxHeight: 420 }}>
                {messages === null && <Spinner />}
                <AnimatePresence initial={false}>
                  {messages?.map((m) => (
                    <motion.div
                      key={m.id}
                      layout
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-sm",
                          m.direction === "out"
                            ? "rounded-br-md bg-emerald-600 text-white"
                            : "rounded-bl-md bg-white text-slate-800"
                        )}
                        dir="auto"
                      >
                        {m.body}
                        {m.direction === "out" && (
                          <span className="ml-1.5 inline-flex align-middle text-[10px] opacity-70">
                            <CheckCheck size={11} />
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="border-t border-slate-100 p-3">
                <div className="flex items-end gap-2">
                  <button
                    onClick={async () => {
                      setAttachOpen(true);
                      const r = await api<{ assets: { id: string; filePath: string }[] }>(`/api/media-assets?companyId=${companyId}`);
                      setAssets(r.assets.filter((a) => !a.filePath.endsWith(".mp4")).slice(0, 12));
                    }}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Attach image"
                  >
                    <ImagePlus size={17} />
                  </button>
                  <button
                    onClick={() => setTplOpen(true)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Send template"
                  >
                    <FileText size={17} />
                  </button>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    dir="auto"
                    placeholder="Type a reply… (Enter to send)"
                    className="max-h-28 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm ring-accent"
                  />
                  <Button onClick={() => send()} loading={sending} disabled={!text.trim()} className="shrink-0 !px-3">
                    <Send size={15} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Template modal */}
      <Modal open={tplOpen} onClose={() => setTplOpen(false)} title="Send approved template">
        <div className="space-y-4">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
            WhatsApp only allows free-form replies within 24h of the customer&apos;s last message. Outside that window,
            send a pre-approved template (create it in Meta → WhatsApp → Message Templates).
          </p>
          <Field label="Template name" required>
            <Input value={tpl.template} onChange={(e) => setTpl({ ...tpl, template: e.target.value })} placeholder="e.g. order_update" />
          </Field>
          <Field label="Language code">
            <Input value={tpl.language} onChange={(e) => setTpl({ ...tpl, language: e.target.value })} placeholder="en / ar" />
          </Field>
          <Field label="Body parameters" hint="Separate with | in order, e.g. Ahmed | 2 days">
            <Input value={tpl.params} onChange={(e) => setTpl({ ...tpl, params: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTplOpen(false)}>Cancel</Button>
            <Button onClick={sendTemplate}>Send template</Button>
          </div>
        </div>
      </Modal>

      {/* Attach image modal */}
      <Modal open={attachOpen} onClose={() => setAttachOpen(false)} title="Attach an image">
        {assets.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No images in the media library yet.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {assets.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a.id}
                src={`/api/media/${a.filePath}`}
                alt=""
                onClick={async () => {
                  setAttachOpen(false);
                  await send(a.id);
                }}
                className="h-20 w-full cursor-pointer rounded-lg border border-slate-200 object-cover transition-all hover:border-[var(--accent)] hover:shadow-md"
              />
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          <RefreshCw size={10} className="mr-1 inline" />
          Note: WhatsApp fetches images by URL — use a public PUBLIC_BASE_URL when running locally.
        </p>
      </Modal>
    </div>
  );
}

function ConnectionForm({ settings, onSaved }: { settings: WaSettings; onSaved: (s: WaSettings) => void }) {
  const [form, setForm] = useState({
    phoneNumberId: settings.phoneNumberId,
    wabaId: settings.wabaId,
    token: "",
    verifyToken: "",
  });
  const [saving, setSaving] = useState("");
  const [testResult, setTestResult] = useState<string>("");

  async function save() {
    setSaving("save");
    try {
      const s = await api<WaSettings>("/api/whatsapp/settings", { method: "PATCH", json: form });
      onSaved(s);
      toast("WhatsApp connection saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setSaving("");
    }
  }

  async function test() {
    setSaving("test");
    setTestResult("");
    try {
      const r = await api<{ name?: string; phone?: string; quality?: string }>("/api/whatsapp/settings", {
        method: "POST",
        json: {},
      });
      setTestResult(`✓ Connected as "${r.name}" (${r.phone}) · quality: ${r.quality}`);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Test failed");
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label="Phone number ID" required>
        <Input value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} placeholder="123456789012345" />
      </Field>
      <Field label="WABA ID (optional)">
        <Input value={form.wabaId} onChange={(e) => setForm({ ...form, wabaId: e.target.value })} />
      </Field>
      <Field label="Permanent access token" required hint={settings.token ? "Saved — leave empty to keep" : "Meta Business Settings → System Users"}>
        <Input type="password" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder={settings.token || "EAAG…"} />
      </Field>
      <Field label="Webhook verify token" hint="Any string you also type in Meta's webhook config">
        <Input value={form.verifyToken} onChange={(e) => setForm({ ...form, verifyToken: e.target.value })} placeholder={settings.verifyToken ? "configured — leave empty to keep" : "my-secret-verify-token"} />
      </Field>
      <div className="flex items-center gap-2 md:col-span-2">
        <Button size="sm" onClick={save} loading={saving === "save"}>Save</Button>
        <Button size="sm" variant="outline" onClick={test} loading={saving === "test"}>Test connection</Button>
        {testResult && <span className="text-xs text-slate-600">{testResult}</span>}
      </div>
    </div>
  );
}
