import type { Scenario, WEdge } from "../scenarios";

export type AlgoId = "bfs" | "ucs" | "astar";
export const ALGOS: { id: AlgoId; name: string; short: string; tip: string }[] = [
  { id: "bfs", name: "Breadth-First Search", short: "BFS", tip: "FIFO queue. Expands level by level and finds the path with the fewest transitions. Ignores edge costs." },
  { id: "ucs", name: "Uniform-Cost Search", short: "UCS", tip: "Min-priority queue on g(n). Finds the path with the lowest total accumulated cost." },
  { id: "astar", name: "A* Search", short: "A*", tip: "Min-priority queue on f(n) = g(n) + h(n): path cost so far plus an admissible estimate of the remaining cost." },
];

export interface FrontierItem {
  id: string;
  g: number;
  h?: number;
  f?: number;
  depth: number;
}

export type EventType = "init" | "expand" | "generate" | "update" | "skip" | "goal" | "exhausted";

export interface TraceEvent {
  type: EventType;
  node: string;
  from?: string;
  g?: number;
  h?: number;
  f?: number;
  message: string;
  reason?: string;
  frontier: FrontierItem[];
  expanded: string[];
  reached: string[];
  transitions: number;
}

export interface SearchResult {
  algorithm: AlgoId;
  found: boolean;
  path: string[];
  cost: number;
  length: number;
  expanded: number;
  reached: number;
  transitions: number;
  maxFrontier: number;
  runtimeMs: number;
  events: TraceEvent[];
  h: Record<string, number>;
}

const out = (s: Scenario, id: string) => s.edges.filter((e) => e.from === id);
const label = (s: Scenario, id: string) => s.nodes.find((n) => n.id === id)?.label ?? id;

/**
 * Heuristic h(n) = (fewest transitions from n to the goal) × (cheapest edge cost in the graph).
 * Every remaining transition costs at least the minimum edge cost, so h never overestimates
 * (admissible) and h(n) ≤ c(n,n') + h(n') (consistent). Nodes that cannot reach the goal get ∞.
 */
export function heuristic(s: Scenario): Record<string, number> {
  const minCost = s.edges.length ? Math.min(...s.edges.map((e) => e.cost)) : 0;
  const hops: Record<string, number> = { [s.goal]: 0 };
  const q = [s.goal];
  while (q.length) {
    const cur = q.shift()!;
    for (const e of s.edges) if (e.to === cur && hops[e.from] === undefined) { hops[e.from] = hops[cur] + 1; q.push(e.from); }
  }
  return Object.fromEntries(s.nodes.map((nd) => [nd.id, hops[nd.id] === undefined ? Infinity : hops[nd.id] * minCost]));
}

/** Binary min-heap with FIFO tie-breaking (insertion counter). */
class MinHeap<T> {
  private a: { k: number; c: number; v: T }[] = [];
  private c = 0;
  get size() { return this.a.length; }
  push(k: number, v: T) {
    const a = this.a;
    a.push({ k, c: this.c++, v });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(i, p)) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break;
    }
  }
  pop(): T | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.less(l, m)) m = l;
        if (r < a.length && this.less(r, m)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top.v;
  }
  private less(i: number, j: number) { const x = this.a[i], y = this.a[j]; return x.k < y.k || (x.k === y.k && x.c < y.c); }
}

function reconstruct(parent: Record<string, string | null>, goal: string) {
  const p: string[] = [];
  for (let c: string | null = goal; c; c = parent[c] ?? null) p.unshift(c);
  return p;
}

function pathCost(s: Scenario, path: string[]) {
  let c = 0;
  for (let i = 1; i < path.length; i++) c += (s.edges.find((e) => e.from === path[i - 1] && e.to === path[i]) as WEdge).cost;
  return c;
}

