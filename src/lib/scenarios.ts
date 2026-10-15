export type NodeKind = "stage" | "check" | "cause" | "recovery";
export type NodeStatus = "success" | "failed" | "pending";

export interface WNode {
  id: string;
  label: string;
  kind: NodeKind;
  status: NodeStatus;
  logs: string[];
  /** optional grid position [col, row]; nodes without it are auto-laid-out */
  at?: [number, number];
}

export interface WEdge {
  from: string;
  to: string;
  /** simulated investigation cost in minutes */
  cost: number;
  action: string;
}

export interface Scenario {
  id: string;
  title: string;
  failure: string;
  conditions: string[];
  logs: string;
  nodes: WNode[];
  edges: WEdge[];
  start: string;
  goal: string;
  custom?: boolean;
}

const STAGES: [string, string][] = [
  ["checkout", "Checkout"],
  ["deps", "Install Dependencies"],
  ["build", "Build"],
  ["tests", "Tests"],
  ["dbcheck", "Database Check"],
  ["integration", "Integration Tests"],
  ["deploy", "Deploy"],
  ["health", "Health Check"],
];

/** The 8-stage pipeline with upstream-inspection transitions from the failed stage back to Checkout. */
function pipeline(failed: string, stageLogs: Record<string, string[]> = {}): { nodes: WNode[]; edges: WEdge[] } {
  const fi = STAGES.findIndex(([id]) => id === failed);
  const nodes: WNode[] = STAGES.map(([id, label], i) => ({
    id,
    label,
    kind: "stage",
    status: i < fi ? "success" : i === fi ? "failed" : "pending",
    logs: stageLogs[id] ?? (i < fi ? [`${label} completed successfully`] : i === fi ? ["Stage exited with non-zero status"] : ["Not run (blocked by failure)"]),
    at: [i, 0],
  }));
  const edges: WEdge[] = [];
  for (let i = fi; i > 0; i--) edges.push({ from: STAGES[i][0], to: STAGES[i - 1][0], cost: 3, action: `Inspect upstream: ${STAGES[i - 1][1]}` });
  return { nodes, edges };
}

const n = (id: string, label: string, kind: NodeKind, at: [number, number], logs: string[]): WNode => ({ id, label, kind, status: "pending", logs, at });
const e = (from: string, to: string, cost: number, action: string): WEdge => ({ from, to, cost, action });

function make(s: Omit<Scenario, "nodes" | "edges"> & { failed: string; stageLogs?: Record<string, string[]>; extraNodes: WNode[]; extraEdges: WEdge[] }): Scenario {
  const p = pipeline(s.failed, s.stageLogs);
  const { failed: _f, stageLogs: _l, extraNodes, extraEdges, ...rest } = s;
  return { ...rest, nodes: [...p.nodes, ...extraNodes], edges: [...p.edges, ...extraEdges] };
}

