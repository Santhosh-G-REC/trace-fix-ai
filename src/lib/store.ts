import { useSyncExternalStore } from "react";
import { DEFAULT_SCENARIO, SCENARIOS, type Scenario } from "./scenarios";
import type { AlgoId } from "./algorithms/search";

export interface RunRecord {
  id: string;
  at: string;
  scenarioId: string;
  scenarioTitle: string;
  algorithm: AlgoId;
  found: boolean;
  cost: number | null;
  length: number;
  expanded: number;
  reached: number;
  transitions: number;
  maxFrontier: number;
  runtimeMs: number;
  path: string[];
  recovery: string | null;
  costOverrides: Record<string, number>;
  events: string[];
}

interface State {
  scenarioId: string;
  custom: Scenario[];
  history: RunRecord[];
}

const KEY = "tracefix.v2";
const initial: State = { scenarioId: DEFAULT_SCENARIO, custom: [], history: [] };
let state: State = initial;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...JSON.parse(raw) };
  } catch { /* ignore corrupt storage */ }
}

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      if (!hydrated) { hydrate(); queueMicrotask(l); }
      return () => listeners.delete(l);
    },
    () => sel(state),
    () => sel(initial),
  );
}

export const allScenarios = (custom: Scenario[]) => [...SCENARIOS, ...custom];
export const useCustomScenarios = () => useStore((s) => s.custom);
export const useScenarioId = () => useStore((s) => s.scenarioId);
export const useHistory = () => useStore((s) => s.history);

export const setScenarioId = (id: string) => set({ scenarioId: id });
export const saveCustom = (sc: Scenario) => set({ custom: [...state.custom.filter((c) => c.id !== sc.id), { ...sc, custom: true }] });
export const deleteCustom = (id: string) => set({ custom: state.custom.filter((c) => c.id !== id), scenarioId: state.scenarioId === id ? DEFAULT_SCENARIO : state.scenarioId });
export const addRun = (r: RunRecord) => set({ history: [r, ...state.history].slice(0, 100) });
export const deleteRun = (id: string) => set({ history: state.history.filter((r) => r.id !== id) });
export const clearHistory = () => set({ history: [] });