export function bfs(s: Scenario): SearchResult {
  const t0 = performance.now();
  const events: TraceEvent[] = [];
  const parent: Record<string, string | null> = { [s.start]: null };
  const g: Record<string, number> = { [s.start]: 0 };
  const depth: Record<string, number> = { [s.start]: 0 };
  const queue: string[] = [s.start];
  const expanded: string[] = [];
  let transitions = 0, maxF = 1;
  const snap = () => queue.map((id) => ({ id, g: g[id], depth: depth[id] }));
  const push = (ev: Omit<TraceEvent, "frontier" | "expanded" | "reached" | "transitions">) =>
    events.push({ ...ev, frontier: snap(), expanded: [...expanded], reached: Object.keys(parent), transitions });
  push({ type: "init", node: s.start, g: 0, message: `Start at ${label(s, s.start)}; queue = [${label(s, s.start)}]` });
  let found: string | null = s.start === s.goal ? s.start : null;
  if (found) push({ type: "goal", node: s.start, g: 0, message: "Start is the goal" });
  while (!found && queue.length) {
    const cur = queue.shift()!;
    expanded.push(cur);
    push({ type: "expand", node: cur, g: g[cur], message: `Expanded ${label(s, cur)}`, reason: `Oldest entry in the FIFO queue (depth ${depth[cur]}). BFS always expands the shallowest unexpanded state.` });
    for (const e of out(s, cur)) {
      transitions++;
      if (e.to in parent) {
        push({ type: "skip", node: e.to, from: cur, message: `Ignored ${label(s, e.to)}: already reached` });
        continue;
      }
      parent[e.to] = cur;
      g[e.to] = g[cur] + e.cost;
      depth[e.to] = depth[cur] + 1;
      queue.push(e.to);
      maxF = Math.max(maxF, queue.length);
      push({ type: "generate", node: e.to, from: cur, g: g[e.to], message: `Added ${label(s, e.to)} to queue (depth ${depth[e.to]}, cost so far ${g[e.to]})` });
      if (e.to === s.goal) {
        found = e.to;
        push({ type: "goal", node: e.to, g: g[e.to], message: `Goal reached: ${label(s, e.to)} at depth ${depth[e.to]}` });
        break;
      }
    }
  }
  if (!found) push({ type: "exhausted", node: s.start, message: "Queue empty — goal not reachable" });
  return finish(s, "bfs", found, parent, events, expanded.length, transitions, maxF, t0, {});
}

function bestFirst(s: Scenario, algo: "ucs" | "astar"): SearchResult {
  const t0 = performance.now();
  const h = algo === "astar" ? heuristic(s) : {};
  const hv = (id: string) => (algo === "astar" ? h[id] : 0);
  const events: TraceEvent[] = [];
  const parent: Record<string, string | null> = { [s.start]: null };
  const g: Record<string, number> = { [s.start]: 0 };
  const depth: Record<string, number> = { [s.start]: 0 };
  const open = new Map<string, FrontierItem>();
  const closed = new Set<string>();
  const heap = new MinHeap<{ id: string; g: number }>();
  const expanded: string[] = [];
  let transitions = 0, maxF = 1;
  const item = (id: string): FrontierItem => (algo === "astar" ? { id, g: g[id], h: hv(id), f: g[id] + hv(id), depth: depth[id] } : { id, g: g[id], depth: depth[id] });
  const key = (id: string) => g[id] + hv(id);
  const snap = () => [...open.values()].sort((a, b) => (a.f ?? a.g) - (b.f ?? b.g));
  const push = (ev: Omit<TraceEvent, "frontier" | "expanded" | "reached" | "transitions">) =>
    events.push({ ...ev, frontier: snap(), expanded: [...expanded], reached: Object.keys(parent), transitions });
  open.set(s.start, item(s.start));
  heap.push(key(s.start), { id: s.start, g: 0 });
  push({ type: "init", node: s.start, g: 0, h: hv(s.start), f: key(s.start), message: `Start at ${label(s, s.start)}; priority queue = [${label(s, s.start)}]` });
  let found: string | null = null;
  while (heap.size) {
    const top = heap.pop()!;
    if (closed.has(top.id) || top.g > g[top.id]) continue; // stale entry superseded by a cheaper path
    const cur = top.id;
    open.delete(cur);
    if (cur === s.goal) {
      found = cur;
      expanded.push(cur);
      push({ type: "goal", node: cur, g: g[cur], h: hv(cur), f: key(cur), message: `Goal reached: ${label(s, cur)} with total cost ${g[cur]}`, reason: algo === "ucs" ? `Goal popped with the lowest g = ${g[cur]}, so no cheaper path exists.` : `Goal popped with lowest f = ${g[cur]}; with an admissible h no cheaper path exists.` });
      break;
    }
    closed.add(cur);
    expanded.push(cur);
    push({
      type: "expand", node: cur, g: g[cur], h: hv(cur), f: key(cur),
      message: `Expanded ${label(s, cur)} (${algo === "astar" ? `f = ${g[cur]} + ${hv(cur)} = ${key(cur)}` : `g = ${g[cur]}`})`,
      reason: algo === "ucs" ? `Lowest accumulated cost g = ${g[cur]} in the priority queue.` : `Lowest f = g + h = ${g[cur]} + ${hv(cur)} = ${key(cur)} in the priority queue.`,
    });
    for (const e of out(s, cur)) {
      transitions++;
      const ng = g[cur] + e.cost;
      if (closed.has(e.to)) {
        push({ type: "skip", node: e.to, from: cur, message: `Ignored ${label(s, e.to)}: already expanded` });
        continue;
      }
      if (g[e.to] === undefined || ng < g[e.to]) {
        const improved = g[e.to] !== undefined;
        const old = g[e.to];
        g[e.to] = ng;
        parent[e.to] = cur;
        depth[e.to] = depth[cur] + 1;
        open.set(e.to, item(e.to));
        heap.push(key(e.to), { id: e.to, g: ng });
        maxF = Math.max(maxF, open.size);
        push(
          improved
            ? { type: "update", node: e.to, from: cur, g: ng, h: hv(e.to), f: key(e.to), message: `Updated path cost of ${label(s, e.to)}: ${old} → ${ng} via ${label(s, cur)}` }
            : { type: "generate", node: e.to, from: cur, g: ng, h: hv(e.to), f: key(e.to), message: `Added ${label(s, e.to)} to frontier (${algo === "astar" ? `g=${ng}, h=${hv(e.to)}, f=${key(e.to)}` : `g=${ng}`})` },
        );
      } else {
        push({ type: "skip", node: e.to, from: cur, g: ng, message: `Kept existing path to ${label(s, e.to)} (g ${g[e.to]} ≤ ${ng})` });
      }
    }
  }
  if (!found) push({ type: "exhausted", node: s.start, message: "Frontier empty — goal not reachable" });
  return finish(s, algo, found, parent, events, expanded.length, transitions, maxF, t0, h);
}