export const SCENARIOS: Scenario[] = [
  make({
    id: "db-timeout",
    title: "Database Connection Timeout",
    failure: "Database Check fails: connection to db.internal:5432 times out after 30s.",
    conditions: ["Build and unit tests passed", "Same DB credentials worked yesterday", "Infra change merged 2h ago"],
    logs: "[12:01:03] dbcheck: connecting postgres://app@db.internal:5432\n[12:01:33] ERROR: ETIMEDOUT after 30000ms\n[12:01:33] retry 1/3 ... ETIMEDOUT",
    failed: "dbcheck",
    start: "dbcheck",
    goal: "fix-fw",
    stageLogs: { dbcheck: ["ETIMEDOUT connecting to db.internal:5432", "3/3 retries failed"] },
    extraNodes: [
      n("env", "Env vars in build", "check", [2, 1], ["DB_HOST=db.internal", "DB_PORT=5432 (unchanged)"]),
      n("net", "Network reachability", "check", [3.6, 1], ["ICMP to db.internal OK", "TCP 5432 no SYN-ACK"]),
      n("creds", "Credential check", "check", [4.8, 1], ["Credentials accepted by replica"]),
      n("fwaudit", "Full firewall audit", "check", [6, 1], ["Exports all security-group rules (slow)"]),
      n("trace", "Traceroute :5432", "check", [3.6, 2], ["Packets dropped at hop 4 (egress-gw)"]),
      n("vault", "Vault rotation log", "check", [4.8, 2], ["No rotation in last 7 days"]),
      n("cause-fw", "Egress rule blocks 5432", "cause", [4.8, 3], ["Rule sg-ci-egress removed port 5432 in infra PR #812"]),
      n("fix-fw", "Restore egress rule & re-run", "recovery", [4.8, 4], ["Re-add tcp/5432 to sg-ci-egress, re-run pipeline"]),
    ],
    extraEdges: [
      e("dbcheck", "net", 2, "Probe network path"),
      e("dbcheck", "creds", 2, "Verify credentials"),
      e("dbcheck", "fwaudit", 6, "Run full firewall audit"),
      e("build", "env", 2, "Inspect baked env vars"),
      e("env", "creds", 1, "Cross-check DB user"),
      e("net", "trace", 2, "Traceroute to db:5432"),
      e("creds", "vault", 3, "Check vault rotation"),
      e("trace", "cause-fw", 1, "Correlate dropped packets"),
      e("fwaudit", "cause-fw", 3, "Match deny rule"),
      e("cause-fw", "fix-fw", 2, "Plan recovery"),
    ],
  }),
  make({
    id: "dep-conflict",
    title: "Dependency / Version Conflict",
    failure: "Install Dependencies fails with ERESOLVE: unable to resolve dependency tree.",
    conditions: ["Lockfile changed in last commit", "Renovate bumped react-dom", "Registry reachable"],
    logs: "npm ERR! code ERESOLVE\nnpm ERR! peer react@\"^18\" from react-dom@19.0.0\ngit: package-lock.json modified in HEAD~1",
    failed: "deps",
    start: "deps",
    goal: "fix-pin",
    stageLogs: { deps: ["ERESOLVE unable to resolve dependency tree"] },
    extraNodes: [
      n("lock", "Diff lockfile", "check", [0.5, 1], ["react-dom 18.3.1 → 19.0.0"]),
      n("resolve", "Full resolver dump", "check", [1.6, 1], ["npm ls --all (slow, 1.2k lines)"]),
      n("registry", "Ping registry", "check", [2.7, 1], ["registry.npmjs.org 200 OK"]),
      n("peer", "Peer dependency scan", "check", [0.5, 2], ["react-dom@19 requires react@^19", "app pins react@18"]),
      n("reg-ok", "Registry healthy", "check", [2.7, 2], ["No outage — dead end"]),
      n("cause-peer", "react / react-dom mismatch", "cause", [1.1, 3], ["Renovate bumped react-dom without react"]),
      n("fix-pin", "Pin react-dom@18 & reinstall", "recovery", [1.1, 4], ["Revert bump, regenerate lockfile"]),
    ],
    extraEdges: [
      e("deps", "lock", 2, "Diff lockfile"),
      e("deps", "resolve", 3, "Dump resolver tree"),
      e("deps", "registry", 1, "Ping registry"),
      e("lock", "peer", 2, "Scan peer deps"),
      e("resolve", "cause-peer", 5, "Search tree for conflicts"),
      e("peer", "cause-peer", 1, "Confirm mismatch"),
      e("registry", "reg-ok", 1, "Check status page"),
      e("cause-peer", "fix-pin", 2, "Plan recovery"),
    ],
  }),
  make({
    id: "health-fail",
    title: "Deployment Health-Check Failure",
    failure: "Deploy succeeded but /healthz fails; pods restart repeatedly.",
    conditions: ["New release v2.14 rolled out", "Pods restart every ~6 minutes", "Readiness probe unchanged"],
    logs: "kubectl: pod api-7f9 status=OOMKilled restarts=4\nmetrics: rss growing 48MB/min since deploy\n/healthz 200 (before crash)",
    failed: "health",
    start: "health",
    goal: "fix-rollback",
    stageLogs: { health: ["/healthz timed out", "4 restarts in 25 min"] },
    extraNodes: [
      n("release", "Diff release manifest", "check", [5, 1], ["New in-memory cache added"]),
      n("pods", "Inspect pod status", "check", [6.2, 1], ["OOMKilled ×4"]),
      n("probe", "Readiness probe", "check", [7.4, 1], ["Probe path /healthz correct"]),
      n("logs", "Read container logs", "check", [8.6, 1], ["Huge log volume (slow to read)"]),
      n("oom", "Confirm memory limit hit", "check", [6.2, 2], ["RSS reaches 512Mi limit"]),
      n("probe-ok", "Probe config OK", "check", [7.4, 2], ["Dead end"]),
      n("heap", "Heap snapshot diff", "check", [6.2, 3], ["LRU cache retains 2.1M entries"]),
      n("cause-leak", "Unbounded cache leak", "cause", [7.4, 4], ["Cache has no max size in v2.14"]),
      n("fix-rollback", "Roll back to v2.13", "recovery", [7.4, 5], ["Rollback, then patch cache size"]),
    ],
    extraEdges: [
      e("health", "pods", 1, "Inspect pod status"),
      e("health", "probe", 2, "Check readiness probe"),
      e("health", "logs", 4, "Read container logs"),
      e("deploy", "release", 2, "Diff release manifest"),
      e("pods", "oom", 1, "Confirm OOM"),
      e("probe", "probe-ok", 1, "Validate probe"),
      e("oom", "heap", 3, "Take heap snapshot"),
      e("heap", "cause-leak", 1, "Identify retainer"),
      e("logs", "cause-leak", 4, "Grep for growth warnings"),
      e("release", "cause-leak", 5, "Review code diff"),
      e("cause-leak", "fix-rollback", 2, "Plan recovery"),
    ],
  }),
  make({
    id: "intermittent",
    title: "Intermittent Service Failure",
    failure: "Integration Tests fail on ~30% of runs; passes on retry.",
    conditions: ["Failures only on CI, not locally", "8 parallel workers", "No code change in failing area"],
    logs: "jest: 3 failed (passed on retry)\njest --workers=8\npg: sorry, too many clients already",
    failed: "integration",
    start: "integration",
    goal: "fix-pool",
    stageLogs: { integration: ["3 tests failed", "Passed on retry"] },
    extraNodes: [
      n("rerun", "Re-run 20× and sample", "check", [4, 1], ["6/20 runs failed (slow)"]),
      n("workers", "Serial vs parallel run", "check", [5.2, 1], ["Serial: 0/10 fail", "Parallel: 3/10 fail"]),
      n("latency", "p99 latency check", "check", [6.4, 1], ["p99 stable at 120ms"]),
      n("pool", "Pool metrics", "check", [5.2, 2], ["Active connections hit max=20"]),
      n("lat-ok", "Network stable", "check", [6.4, 2], ["Dead end"]),
      n("cause-pool", "Connection pool exhaustion", "cause", [4.6, 3], ["8 workers × 3 conns > pool max"]),
      n("fix-pool", "Raise pool size / cap workers", "recovery", [4.6, 4], ["pool max 40 or --workers=4"]),
    ],
    extraEdges: [
      e("integration", "rerun", 4, "Re-run 20× and sample"),
      e("integration", "workers", 2, "Compare serial vs parallel"),
      e("integration", "latency", 2, "Check p99 latency"),
      e("workers", "pool", 2, "Inspect pool metrics"),
      e("pool", "cause-pool", 1, "Correlate with failures"),
      e("rerun", "cause-pool", 5, "Cluster failure logs"),
      e("latency", "lat-ok", 1, "Confirm network"),
      e("cause-pool", "fix-pool", 2, "Plan recovery"),
    ],
  }),
  make({
    id: "cyclic",
    title: "Invalid / Cyclic Workflow",
    failure: "Build never starts: scheduler reports jobs waiting on each other.",
    conditions: ["pipeline.yml edited today", "Runners idle while jobs queued", "Investigation graph itself contains a wait-for cycle"],
    logs: "scheduler: build blocked on codegen\nscheduler: codegen blocked on security\nscheduler: security waiting for build\nrunners idle: 6/6",
    failed: "build",
    start: "build",
    goal: "fix-cycle",
    stageLogs: { build: ["Blocked: waiting on codegen"] },
    extraNodes: [
      n("sched", "Scheduler queue", "check", [2, 1], ["3 jobs in WAITING"]),
      n("waitA", "Wait-for: codegen", "check", [1, 2], ["codegen waits on security"]),
      n("waitB", "Wait-for: security", "check", [2, 2], ["security waits on build"]),
      n("config", "Diff pipeline.yml", "check", [3.2, 1], ["needs: [security] added to codegen"]),
      n("runners", "Runner pool", "check", [4.4, 1], ["6 idle runners"]),
      n("runners-ok", "Capacity OK", "check", [4.4, 2], ["Dead end"]),
      n("cause-cycle", "Cycle build→codegen→security→build", "cause", [2.6, 3], ["Circular 'needs' declaration"]),
      n("fix-cycle", "Remove codegen→security edge", "recovery", [2.6, 4], ["Edit pipeline.yml, re-run"]),
    ],
    extraEdges: [
      e("build", "sched", 1, "Inspect scheduler queue"),
      e("build", "config", 3, "Diff pipeline.yml"),
      e("build", "runners", 2, "Check runner pool"),
      e("sched", "waitA", 2, "Follow wait-for edge"),
      e("waitA", "waitB", 2, "Follow wait-for edge"),
      e("waitB", "sched", 2, "Follow wait-for edge"),
      e("waitB", "cause-cycle", 1, "Detect cycle"),
      e("config", "cause-cycle", 4, "Trace needs graph"),
      e("runners", "runners-ok", 1, "Check capacity"),
      e("cause-cycle", "fix-cycle", 1, "Plan recovery"),
    ],
  }),
];

export const DEFAULT_SCENARIO = "db-timeout";
export const edgeKey = (e: { from: string; to: string }) => `${e.from}>${e.to}`;

export function applyCosts(s: Scenario, overrides: Record<string, number>): Scenario {
  return { ...s, edges: s.edges.map((e) => (overrides[edgeKey(e)] !== undefined ? { ...e, cost: overrides[edgeKey(e)] } : e)) };
}
