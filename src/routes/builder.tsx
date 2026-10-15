import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle2, MousePointerClick, Pencil, Play, Plus, Save, Trash2, XCircle } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Btn } from "@/components/AppShell";
import { WorkflowCanvas } from "@/components/WorkflowCanvas";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { validate } from "@/lib/algorithms/search";
import { SCENARIOS, type NodeKind, type NodeStatus, type Scenario, type WEdge, type WNode } from "@/lib/scenarios";
import { allScenarios, deleteCustom, saveCustom, setScenarioId, useCustomScenarios } from "@/lib/store";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/builder")({
  head: () => meta("Workflow Builder", "Create and validate custom workflow failure graphs with weighted transitions, start and goal states."),
  component: Builder,
});

const blank = (): Scenario => ({
  id: `custom-${Date.now()}`, title: "My workflow", failure: "Describe the failure", conditions: [], logs: "", custom: true,
  nodes: [
    { id: "failed", label: "Failed stage", kind: "stage", status: "failed", logs: [] },
    { id: "check", label: "Diagnostic check", kind: "check", status: "pending", logs: [] },
    { id: "fix", label: "Recovery action", kind: "recovery", status: "pending", logs: [] },
  ],
  edges: [{ from: "failed", to: "check", cost: 2, action: "Run check" }, { from: "check", to: "fix", cost: 1, action: "Plan recovery" }],
  start: "failed", goal: "fix",
});

