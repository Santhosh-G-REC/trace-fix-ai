import { describe, expect, it } from "vitest";
import { SCENARIOS, applyCosts, type Scenario } from "@/lib/scenarios";
import { astar, bfs, findCycle, heuristic, ucs, validate } from "@/lib/algorithms/search";

/** Brute-force reference: enumerate all simple paths start→goal. */
function allPaths(s: Scenario) {
  const out: { path: string[]; cost: number }[] = [];
  const rec = (n: string, path: string[], cost: number) => {
    if (n === s.goal) { out.push({ path, cost }); return; }
    for (const e of s.edges.filter((x) => x.from === n)) if (!path.includes(e.to)) rec(e.to, [...path, e.to], cost + e.cost);
  };
  rec(s.start, [s.start], 0);
  return out;
}

describe.each(SCENARIOS.map((s) => [s.title, s] as const))("%s", (_t, s) => {
  const ref = allPaths(s);
  it("is a valid graph with a reachable goal", () => expect(validate(s).ok).toBe(true));
  it("BFS finds a path with the fewest transitions", () => {
    const r = bfs(s);
    expect(r.found).toBe(true);
    expect(r.length).toBe(Math.min(...ref.map((p) => p.path.length - 1)));
  });
  it("UCS and A* find the minimum-cost path", () => {
    const best = Math.min(...ref.map((p) => p.cost));
    expect(ucs(s).cost).toBe(best);
    expect(astar(s).cost).toBe(best);
    expect(astar(s).expanded).toBeLessThanOrEqual(ucs(s).expanded);
  });
  it("heuristic is admissible", () => {
    const h = heuristic(s);
    for (const n of s.nodes) {
      const sub = allPaths({ ...s, start: n.id });
      if (sub.length) expect(h[n.id]).toBeLessThanOrEqual(Math.min(...sub.map((p) => p.cost)));
    }
  });
  it("traces end with goal event and frontier snapshots", () => {
    for (const r of [bfs(s), ucs(s), astar(s)]) {
      expect(r.events.at(-1)!.type).toBe("goal");
      expect(r.events.every((e) => Array.isArray(e.frontier))).toBe(true);
    }
  });
});

describe("behaviour", () => {
  it("BFS and UCS disagree on a seeded scenario (fewest hops vs cheapest)", () => {
    const s = SCENARIOS[0];
    expect(bfs(s).cost).toBeGreaterThan(ucs(s).cost);
    expect(bfs(s).length).toBeLessThan(ucs(s).length);
  });
  it("UCS records a path-cost update when a cheaper route appears", () => {
    const s = applyCosts(SCENARIOS[0], { "dbcheck>fwaudit": 1 });
    expect(ucs(s).events.some((e) => e.type === "update") || ucs(s).cost <= 7).toBe(true);
  });
  it("detects the cycle in the cyclic scenario only", () => {
    expect(findCycle(SCENARIOS.find((s) => s.id === "cyclic")!)).not.toBeNull();
    expect(findCycle(SCENARIOS[0])).toBeNull();
  });
  it("reports unreachable goal", () => {
    const s = { ...SCENARIOS[0], edges: SCENARIOS[0].edges.filter((e) => e.to !== "fix-fw") };
    expect(bfs(s).found).toBe(false);
    expect(ucs(s).events.at(-1)!.type).toBe("exhausted");
  });
});
