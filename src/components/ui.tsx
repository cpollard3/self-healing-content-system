"use client";

import { useState, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export type Tone = "neutral" | "indigo" | "green" | "amber" | "red" | "sky" | "violet";

const TONES: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-700 ring-stone-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  size = "md",
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
}) {
  const v = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm",
    secondary: "bg-white text-stone-800 ring-1 ring-inset ring-stone-300 hover:bg-stone-50 shadow-sm",
    ghost: "text-stone-600 hover:bg-stone-100",
    danger: "bg-white text-rose-700 ring-1 ring-inset ring-rose-300 hover:bg-rose-50",
    success: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm",
  }[variant];
  const s = { sm: "px-2.5 py-1 text-xs", md: "px-3.5 py-2 text-sm", lg: "px-4 py-2.5 text-sm" }[size];
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        v,
        s,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-stone-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm text-stone-700"
    >
      <span className={cx("relative h-5 w-9 rounded-full transition", checked ? "bg-indigo-600" : "bg-stone-300")}>
        <span
          className={cx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function Quote({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "old" | "new" }) {
  const t = {
    neutral: "border-stone-300 bg-stone-50 text-stone-700",
    old: "border-rose-300 bg-rose-50/60 text-stone-700",
    new: "border-emerald-400 bg-emerald-50/60 text-stone-800",
  }[tone];
  return <blockquote className={cx("rounded-r-md border-l-[3px] px-3 py-1.5 text-[13px] italic leading-relaxed", t)}>“{children}”</blockquote>;
}

export function Stat({ label, value, tone = "neutral" }: { label: string; value: ReactNode; tone?: Tone }) {
  const color = {
    neutral: "text-stone-900",
    indigo: "text-indigo-700",
    green: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-rose-700",
    sky: "text-sky-700",
    violet: "text-violet-700",
  }[tone];
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <div className={cx("text-2xl font-semibold tabular-nums", color)}>{value}</div>
      <div className="mt-0.5 text-xs text-stone-500">{label}</div>
    </div>
  );
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  right,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 py-1.5 text-left text-sm font-medium text-stone-700">
        <span className={cx("text-stone-400 transition", open && "rotate-90")}>▸</span>
        <span className="flex-1">{title}</span>
        {right}
      </button>
      {open && <div className="pb-2 pl-5">{children}</div>}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-baseline justify-between gap-4 first:mt-0">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{children}</h3>
      {hint && <div className="text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-stone-300 bg-white/50 p-6 text-center text-sm text-stone-500">{children}</div>;
}
