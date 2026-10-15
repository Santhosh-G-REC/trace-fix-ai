import { Maximize, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Scenario, WNode } from "@/lib/scenarios";

export type SearchState = "current" | "path" | "frontier" | "expanded" | "rejected" | "none";

const NW = 196, NH = 60, CX = 240, RY = 132;

/** Use explicit grid positions when present; otherwise layer by BFS depth from start. */
export function layout(s: Pick<Scenario, "nodes" | "edges" | "start">) {
  const pos: Record<string, { x: number; y: number }> = {};
  const placed = s.nodes.filter((n) => n.at);
  placed.forEach((n) => (pos[n.id] = { x: n.at![0] * CX, y: n.at![1] * RY }));
  const rest = s.nodes.filter((n) => !n.at);
  if (rest.length) {
    const depth: Record<string, number> = { [s.start]: 0 };
    const q = [s.start];
    while (q.length) {
      const c = q.shift()!;
      for (const e of s.edges) if (e.from === c && depth[e.to] === undefined) { depth[e.to] = depth[c] + 1; q.push(e.to); }
    }
    const baseRow = placed.length ? Math.max(...placed.map((n) => n.at![1])) + 1 : 0;
    const rows: Record<number, number> = {};
    rest.forEach((n) => {
      const d = depth[n.id] ?? Math.max(0, ...Object.values(depth)) + 1;
      const r = rows[d] ?? 0;
      rows[d] = r + 1;
      pos[n.id] = { x: d * CX, y: (baseRow + r) * RY };
    });
  }
  return pos;
}

function clip(cx: number, cy: number, dx: number, dy: number) {
  const t = Math.min(dx ? NW / 2 / Math.abs(dx) : Infinity, dy ? NH / 2 / Math.abs(dy) : Infinity);
  return { x: cx + dx * t, y: cy + dy * t };
}

const KIND_TAG: Record<WNode["kind"], string> = { stage: "STAGE", check: "CHECK", cause: "ROOT CAUSE", recovery: "RECOVERY" };

