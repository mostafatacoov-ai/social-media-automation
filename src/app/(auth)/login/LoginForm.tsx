"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BrandingSettings } from "@/lib/settings";
import { AuthShell } from "@/components/ui/AuthShell";
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
    <AuthShell>
      <div className="rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 text-center">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.appName} className="mx-auto mb-3 h-12 object-contain" />
          ) : (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] text-xl font-black text-white shadow-lg"
              style={{ boxShadow: "0 8px 24px -8px var(--accent)" }}
            >
              {branding.appName.charAt(0)}
            </motion.div>
          )}
          <h1 className="text-lg font-bold tracking-tight text-slate-900">{branding.appName}</h1>
          <p className="text-xs text-slate-500">{branding.tagline}</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          <Field label="Password" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && (
            <motion.p
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
              transition={{ duration: 0.4 }}
              className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600"
            >
              {error}
            </motion.p>
          )}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Log in
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
