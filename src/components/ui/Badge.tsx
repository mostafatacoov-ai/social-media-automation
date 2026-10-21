import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PLATFORM_MAP } from "@/lib/constants";

export function Badge({
  children,
  color = "slate",
  className,
}: {
  children: ReactNode;
  color?: "slate" | "green" | "red" | "amber" | "blue" | "purple";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        color === "slate" && "bg-slate-100 text-slate-600",
        color === "green" && "bg-emerald-100 text-emerald-700",
        color === "red" && "bg-rose-100 text-rose-700",
        color === "amber" && "bg-amber-100 text-amber-700",
        color === "blue" && "bg-sky-100 text-sky-700",
        color === "purple" && "bg-violet-100 text-violet-700",
        className
      )}
    >
      {children}
    </span>
  );
}

export function PlatformChip({ platform, className }: { platform: string; className?: string }) {
  const meta = PLATFORM_MAP[platform];
  const label = meta?.short || platform.slice(0, 2).toUpperCase();
  return (
    <span
      className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white", className)}
      style={{ background: meta?.color || "#64748b" }}
      title={meta?.label || platform}
    >
      {label}
    </span>
  );
}

const STATUS_COLORS: Record<string, "slate" | "green" | "red" | "amber" | "blue" | "purple"> = {
  draft: "slate",
  scheduled: "blue",
  publishing: "amber",
  published: "green",
  failed: "red",
  needs_manual: "amber",
  rendering: "amber",
  ready: "green",
  active: "green",
  completed: "slate",
  connected: "green",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge color={STATUS_COLORS[status] || "slate"}>{status.replace(/_/g, " ")}</Badge>;
}