const KINDS: NodeKind[] = ["stage", "check", "cause", "recovery"];
const STATUSES: NodeStatus[] = ["success", "failed", "pending"];
const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none";

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Builder() {
  const custom = useCustomScenarios();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Scenario>(blank);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState("workflow");
  const [nodeDlg, setNodeDlg] = useState(false);
  const [edgeDlg, setEdgeDlg] = useState<{ index: number | null; edge: WEdge } | null>(null);
  const v = useMemo(() => validate(draft), [draft]);
  const upd = (p: Partial<Scenario>) => { setDraft((d) => ({ ...d, ...p })); setSaved(false); };
  const ids = draft.nodes.map((n) => n.id);
  const lbl = (id: string) => draft.nodes.find((n) => n.id === id)?.label ?? id;
  const node = draft.nodes.find((n) => n.id === selected) ?? null;
  const isSaved = custom.some((c) => c.id === draft.id);

  const load = (id: string) => {
    setSelected(null);
    if (id === "__new") return upd(blank());
    const src = allScenarios(custom).find((s) => s.id === id)!;
    upd(src.custom ? structuredClone(src) : { ...structuredClone(src), id: `custom-${Date.now()}`, title: `${src.title} (copy)`, custom: true });
  };
  const setNode = (id: string, p: Partial<WNode>) => {
    if (p.id !== undefined && p.id !== id) {
      const nid = p.id;
      setSelected(nid);
      return upd({
        nodes: draft.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)),
        edges: draft.edges.map((e) => ({ ...e, from: e.from === id ? nid : e.from, to: e.to === id ? nid : e.to })),
        start: draft.start === id ? nid : draft.start, goal: draft.goal === id ? nid : draft.goal,
      });
    }
    upd({ nodes: draft.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)) });
  };
  const removeNode = (id: string) => { upd({ nodes: draft.nodes.filter((n) => n.id !== id), edges: draft.edges.filter((e) => e.from !== id && e.to !== id) }); setSelected(null); };
  const select = (id: string) => { setSelected(id); setTab("node"); };
  const newEdge = (from?: string): WEdge => ({ from: from ?? ids[0] ?? "", to: ids.find((i) => i !== (from ?? ids[0])) ?? ids[0] ?? "", cost: 1, action: "" });

  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-3">
      {/* Toolbar */}
      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">Workflow Builder</h1>
            <p className="truncate text-xs text-muted-foreground">Design a diagnostic graph, then run BFS, UCS or A* on it.</p>
          </div>
          <select aria-label="Load workflow" onChange={(e) => { load(e.target.value); e.target.value = ""; }} defaultValue="" className="min-w-0 max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-64">
            <option value="" disabled>Load or copy a workflow…</option>
            <option value="__new">New blank workflow</option>
            <optgroup label="Copy a sample">{SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</optgroup>
            {custom.length > 0 && <optgroup label="Your workflows">{custom.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</optgroup>}
          </select>
          <span className="min-w-0 truncate text-sm font-medium" title={draft.title}>{draft.title}{isSaved ? "" : <span className="ml-1.5 text-xs font-normal text-muted-foreground">(unsaved)</span>}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${!v.ok ? "bg-destructive/15 text-destructive" : v.warnings.length ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
            {!v.ok ? <XCircle className="h-3.5 w-3.5" /> : v.warnings.length ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {!v.ok ? `${v.errors.length} issue${v.errors.length > 1 ? "s" : ""}` : v.warnings.length ? "Valid with warnings" : "Valid"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSaved && <Btn variant="ghost" onClick={() => { if (confirm("Delete this saved workflow?")) { deleteCustom(draft.id); upd(blank()); setSelected(null); } }}><Trash2 className="h-4 w-4" />Delete</Btn>}
          <Btn variant="ghost" disabled={!v.ok} onClick={() => { saveCustom(draft); setSaved(true); }}><Save className="h-4 w-4" />{saved ? "Saved" : "Save"}</Btn>
          <Btn disabled={!v.ok} onClick={() => { saveCustom(draft); setScenarioId(draft.id); navigate({ to: "/" }); }}><Play className="h-4 w-4" />Open in Simulator</Btn>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Canvas */}
        <div className="flex min-w-0 flex-col gap-2">
          <WorkflowCanvas scenario={draft} cycle={v.cycle ?? []} selected={selected} onSelect={select} className="h-[55vh] min-h-[360px] lg:h-[calc(100vh-230px)] lg:min-h-[420px]" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs">
            {v.ok && !v.warnings.length && <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="h-3.5 w-3.5" />Goal is reachable from the start; all costs are non-negative.</span>}
            {v.errors.map((e) => <span key={e} className="flex items-center gap-1.5 text-destructive"><XCircle className="h-3.5 w-3.5" />{e}</span>)}
            {v.warnings.map((e) => <span key={e} className="flex items-center gap-1.5 text-warning"><AlertTriangle className="h-3.5 w-3.5" />{e}</span>)}
            <span className="ml-auto text-muted-foreground">{draft.nodes.length} nodes · {draft.edges.length} transitions · drag to pan, scroll to zoom</span>
          </div>
        </div>

        {/* Inspector */}
        <aside className="flex min-w-0 flex-col rounded-lg border border-border bg-card lg:h-[calc(100vh-182px)] lg:min-h-[470px]">
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="m-3 mb-0 grid grid-cols-3">
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
              <TabsTrigger value="node">Node</TabsTrigger>
              <TabsTrigger value="transitions">Transitions</TabsTrigger>
            </TabsList>

            <TabsContent value="workflow" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <Field label="Title"><input className={field} value={draft.title} onChange={(e) => upd({ title: e.target.value })} /></Field>
              <Field label="Failure description"><textarea rows={2} className={field} value={draft.failure} onChange={(e) => upd({ failure: e.target.value })} /></Field>
              <Field label="Logs / evidence"><textarea rows={3} placeholder="Paste relevant log lines" className={`${field} font-mono text-xs`} value={draft.logs} onChange={(e) => upd({ logs: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start node"><select className={field} value={draft.start} onChange={(e) => upd({ start: e.target.value })}>{draft.nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Field>
                <Field label="Goal node"><select className={field} value={draft.goal} onChange={(e) => upd({ goal: e.target.value })}>{draft.nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Field>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Btn variant="ghost" onClick={() => setNodeDlg(true)}><Plus className="h-4 w-4" />Add node</Btn>
                <Btn variant="ghost" disabled={ids.length < 1} onClick={() => setEdgeDlg({ index: null, edge: newEdge() })}><Plus className="h-4 w-4" />Add transition</Btn>
              </div>
              <p className="text-xs text-muted-foreground">Tip: click a node on the canvas to edit it.</p>
            </TabsContent>

            <TabsContent value="node" className="min-h-0 flex-1 overflow-y-auto p-4">
              {!node ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center text-sm text-muted-foreground">
                  <MousePointerClick className="h-8 w-8" />
                  <p>Select a node on the canvas to edit it.</p>
                  <Btn variant="ghost" onClick={() => setNodeDlg(true)}><Plus className="h-4 w-4" />Add node</Btn>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    {node.id === draft.start && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Start</span>}
                    {node.id === draft.goal && <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">Goal</span>}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{node.kind}</span>
                  </div>
                  <Field label="Label"><input className={field} value={node.label} onChange={(e) => setNode(node.id, { label: e.target.value })} /></Field>
                  <Field label="ID" hint="Letters, numbers and dashes. Must be unique."><input className={`${field} font-mono`} value={node.id} onChange={(e) => { const nid = e.target.value.replace(/[^\w-]/g, ""); if (nid && !ids.includes(nid)) setNode(node.id, { id: nid }); }} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Type"><select className={`${field} capitalize`} value={node.kind} onChange={(e) => setNode(node.id, { kind: e.target.value as NodeKind })}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
                    <Field label="Status"><select className={`${field} capitalize`} value={node.status} onChange={(e) => setNode(node.id, { status: e.target.value as NodeStatus })}>{STATUSES.map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
                  </div>
                  <Field label="Logs / evidence" hint="One line per entry."><textarea rows={3} className={`${field} font-mono text-xs`} value={node.logs.join("\n")} onChange={(e) => setNode(node.id, { logs: e.target.value.split("\n") })} /></Field>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="ghost" disabled={node.id === draft.start} onClick={() => upd({ start: node.id })}>Set as start</Btn>
                    <Btn variant="ghost" disabled={node.id === draft.goal} onClick={() => upd({ goal: node.id })}>Set as goal</Btn>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Outgoing transitions</span>
                      <button className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => setEdgeDlg({ index: null, edge: newEdge(node.id) })}><Plus className="h-3 w-3" />Add</button>
                    </div>
                    <EdgeList edges={draft.edges.map((e, i) => ({ e, i })).filter(({ e }) => e.from === node.id)} />
                  </div>
                  <button onClick={() => removeNode(node.id)} className="flex items-center gap-1.5 text-sm text-destructive hover:underline"><Trash2 className="h-4 w-4" />Delete node and its transitions</button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="transitions" className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{draft.edges.length} transitions</span>
                <Btn variant="ghost" disabled={ids.length < 1} onClick={() => setEdgeDlg({ index: null, edge: newEdge() })}><Plus className="h-4 w-4" />Add transition</Btn>
              </div>
              <EdgeList edges={draft.edges.map((e, i) => ({ e, i }))} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      <NodeDialog open={nodeDlg} onOpenChange={setNodeDlg} existing={ids} onSave={(n) => { upd({ nodes: [...draft.nodes, n] }); setNodeDlg(false); select(n.id); }} />
      <EdgeDialog state={edgeDlg} nodes={draft.nodes} onClose={() => setEdgeDlg(null)} onSave={(edge) => {
        const edges = edgeDlg!.index === null ? [...draft.edges, edge] : draft.edges.map((x, j) => (j === edgeDlg!.index ? edge : x));
        upd({ edges });
        setEdgeDlg(null);
      }} />
    </div>
  );

  function EdgeList({ edges }: { edges: { e: WEdge; i: number }[] }) {
    if (!edges.length) return <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No transitions yet.</p>;
    return (
      <ul className="space-y-2">
        {edges.map(({ e, i }) => (
          <li key={i} className="rounded-md border border-border bg-background/50 p-3">
            <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
              <span className="truncate">{lbl(e.from)}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{lbl(e.to)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={e.action}>{e.action || "Unnamed action"}</span>
              <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">cost
                <input aria-label={`Cost for ${e.action}`} type="number" min={0} value={e.cost} onChange={(ev) => upd({ edges: draft.edges.map((x, j) => (j === i ? { ...x, cost: Math.max(0, +ev.target.value || 0) } : x)) })} className="w-16 rounded-md border border-input bg-background px-2 py-1 text-right font-mono text-sm text-foreground" />
              </label>
              <button aria-label="Edit transition" onClick={() => setEdgeDlg({ index: i, edge: e })} className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-4 w-4" /></button>
              <button aria-label="Delete transition" onClick={() => upd({ edges: draft.edges.filter((_, j) => j !== i) })} className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
      </ul>
    );
  }
}

function NodeDialog({ open, onOpenChange, existing, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; existing: string[]; onSave: (n: WNode) => void }) {
  const [label, setLabel] = useState("");
  const [id, setId] = useState("");
  const [kind, setKind] = useState<NodeKind>("check");
  const [status, setStatus] = useState<NodeStatus>("pending");
  const autoId = (label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "node");
  const finalId = id || autoId;
  const dup = existing.includes(finalId);
  const reset = () => { setLabel(""); setId(""); setKind("check"); setStatus("pending"); };
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add node</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label="Label"><input autoFocus className={field} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Check DNS resolution" /></Field>
          <Field label="ID" hint={dup ? "This ID already exists." : `Will be saved as “${finalId}”.`}><input className={`${field} font-mono`} value={id} placeholder={autoId} onChange={(e) => setId(e.target.value.replace(/[^\w-]/g, ""))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><select className={`${field} capitalize`} value={kind} onChange={(e) => setKind(e.target.value as NodeKind)}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
            <Field label="Status"><select className={`${field} capitalize`} value={status} onChange={(e) => setStatus(e.target.value as NodeStatus)}>{STATUSES.map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Btn variant="ghost" onClick={() => { onOpenChange(false); reset(); }}>Cancel</Btn>
          <Btn disabled={!label.trim() || dup} onClick={() => { onSave({ id: finalId, label: label.trim(), kind, status, logs: [] }); reset(); }}>Add node</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EdgeDialog({ state, nodes, onClose, onSave }: { state: { index: number | null; edge: WEdge } | null; nodes: WNode[]; onClose: () => void; onSave: (e: WEdge) => void }) {
  return (
    <Dialog open={!!state} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        {state && <EdgeForm key={`${state.index}-${state.edge.from}-${state.edge.to}`} state={state} nodes={nodes} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function EdgeForm({ state, nodes, onClose, onSave }: { state: { index: number | null; edge: WEdge }; nodes: WNode[]; onClose: () => void; onSave: (e: WEdge) => void }) {
  const [e, setE] = useState<WEdge>(state.edge);
  const ok = e.from && e.to && e.from !== e.to && e.cost >= 0;
  return (
    <>
      <DialogHeader><DialogTitle>{state.index === null ? "Add transition" : "Edit transition"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><select className={field} value={e.from} onChange={(ev) => setE({ ...e, from: ev.target.value })}>{nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Field>
          <Field label="To"><select className={field} value={e.to} onChange={(ev) => setE({ ...e, to: ev.target.value })}>{nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Field>
        </div>
        {e.from === e.to && <p className="text-xs text-destructive">Source and target must differ.</p>}
        <Field label="Action"><input autoFocus className={field} value={e.action} placeholder="e.g. Run traceroute" onChange={(ev) => setE({ ...e, action: ev.target.value })} /></Field>
        <Field label="Cost (simulated minutes)"><input type="number" min={0} className={`${field} font-mono`} value={e.cost} onChange={(ev) => setE({ ...e, cost: Math.max(0, +ev.target.value || 0) })} /></Field>
      </div>
      <DialogFooter className="gap-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!ok} onClick={() => onSave({ ...e, action: e.action.trim() || "Transition" })}>{state.index === null ? "Add transition" : "Save changes"}</Btn>
      </DialogFooter>
    </>
  );
}
