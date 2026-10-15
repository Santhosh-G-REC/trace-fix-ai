import { Link, useRouterState } from "@tanstack/react-router";
import { Boxes, History, Network, PlayCircle } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Simulator", icon: PlayCircle },
  { to: "/builder", label: "Workflow Builder", icon: Network },
  { to: "/history", label: "Run History", icon: History },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="z-30 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-sidebar px-3 py-1.5">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Boxes className="h-4 w-4" /></div>
          <span className="text-sm font-bold">Trace Fix AI</span>
        </Link>
        <nav className="flex flex-wrap gap-1">
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={`flex items-center gap-2 rounded-md px-2.5 py-1 text-sm ${active ? "bg-sidebar-accent text-primary" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            );
          })}
        </nav>
        <span className="ml-auto hidden rounded border border-warning/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warning sm:inline">Simulated environment</span>
      </header>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3">{children}</main>
    </div>
  );
}

export function Panel({ title, children, className = "", right }: { title?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`rounded-lg border border-border bg-card p-3 ${className}`}>
      {title && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Metric({ label, value, tone }: { label: string; value: ReactNode; tone?: "primary" | "success" | "destructive" | "accent" }) {
  const c = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : tone === "accent" ? "text-accent" : tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`truncate font-mono text-base font-semibold ${c}`}>{value}</div>
    </div>
  );
}

export function Btn({ children, onClick, variant = "primary", className = "", disabled, title }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost"; className?: string; disabled?: boolean; title?: string }) {
  return (
    <button title={title} disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border bg-secondary text-secondary-foreground hover:bg-muted"} ${className}`}>
      {children}
    </button>
  );
}

export function Tip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-md border border-border bg-popover p-2 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">{text}</span>
    </span>
  );
}
