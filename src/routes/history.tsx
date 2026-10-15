import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Download, FileJson, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { Btn, Metric, Panel } from "@/components/AppShell";
import { clearHistory, deleteRun, useHistory } from "@/lib/store";
import { algoName, download, toCsv, toMarkdown } from "@/lib/runs";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/history")({
  head: () => meta("Run History", "Past simulator runs with path cost, length and expanded states, exportable as Markdown, JSON or CSV."),
  component: HistoryPage,
});

function HistoryPage() {
  const runs = useHistory();
  const [openId, setOpenId] = useState<string | null>(null);
  const r = runs.find((x) => x.id === openId) ?? null;
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">Run History</h1>
        <span className="text-xs text-muted-foreground">Saved automatically when a run finishes. Stored in this browser only.</span>
        <div className="ml-auto flex gap-2">
          <Btn variant="ghost" disabled={!runs.length} onClick={() => download(toCsv(runs), "runs.csv", "text/csv")}><Download className="h-4 w-4" />CSV</Btn>
          <Btn variant="ghost" disabled={!runs.length} onClick={() => { if (confirm("Delete all runs?")) clearHistory(); }}><Trash2 className="h-4 w-4" />Clear</Btn>
        </div>
      </div>
      {!runs.length ? (
        <Panel><p className="py-8 text-center text-sm text-muted-foreground">No runs yet. <Link to="/" className="text-primary hover:underline">Open the simulator</Link> and press Run.</p></Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Panel className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left font-mono text-[10px] uppercase text-muted-foreground"><tr><th className="py-1">Time</th><th>Scenario</th><th>Algo</th><th>Result</th><th>Cost</th><th>Length</th><th>Expanded</th></tr></thead>
              <tbody>
                {runs.map((x) => (
                  <tr key={x.id} onClick={() => setOpenId(x.id)} className={`cursor-pointer border-t border-border hover:bg-muted/50 ${x.id === openId ? "bg-primary/10" : ""}`}>
                    <td className="py-1.5 font-mono text-xs">{new Date(x.at).toLocaleString()}</td>
                    <td className="text-xs">{x.scenarioTitle}</td>
                    <td className="font-mono">{algoName(x.algorithm)}</td>
                    <td>{x.found ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}</td>
                    <td className="font-mono">{x.cost ?? "—"}</td><td className="font-mono">{x.length}</td><td className="font-mono">{x.expanded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Run details">
            {!r ? <p className="text-xs text-muted-foreground">Select a run.</p> : (
              <div className="space-y-3">
                <div><div className="text-sm font-semibold">{r.scenarioTitle} · {algoName(r.algorithm)}</div><div className="font-mono text-[10px] text-muted-foreground">{r.at}</div></div>
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="Cost" value={r.cost ?? "—"} tone="success" /><Metric label="Length" value={r.length} /><Metric label="Expanded" value={r.expanded} tone="primary" />
                  <Metric label="Reached" value={r.reached} /><Metric label="Transitions" value={r.transitions} /><Metric label="ms" value={r.runtimeMs} />
                </div>
                <p className="text-xs"><span className="text-muted-foreground">Path:</span> {r.path.join(" → ") || "—"}</p>
                {r.recovery && <p className="rounded bg-success/10 p-2 text-xs">Recovery: <strong>{r.recovery}</strong></p>}
                <ol className="max-h-56 overflow-y-auto rounded border border-border p-2 font-mono text-[10px]">{r.events.map((e, i) => <li key={i}>{i + 1}. {e}</li>)}</ol>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="ghost" onClick={() => download(toMarkdown(r), `run-${r.id.slice(0, 8)}.md`, "text/markdown")}><Download className="h-4 w-4" />Markdown</Btn>
                  <Btn variant="ghost" onClick={() => download(JSON.stringify(r, null, 2), `run-${r.id.slice(0, 8)}.json`, "application/json")}><FileJson className="h-4 w-4" />JSON</Btn>
                  <Btn variant="ghost" onClick={() => { deleteRun(r.id); setOpenId(null); }}><Trash2 className="h-4 w-4" />Delete</Btn>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
