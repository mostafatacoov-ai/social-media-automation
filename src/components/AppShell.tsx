"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  PenLine,
  Video,
  Megaphone,
  ClipboardList,
  Image as ImageIcon,
  BarChart3,
  Building2,
  Settings,
  LogOut,
  CircleDot,
} from "lucide-react";
import { BrandingSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/posts", label: "Posts", icon: PenLine },
  { href: "/reels", label: "Reels", icon: Video },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/plans", label: "Marketing Plans", icon: ClipboardList },
  { href: "/media", label: "Media Library", icon: ImageIcon },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface CompanyLite {
  id: string;
  name: string;
  primaryColor: string;
}

export function AppShell({
  branding,
  user,
  companies,
  activeCompanyId,
  children,
}: {
  branding: BrandingSettings;
  user: { name: string; email: string };
  companies: CompanyLite[];
  activeCompanyId: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mediaOnline, setMediaOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/system/health");
        const body = await res.json();
        if (alive) setMediaOnline(Boolean(body.media));
      } catch {
        if (alive) setMediaOnline(false);
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  async function switchCompany(id: string) {
    await api("/api/companies/active", { method: "POST", json: { id } });
    router.refresh();
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const activeCompany = companies.find((c) => c.id === activeCompanyId);

  return (
    <div className="flex min-h-screen" style={{ ["--accent" as string]: branding.accent }}>
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-950 text-slate-300">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-black text-white">
              {branding.appName.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">{branding.appName}</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <CircleDot
              size={12}
              className={mediaOnline === null ? "text-slate-500" : mediaOnline ? "text-emerald-400" : "text-rose-400"}
            />
            <span className={mediaOnline ? "text-slate-400" : "text-rose-300"}>
              {mediaOnline === null ? "Checking media service…" : mediaOnline ? "Media service online" : "Media service offline — run: npm run media"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <Building2 size={15} className="text-slate-400" />
            {companies.length > 0 ? (
              <select
                value={activeCompanyId || ""}
                onChange={(e) => switchCompany(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-slate-500">No company yet — create one in Companies</span>
            )}
            {activeCompany && (
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: activeCompany.primaryColor }}
                title="Company brand color"
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-700">{user.name}</div>
              <div className="text-[11px] text-slate-400">{user.email}</div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              title="Log out"
            >
              <LogOut size={14} />
              Log out
            </button>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
