import type { Scenario } from "./scenarios";
import { ALGOS, type SearchResult } from "./algorithms/search";
import type { RunRecord } from "./store";

export function toRecord(s: Scenario, r: SearchResult, overrides: Record<string, number>): RunRecord {
  const lbl = (id: string) => s.nodes.find((n) => n.id === id)?.label ?? id;
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
    at: new Date().toISOString(),
    scenarioId: s.id,
    scenarioTitle: s.title,
    algorithm: r.algorithm,
    found: r.found,
    cost: r.found ? r.cost : null,
    length: r.length,
    expanded: r.expanded,
    reached: r.reached,
    transitions: r.transitions,
    maxFrontier: r.maxFrontier,
    runtimeMs: +r.runtimeMs.toFixed(3),
    path: r.path.map(lbl),
    recovery: r.found ? lbl(r.path[r.path.length - 1]) : null,
    costOverrides: overrides,
    events: r.events.map((e) => e.message),
  };
}

export const algoName = (id: string) => ALGOS.find((a) => a.id === id)?.short ?? id;

export function toMarkdown(r: RunRecord) {
  return `# Run report — ${r.scenarioTitle}

- Algorithm: ${algoName(r.algorithm)}
- Time: ${r.at}
- Result: ${r.found ? "goal reached" : "goal not reached"}
- Path: ${r.path.join(" → ") || "—"}
- Path length: ${r.length} transitions
- Path cost: ${r.cost ?? "—"} (simulated minutes)
- Expanded: ${r.expanded} · Reached: ${r.reached} · Transitions evaluated: ${r.transitions} · Max frontier: ${r.maxFrontier}
- Compute time: ${r.runtimeMs} ms (browser)
- Recovery action: ${r.recovery ?? "—"}
${Object.keys(r.costOverrides).length ? `- Edge cost overrides: ${JSON.stringify(r.costOverrides)}\n` : ""}
## Execution trace
${r.events.map((e, i) => `${i + 1}. ${e}`).join("\n")}
`;
}

export function toCsv(rs: RunRecord[]) {
  const head = ["time", "scenario", "algorithm", "found", "cost", "length", "expanded", "reached", "transitions", "max_frontier", "runtime_ms", "path"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [head.join(","), ...rs.map((r) => [r.at, r.scenarioTitle, algoName(r.algorithm), r.found, r.cost, r.length, r.expanded, r.reached, r.transitions, r.maxFrontier, r.runtimeMs, r.path.join(" > ")].map(esc).join(","))].join("\n");
}

export function download(text: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
