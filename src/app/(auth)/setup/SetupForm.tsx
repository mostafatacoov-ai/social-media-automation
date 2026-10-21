"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { BrandingSettings } from "@/lib/settings";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { api } from "@/lib/client";

export function SetupForm({ branding }: { branding: BrandingSettings }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/setup", {
        method: "POST",
        json: { name: form.name, email: form.email, password: form.password },
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, #0f172a 0%, ${branding.accent}22 100%), #0f172a` }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-white"
            style={{ background: branding.accent }}
          >
            <Rocket size={22} />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Welcome to {branding.appName}</h1>
          <p className="mt-1 text-xs text-slate-500">
            First run — create your admin account to get started.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Your name" required>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          </Field>
          <Field label="Password" hint="Minimum 8 characters" required>
            <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
          </Field>
          <Field label="Confirm password" required>
            <Input type="password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} required />
          </Field>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Create admin account
          </Button>
        </form>
      </div>
    </div>
  );
}