function finish(s: Scenario, algorithm: AlgoId, found: string | null, parent: Record<string, string | null>, events: TraceEvent[], expanded: number, transitions: number, maxFrontier: number, t0: number, h: Record<string, number>): SearchResult {
  const path = found ? reconstruct(parent, found) : [];
  return {
    algorithm, found: !!found, path,
    cost: found ? pathCost(s, path) : Infinity,
    length: Math.max(0, path.length - 1),
    expanded, reached: Object.keys(parent).length, transitions, maxFrontier,
    runtimeMs: performance.now() - t0, events,
    h: Object.keys(h).length ? h : heuristic(s),
  };
}

export const ucs = (s: Scenario) => bestFirst(s, "ucs");
export const astar = (s: Scenario) => bestFirst(s, "astar");
export const runAlgo = (s: Scenario, a: AlgoId) => (a === "bfs" ? bfs(s) : a === "ucs" ? ucs(s) : astar(s));

/** Directed cycle detection with DFS 3-colouring. */
export function findCycle(s: Pick<Scenario, "nodes" | "edges">): string[] | null {
  const color: Record<string, number> = {};
  const stack: string[] = [];
  let cycle: string[] | null = null;
  const visit = (id: string): boolean => {
    color[id] = 1;
    stack.push(id);
    for (const e of s.edges.filter((x) => x.from === id)) {
      if (color[e.to] === 1) { cycle = [...stack.slice(stack.indexOf(e.to)), e.to]; return true; }
      if (!color[e.to] && visit(e.to)) return true;
    }
    stack.pop();
    color[id] = 2;
    return false;
  };
  for (const nd of s.nodes) if (!color[nd.id] && visit(nd.id)) break;
  return cycle;
}

export function validate(s: Scenario) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set(s.nodes.map((x) => x.id));
  if (ids.size !== s.nodes.length) errors.push("Node ids must be unique");
  if (!ids.has(s.start)) errors.push("Start node is not set or missing");
  if (!ids.has(s.goal)) errors.push("Goal node is not set or missing");
  for (const e of s.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) errors.push(`Edge ${e.from} → ${e.to} references a missing node`);
    if (!(e.cost >= 0)) errors.push(`Edge ${e.from} → ${e.to} needs a non-negative cost`);
  }
  if (!errors.length && heuristic(s)[s.start] === Infinity) errors.push("Goal is not reachable from start");
  const cyc = findCycle(s);
  if (cyc) warnings.push(`Cycle detected: ${cyc.join(" → ")} (search handles it, but the workflow is invalid)`);
  return { ok: errors.length === 0, errors, warnings, cycle: cyc };
}
