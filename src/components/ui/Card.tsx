import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  hover = false,
}: {
  className?: string;
  children: ReactNode;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-[var(--surface)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_10px_30px_-18px_rgba(0,0,0,0.65)] transition-all duration-200",
        hover && "hover:-translate-y-0.5 hover:border-white/[0.16] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_16px_40px_-18px_rgba(0,0,0,0.75)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-slate-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
