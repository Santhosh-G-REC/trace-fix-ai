import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Columns3, Info, Pause, Play, RotateCcw, SkipForward, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, Panel, Tip } from "@/components/AppShell";
import { Legend, WorkflowCanvas, type SearchState } from "@/components/WorkflowCanvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ALGOS, findCycle, runAlgo, type AlgoId, type EventType } from "@/lib/algorithms/search";
import { applyCosts, edgeKey, SCENARIOS, type Scenario } from "@/lib/scenarios";
import { addRun, allScenarios, setScenarioId, useCustomScenarios, useScenarioId } from "@/lib/store";
import { toRecord } from "@/lib/runs";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/")({
  head: () => meta("Workflow Failure Simulator", "Run BFS, UCS and A* step by step on simulated CI/CD failure graphs and see which diagnostic path each finds."),
  component: Simulator,
});

const SPEEDS = [1200, 700, 400, 200, 80];
const EV_STYLE: Record<EventType, string> = { init: "text-muted-foreground", expand: "text-primary", generate: "text-accent", update: "text-warning", skip: "text-muted-foreground", goal: "text-success", exhausted: "text-destructive" };

function Simulator() {
  const custom = useCustomScenarios();
  const scenarios = allScenarios(custom);
  const scenarioId = useScenarioId();
  const base = scenarios.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const [algo, setAlgo] = useState<AlgoId>("bfs");
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [selected, setSelected] = useState<string | null>(base.start);
  const [compareOpen, setCompareOpen] = useState(false);
  const recorded = useRef<unknown>(null);
  const timeline = useRef<HTMLDivElement>(null);

  const graph = useMemo(() => applyCosts(base, overrides), [base, overrides]);
  const result = useMemo(() => runAlgo(graph, algo), [graph, algo]);
  const cycle = useMemo(() => findCycle(graph) ?? [], [graph]);
  const events = result.events;
  const last = events.length - 1;

  useEffect(() => { setOverrides({}); setSelected(base.start); }, [base.id, base.start]);
  useEffect(() => { setIdx(-1); setPlaying(false); recorded.current = null; }, [result]);
  useEffect(() => {
    if (!playing) return;
    if (idx >= last) { setPlaying(false); return; }
    const t = setTimeout(() => setIdx((i) => i + 1), SPEEDS[speed]);
    return () => clearTimeout(t);
  }, [playing, idx, last, speed]);
  useEffect(() => {
    if (idx === last && recorded.current !== result) { recorded.current = result; addRun(toRecord(graph, result, overrides)); }
  }, [idx, last, result, graph, overrides]);
  useEffect(() => { const el = timeline.current; if (el) el.scrollTop = el.scrollHeight; }, [idx]);

  const ev = idx >= 0 ? events[idx] : null;
  const done = idx === last;
  const pathSet = new Set(done && result.found ? result.path : []);
  const pathEdges = new Set(done && result.found ? result.path.slice(1).map((p, i) => `${result.path[i]}>${p}`) : []);
  const expanded = new Set(ev?.expanded ?? []);
  const frontier = new Set((ev?.frontier ?? []).map((f) => f.id));
  const current = ev ? (ev.type === "expand" || ev.type === "goal" || ev.type === "init" ? ev.node : ev.from ?? null) : null;
  const activeEdge = ev?.from && !done ? `${ev.from}>${ev.node}` : null;
  const stateOf = (id: string): SearchState => {
    if (pathSet.has(id)) return "path";
    if (!done && current === id) return "current";
    if (frontier.has(id)) return "frontier";
    if (expanded.has(id)) return done ? "rejected" : "expanded";
    return "none";
  };

  const status = idx < 0 ? "Ready" : done ? (result.found ? "Goal reached" : "Goal not reached") : playing ? "Running" : "Paused";
  const run = () => {
    if (playing) { setPlaying(false); return; }
    if (done) setIdx(-1);
    setPlaying(true);
  };
  const step = () => { setPlaying(false); setIdx((i) => Math.min(last, i + 1)); };
  const reset = () => { setPlaying(false); setIdx(-1); };

  const sel = graph.nodes.find((n) => n.id === selected) ?? null;
  const lbl = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  const algoMeta = ALGOS.find((a) => a.id === algo)!;

  const chip = (k: string, v: string | number, tone = "") => (
    <span key={k} className="inline-flex items-baseline gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs">
      <span className="text-muted-foreground">{k}</span><span className={`font-mono font-semibold ${tone}`}>{v}</span>
    </span>
  );

  return (
    <div className="flex min-h-full flex-col gap-2 xl:h-full xl:min-h-0">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
        <select aria-label="Scenario" value={base.id} onChange={(e) => setScenarioId(e.target.value)} className="h-8 min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-sm sm:w-64">
          {scenarios.map((s) => <option key={s.id} value={s.id}>{s.custom ? "★ " : ""}{s.title}</option>)}
        </select>
        <div className="flex h-8 items-center rounded-md border border-border p-0.5" role="radiogroup" aria-label="Algorithm">
          {ALGOS.map((a) => (
            <Tip key={a.id} text={a.tip}>
              <button role="radio" aria-checked={algo === a.id} onClick={() => setAlgo(a.id)} className={`h-6 rounded px-3 font-mono text-sm ${algo === a.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{a.short}</button>
            </Tip>
          ))}
        </div>
        <Tip text="BFS minimises the number of transitions (edge costs ignored). UCS minimises total accumulated cost. A* adds an estimate of the remaining cost, h(n), to guide the search."><Info className="h-4 w-4 text-muted-foreground" /></Tip>
        <div className="flex flex-wrap items-center gap-1.5">
          <Btn className="h-8" onClick={run}>{playing ? <><Pause className="h-4 w-4" />Pause</> : idx >= 0 && !done ? <><Play className="h-4 w-4" />Resume</> : <><Play className="h-4 w-4" />Run</>}</Btn>
          <Btn className="h-8" variant="ghost" onClick={step} disabled={done} title="Advance one recorded event"><SkipForward className="h-4 w-4" />Step</Btn>
          <Btn className="h-8" variant="ghost" onClick={reset} disabled={idx < 0}><RotateCcw className="h-4 w-4" />Reset</Btn>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Speed
          <input type="range" min={0} max={4} value={speed} onChange={(e) => setSpeed(+e.target.value)} className="w-20 accent-primary" aria-label="Animation speed" />
        </label>
        <Btn className="h-8" variant="ghost" onClick={() => setCompareOpen(true)}><Columns3 className="h-4 w-4" />Compare 3</Btn>
        <span className={`ml-auto rounded-md px-2 py-1 font-mono text-xs ${done ? (result.found ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive") : playing ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          {algoMeta.short} · {status}{idx >= 0 ? ` · ${idx + 1}/${events.length}` : ""}
        </span>
      </div>

      {/* Workspace */}
      <div className="grid gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[250px_minmax(0,1fr)_285px]">
        {/* Left */}
        <aside className="space-y-2 xl:min-h-0 xl:overflow-y-auto xl:pr-0.5">
          <section className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="min-w-0 text-sm font-semibold leading-snug">{graph.title}</h2>
              <span className="shrink-0 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-warning">simulated</span>
            </div>
            <p className="text-xs leading-relaxed text-destructive">{graph.failure}</p>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex gap-2"><span className="w-10 shrink-0 text-muted-foreground">Start</span><span className="text-primary">{lbl(graph.start)}</span></div>
              <div className="flex gap-2"><span className="w-10 shrink-0 text-muted-foreground">Goal</span><span className="text-success">{lbl(graph.goal)}</span></div>
            </div>
            {cycle.length > 0 && <p className="mt-2 rounded bg-destructive/10 p-1.5 text-[11px] text-destructive">Cycle: {cycle.map(lbl).join(" → ")}</p>}
          </section>
          <details className="group rounded-lg border border-border bg-card" open>
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Conditions & logs</summary>
            <div className="space-y-2 px-3 pb-3">
              {graph.conditions.length > 0 && <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">{graph.conditions.map((c) => <li key={c}>{c}</li>)}</ul>}
              <pre className="whitespace-pre-wrap break-words rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">{graph.logs || "No logs"}</pre>
            </div>
          </details>
          <details className="rounded-lg border border-border bg-card">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              Transition costs {Object.keys(overrides).length > 0 && <span className="ml-1 text-primary">({Object.keys(overrides).length} edited)</span>}
            </summary>
            <div className="space-y-1.5 px-3 pb-3">
              {base.edges.map((e) => {
                const k = edgeKey(e);
                return (
                  <label key={k} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 leading-snug" title={`${lbl(e.from)} → ${lbl(e.to)}`}>{e.action}</span>
                    <input type="number" min={0} step={1} value={overrides[k] ?? e.cost} onChange={(ev2) => { const v = Math.max(0, +ev2.target.value || 0); setOverrides((o) => ({ ...o, [k]: v })); }} className={`h-7 w-14 shrink-0 rounded border bg-background px-1.5 text-right font-mono ${overrides[k] !== undefined ? "border-primary" : "border-input"}`} />
                  </label>
                );
              })}
              <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                <span>Simulated minutes</span>
                {Object.keys(overrides).length > 0 && <button onClick={() => setOverrides({})} className="text-primary hover:underline">Reset costs</button>}
              </div>
            </div>
          </details>
        </aside>

        {/* Center */}
        <div className="flex min-w-0 flex-col gap-2 xl:min-h-0">
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {chip("Expanded", ev?.expanded.length ?? 0, "text-primary")}
            {chip("Reached", ev?.reached.length ?? 0)}
            {chip("Transitions", ev?.transitions ?? 0)}
            {chip("Frontier", ev?.frontier.length ?? 0, "text-accent")}
            {chip("Path length", done && result.found ? result.length : "—")}
            {chip("Path cost", done && result.found ? result.cost : "—", done && result.found ? "text-success" : "")}
            {chip("Compute", idx >= 0 ? `${result.runtimeMs.toFixed(2)} ms` : "—")}
          </div>
          <WorkflowCanvas key={graph.id} scenario={graph} stateOf={stateOf} activeEdge={activeEdge} pathEdges={pathEdges} selected={selected} onSelect={setSelected} cycle={cycle} className="h-[58vh] min-h-[380px] xl:h-auto xl:flex-1" />
          <div className="shrink-0"><Legend /></div>
          {algo === "astar" && <p className="shrink-0 text-[11px] text-muted-foreground">A* heuristic: h(n) = fewest remaining transitions × cheapest edge cost. It never overestimates, so A* still returns the cheapest path.</p>}
        </div>

        {/* Right */}
        <aside className="space-y-2 xl:min-h-0 xl:overflow-y-auto xl:pr-0.5">
          {done && (
            <section className={`rounded-lg border bg-card p-3 ${result.found ? "border-success/50" : "border-destructive/50"}`}>
              {result.found ? (
                <>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" />Path found by {algoMeta.short}</div>
                  <ol className="mt-2 space-y-0.5 text-xs">{result.path.map((p, i) => <li key={p}><span className="mr-1 font-mono text-muted-foreground">{i + 1}.</span>{lbl(p)}</li>)}</ol>
                  <p className="mt-2 text-xs">{result.length} transitions · cost <span className="font-mono text-success">{result.cost}</span> min</p>
                  <p className="mt-2 rounded bg-success/10 p-2 text-xs">Recovery: <strong>{lbl(result.path[result.path.length - 1])}</strong></p>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{algo === "bfs" ? "Fewest transitions. BFS does not compare costs." : "No other path to the goal has a lower total cost."}</p>
                </>
              ) : <div className="flex items-center gap-1.5 text-sm text-destructive"><XCircle className="h-4 w-4" />Goal not reachable</div>}
            </section>
          )}
          {renderInspector()}
        </aside>
      </div>

      {/* Timeline */}
      <section className="shrink-0 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between px-3 py-1.5">
          <h2 className="text-xs font-medium text-muted-foreground">Execution timeline · {algoMeta.name}</h2>
          <span className="font-mono text-[11px] text-muted-foreground">{idx + 1} / {events.length}</span>
        </div>
        <div ref={timeline} className="h-28 overflow-y-auto border-t border-border font-mono text-xs">
          {idx < 0 ? <p className="px-3 py-2 font-sans text-muted-foreground">Press Run or Step. Each line is recorded from the real algorithm run.</p> : events.slice(0, idx + 1).map((e, i) => (
            <button key={i} onClick={() => { setPlaying(false); setIdx(i); setSelected(e.node); }} className={`flex w-full gap-3 px-3 py-0.5 text-left hover:bg-muted ${i === idx ? "bg-primary/10" : ""}`}>
              <span className="w-7 shrink-0 text-right text-muted-foreground">{i + 1}</span>
              <span className={`w-16 shrink-0 uppercase ${EV_STYLE[e.type]}`}>{e.type}</span>
              <span className="min-w-0 truncate">{e.message}</span>
            </button>
          ))}
        </div>
      </section>

      <CompareDialog graph={graph} overrides={overrides} open={compareOpen} onOpenChange={setCompareOpen} />
    </div>
  );

  function renderInspector() {
    if (!sel) return <Panel title="Inspector"><p className="text-sm text-muted-foreground">Click a node on the graph to inspect it.</p></Panel>;
    const st = stateOf(sel.id);
    const outE = graph.edges.filter((e) => e.from === sel.id);
    const inE = graph.edges.filter((e) => e.to === sel.id);
    const seen = events.slice(0, idx + 1);
    const gEv = [...seen].reverse().find((e) => e.node === sel.id && e.g !== undefined && e.type !== "skip");
    const why = [...seen].reverse().find((e) => e.node === sel.id && (e.type === "expand" || e.type === "goal"));
    const h = result.h[sel.id];
    const stLabel = { current: "Exploring now", path: "On selected path", frontier: "In frontier", expanded: "Expanded", rejected: "Expanded, not on final path", none: idx < 0 ? "Not run yet" : "Not reached" }[st];
    return (
      <Panel title="State inspector">
        <h3 className="text-sm font-semibold">{sel.label}</h3>
        <p className="font-mono text-[10px] uppercase text-muted-foreground">{sel.kind} · {sel.status}{sel.id === graph.start ? " · start" : ""}{sel.id === graph.goal ? " · goal" : ""}</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
          <div className="rounded bg-muted p-1"><div className="text-[9px] text-muted-foreground">g</div>{gEv?.g ?? "—"}</div>
          <div className="rounded bg-muted p-1"><div className="text-[9px] text-muted-foreground">h</div>{algo === "astar" ? (h === Infinity ? "∞" : h) : "—"}</div>
          <div className="rounded bg-muted p-1"><div className="text-[9px] text-muted-foreground">f</div>{algo === "astar" && gEv?.g !== undefined ? (h === Infinity ? "∞" : gEv.g + h) : "—"}</div>
        </div>
        <p className="mt-2 text-xs">Status: <span className="text-primary">{stLabel}</span></p>
        <p className="mt-1 text-[11px] text-muted-foreground">{why?.reason ?? (st === "frontier" ? "Waiting in the frontier; not selected yet." : idx >= 0 ? "Not expanded at this point of the run." : "Run the algorithm to see why states are selected.")}</p>
        {sel.logs.length > 0 && <div className="mt-2"><div className="font-mono text-[9px] uppercase text-muted-foreground">Logs / evidence</div><ul className="mt-0.5 space-y-0.5 break-words font-mono text-[11px]">{sel.logs.map((l) => <li key={l}>› {l}</li>)}</ul></div>}
        <div className="mt-2">
          <div className="font-mono text-[9px] uppercase text-muted-foreground">Outgoing actions</div>
          {outE.length ? <ul className="mt-0.5 space-y-1">{outE.map((e) => (
            <li key={e.to}><button onClick={() => setSelected(e.to)} className="flex w-full items-center gap-1 rounded border border-border px-1.5 py-1 text-left text-[11px] hover:bg-muted">
              <span className="min-w-0 flex-1"><span className="block leading-snug">{e.action}</span><span className="flex items-center gap-1 text-muted-foreground"><ArrowRight className="h-3 w-3 shrink-0" />{lbl(e.to)}</span></span><span className="shrink-0 rounded bg-secondary px-1.5 font-mono">{e.cost}</span>
            </button></li>))}</ul> : <p className="text-[11px] text-muted-foreground">None (terminal state)</p>}
        </div>
        {inE.length > 0 && <p className="mt-2 text-[11px] text-muted-foreground">Reached from: {inE.map((e) => lbl(e.from)).join(", ")}</p>}
      </Panel>
    );
  }
}

function CompareDialog({ graph, overrides, open: compareOpen, onOpenChange: setCompareOpen }: { graph: Scenario; overrides: Record<string, number>; open: boolean; onOpenChange: (v: boolean) => void }) {
    const lbl = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
    const rows = useMemo(() => (compareOpen ? ALGOS.map((a) => ({ a, r: runAlgo(graph, a.id) })) : []), [compareOpen, graph]);
    useEffect(() => setSaved(false), [compareOpen, graph]);
    const [saved, setSaved] = useState(false);
    const minCost = Math.min(...rows.filter((x) => x.r.found).map((x) => x.r.cost));
    return (
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>BFS vs UCS vs A* — {graph.title}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Same graph, same start and goal, and the same edge costs (including your changes). Every figure comes from running each algorithm now.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left font-mono text-[10px] uppercase text-muted-foreground"><tr><th className="py-1">Algo</th><th>Goal</th><th>Path cost</th><th>Length</th><th>Expanded</th><th>Reached</th><th>Transitions</th><th>Time (ms)</th></tr></thead>
              <tbody>{rows.map(({ a, r }) => (
                <tr key={a.id} className="border-t border-border font-mono">
                  <td className="py-1.5">{a.short}</td><td>{r.found ? "✓" : "✗"}</td>
                  <td className={r.cost === minCost ? "text-success" : ""}>{r.found ? r.cost : "—"}</td><td>{r.length}</td><td>{r.expanded}</td><td>{r.reached}</td><td>{r.transitions}</td><td>{r.runtimeMs.toFixed(3)}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <div className="space-y-1">{rows.map(({ a, r }) => <p key={a.id} className="text-xs"><span className="font-mono text-primary">{a.short}:</span> {r.path.map(lbl).join(" → ") || "no path"}</p>)}</div>
          <p className="text-[11px] text-muted-foreground">Green = lowest path cost. Time is measured once in your browser, so expect small run-to-run differences.</p>
          <div><Btn disabled={saved} onClick={() => { rows.forEach(({ r }) => addRun(toRecord(graph, r, overrides))); setSaved(true); }}>{saved ? "Saved to history" : "Save all 3 to Run History"}</Btn> <Link to="/history" className="ml-2 text-xs text-primary hover:underline">Open history</Link></div>
        </DialogContent>
      </Dialog>
    );
  }
