"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandingSettings } from "@/lib/settings";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { api } from "@/lib/client";

export function LoginForm({ branding }: { branding: BrandingSettings }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", json: { email, password } });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4"
      style={{ background: `linear-gradient(135deg, #0f172a 0%, ${branding.accent}22 100%), #0f172a` }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.appName} className="mx-auto mb-3 h-12 object-contain" />
          ) : (
            <div
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-xl font-black text-white"
              style={{ background: "var(--accent)" }}
            >
              {branding.appName.charAt(0)}
            </div>
          )}
          <h1 className="text-lg font-bold text-slate-900">{branding.appName}</h1>
          <p className="text-xs text-slate-500">{branding.tagline}</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          <Field label="Password" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Log in
          </Button>
        </form>
      </div>
    </div>
  );
}