export function WorkflowCanvas({ scenario, stateOf, activeEdge, pathEdges, selected, onSelect, cycle = [], height, className = "" }: {
  scenario: Scenario;
  stateOf?: (id: string) => SearchState;
  activeEdge?: string | null;
  pathEdges?: Set<string>;
  selected?: string | null;
  onSelect?: (id: string) => void;
  cycle?: string[];
  height?: number | string;
  className?: string;
}) {
  const pos = useMemo(() => layout(scenario), [scenario]);
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ k: 1, x: 20, y: 20 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const fit = useCallback((minK = 0) => {
    const el = wrap.current;
    const pts = Object.values(pos);
    if (!el || !pts.length) return;
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x)) + NW;
    const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y)) + NH;
    const W = el.clientWidth, H = el.clientHeight, pad = 30;
    const kW = (W - pad * 2) / (maxX - minX), kH = (H - pad * 2) / (maxY - minY);
    const k = Math.max(0.2, Math.min(1.25, kH, Math.max(kW, minK)));
    setView({ k, x: (W - (maxX - minX) * k) / 2 - minX * k, y: (H - (maxY - minY) * k) / 2 - minY * k });
  }, [pos]);
  useLayoutEffect(() => fit(0.55), [fit]);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fit(0.55));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = ev.clientX - r.left, my = ev.clientY - r.top;
      setView((v) => {
        const k = Math.min(3, Math.max(0.25, v.k * (ev.deltaY < 0 ? 1.1 : 0.9)));
        return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoom = (f: number) => setView((v) => {
    const el = wrap.current!;
    const cx = el.clientWidth / 2, cy = el.clientHeight / 2;
    const k = Math.min(3, Math.max(0.25, v.k * f));
    return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
  });

  const edgeSet = new Set(scenario.edges.map((e) => `${e.from}>${e.to}`));
  const inCycle = (a: string, b: string) => cycle.some((c, i) => c === a && cycle[i + 1] === b);

  return (
    <div ref={wrap} style={height !== undefined ? { height } : undefined} className={`grid-bg relative touch-none select-none overflow-hidden rounded-lg border border-border bg-background/70 ${className}`}
      onPointerDown={(ev) => { if ((ev.target as Element).closest("[data-node]")) return; drag.current = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y }; (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId); }}
      onPointerMove={(ev) => { const d = drag.current; if (d) setView((v) => ({ ...v, x: d.vx + ev.clientX - d.x, y: d.vy + ev.clientY - d.y })); }}
      onPointerUp={() => (drag.current = null)}
    >
      <svg width="100%" height="100%" className="cursor-grab active:cursor-grabbing" role="img" aria-label="Workflow and diagnostic graph">
        <defs>
          {["base", "path", "active"].map((m) => (
            <marker key={m} id={`arr-${m}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className={m === "path" ? "fill-success" : m === "active" ? "fill-primary" : "fill-muted-foreground"} />
            </marker>
          ))}
        </defs>
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {scenario.edges.map((e) => {
            const a = pos[e.from], b = pos[e.to];
            if (!a || !b) return null;
            const k = `${e.from}>${e.to}`;
            const ax = a.x + NW / 2, ay = a.y + NH / 2, bx = b.x + NW / 2, by = b.y + NH / 2;
            const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
            const bend = edgeSet.has(`${e.to}>${e.from}`) ? 22 : 0;
            const p1 = clip(ax, ay, dx, dy), p2 = clip(bx, by, -dx, -dy);
            const mx = (p1.x + p2.x) / 2 - (dy / len) * bend, my = (p1.y + p2.y) / 2 + (dx / len) * bend;
            const onPath = pathEdges?.has(k), active = activeEdge === k, cyc = inCycle(e.from, e.to);
            const cls = onPath ? "stroke-success" : active ? "stroke-primary" : cyc ? "stroke-destructive" : "stroke-muted-foreground/70";
            return (
              <g key={k}>
                <path d={`M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`} fill="none" strokeWidth={onPath || active ? 3 : 1.8} strokeDasharray={cyc && !onPath ? "6 4" : undefined} className={cls} markerEnd={`url(#arr-${onPath ? "path" : active ? "active" : "base"})`} />
                <g transform={`translate(${mx},${my})`}>
                  <rect x={-14} y={-10} width={28} height={20} rx={5} className={onPath ? "fill-success" : active ? "fill-primary" : "fill-secondary"} />
                  <text textAnchor="middle" y={4} className={`font-mono text-[11px] font-semibold ${onPath || active ? "fill-background" : "fill-foreground"}`}>{e.cost}</text>
                  <title>{`${e.action} — cost ${e.cost} (simulated minutes)`}</title>
                </g>
              </g>
            );
          })}
          {scenario.nodes.map((nd) => {
            const p = pos[nd.id];
            if (!p) return null;
            const st = stateOf?.(nd.id) ?? "none";
            const sel = selected === nd.id;
            const box =
              st === "current" ? "fill-primary/25 stroke-primary"
              : st === "path" ? "fill-success/20 stroke-success"
              : st === "frontier" ? "fill-accent/15 stroke-accent"
              : st === "expanded" ? "fill-info/15 stroke-info"
              : st === "rejected" ? "fill-card stroke-muted-foreground/40"
              : nd.status === "failed" ? "fill-destructive/15 stroke-destructive" : "fill-card stroke-border";
            const dot = nd.status === "success" ? "fill-success" : nd.status === "failed" ? "fill-destructive" : "fill-muted-foreground";
            const isStart = nd.id === scenario.start, isGoal = nd.id === scenario.goal;
            return (
              <g key={nd.id} data-node transform={`translate(${p.x},${p.y})`} onClick={() => onSelect?.(nd.id)} className={`cursor-pointer ${st === "rejected" ? "opacity-50" : ""}`}>
                {sel && <rect x={-5} y={-5} width={NW + 10} height={NH + 10} rx={12} className="fill-none stroke-ring" strokeWidth={2} />}
                <rect width={NW} height={NH} rx={nd.kind === "recovery" ? 30 : nd.kind === "cause" ? 16 : 8} strokeWidth={st === "current" || st === "path" || isStart || isGoal ? 2.5 : 1.5} strokeDasharray={st === "frontier" ? "5 3" : undefined} className={st === "none" && nd.status !== "failed" && (isStart || isGoal) ? `fill-card ${isGoal ? "stroke-success/70" : "stroke-primary/70"}` : box} />
                <circle cx={14} cy={20} r={4.5} className={dot} />
                <text x={26} y={24} className="fill-foreground text-[13px] font-semibold">{nd.label.length > 22 ? nd.label.slice(0, 21) + "…" : nd.label}</text>
                <text x={14} y={46} className="fill-muted-foreground font-mono text-[10px] tracking-wide">{KIND_TAG[nd.kind]}</text>
                {(isStart || isGoal) && (
                  <g transform={`translate(${NW - 52},${NH - 21})`}>
                    <rect width={44} height={15} rx={7.5} className={isGoal ? "fill-success/25" : "fill-primary/25"} />
                    <text x={22} y={11} textAnchor="middle" className={`font-mono text-[9px] font-semibold ${isGoal ? "fill-success" : "fill-primary"}`}>{isGoal ? "GOAL" : "START"}</text>
                  </g>
                )}
                <title>{nd.label}</title>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-md border border-border bg-card/95 shadow-lg">
        <button aria-label="Zoom in" onClick={() => zoom(1.2)} className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Plus className="h-4 w-4" /></button>
        <button aria-label="Zoom out" onClick={() => zoom(1 / 1.2)} className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Minus className="h-4 w-4" /></button>
        <button aria-label="Fit to view" title="Fit entire graph" onClick={() => fit()} className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Maximize className="h-4 w-4" /></button>
        <button aria-label="Reset view" title="Reset view (100%)" onClick={() => setView({ k: 1, x: 24, y: 24 })} className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><RotateCcw className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function Legend() {
  const items: [string, string][] = [
    ["border-primary bg-primary/25", "Exploring now"],
    ["border-accent border-dashed bg-accent/15", "Frontier"],
    ["border-info bg-info/15", "Expanded"],
    ["border-success bg-success/20", "Selected path"],
    ["border-muted-foreground/40 opacity-50", "Rejected / dead end"],
    ["border-destructive bg-destructive/15", "Failed stage"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {items.map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className={`inline-block h-3 w-4 rounded-sm border-2 ${c}`} />{l}</span>)}
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />passed</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground" />pending</span>
      <span>Badge = simulated cost (min)</span>
    </div>
  );
}
