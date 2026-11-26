import { useSyncExternalStore } from 'react';
import { getDay } from '../data/days';
import { cleanName, newId, normalizeName, todayISO } from './format';
import { allTagged, elapsedMs, emptyRun } from './scoring';
import type { DayKey, Drill, Evaluation, Method, MethodRun, RosterEntry, Tag } from './types';

const KEYS = {
  drill: 'mci-eval:drill:v1',
  evaluations: 'mci-eval:evaluations:v1',
  roster: 'mci-eval:roster:v1',
} as const;

export interface AppState {
  drill: Drill | null;
  evaluations: Record<string, Evaluation>;
  roster: RosterEntry[];
  /** Set when the last write to device storage failed (e.g. storage full or blocked). */
  storageError: string | null;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

let state: AppState = {
  drill: read<Drill | null>(KEYS.drill, null),
  evaluations: read<Record<string, Evaluation>>(KEYS.evaluations, {}),
  roster: read<RosterEntry[]>(KEYS.roster, []),
  storageError: null,
};

const listeners = new Set<() => void>();

function persist(key: string, value: unknown): string | null {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return null;
  } catch {
    return 'Could not save to this device. Storage may be full or blocked; export your records now.';
  }
}

function setState(patch: Partial<Omit<AppState, 'storageError'>>) {
  let error: string | null = null;
  if ('drill' in patch) error = persist(KEYS.drill, patch.drill) ?? error;
  if ('evaluations' in patch) error = persist(KEYS.evaluations, patch.evaluations) ?? error;
  if ('roster' in patch) error = persist(KEYS.roster, patch.roster) ?? error;
  state = { ...state, ...patch, storageError: error };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): AppState {
  return state;
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

// Other tabs on the same device stay in step.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEYS.drill) state = { ...state, drill: read(KEYS.drill, null) };
    else if (event.key === KEYS.evaluations) state = { ...state, evaluations: read(KEYS.evaluations, {}) };
    else if (event.key === KEYS.roster) state = { ...state, roster: read(KEYS.roster, []) };
    else return;
    listeners.forEach((l) => l());
  });
}

// ---------- Drill ----------

export function saveDrill(drill: Drill) {
  setState({ drill: { ...drill, evaluatorName: cleanName(drill.evaluatorName), group: cleanName(drill.group) } });
}

export function defaultDrill(): Drill {
  return { day: 'day1', evaluatorName: '', date: todayISO(), group: '' };
}

// ---------- Evaluations ----------

function putEvaluation(evaluation: Evaluation) {
  setState({ evaluations: { ...state.evaluations, [evaluation.id]: evaluation } });
}

function updateEvaluation(id: string, change: (e: Evaluation) => Evaluation) {
  const current = state.evaluations[id];
  if (!current) return;
  putEvaluation({ ...change(current), updatedAt: new Date().toISOString() });
}

export function createEvaluation(traineeName: string, drill: Drill): Evaluation {
  const now = new Date().toISOString();
  const evaluation: Evaluation = {
    id: newId('eval'),
    day: drill.day,
    traineeName: cleanName(traineeName),
    evaluatorName: drill.evaluatorName,
    date: drill.date,
    group: drill.group,
    runs: {},
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  putEvaluation(evaluation);
  return evaluation;
}

export function updateDetails(
  id: string,
  details: Pick<Evaluation, 'traineeName' | 'evaluatorName' | 'date' | 'group'>,
) {
  updateEvaluation(id, (e) => ({
    ...e,
    traineeName: cleanName(details.traineeName) || e.traineeName,
    evaluatorName: cleanName(details.evaluatorName),
    date: details.date || e.date,
    group: cleanName(details.group),
  }));
}

function updateRun(id: string, method: Method, change: (run: MethodRun) => MethodRun) {
  updateEvaluation(id, (e) => ({ ...e, runs: { ...e.runs, [method]: change(e.runs[method] ?? emptyRun()) } }));
}

export function startTimer(id: string, method: Method) {
  updateRun(id, method, (run) => (run.startedAt ? run : { ...run, startedAt: Date.now() }));
}

export function pauseTimer(id: string, method: Method) {
  updateRun(id, method, (run) => (run.startedAt ? { ...run, elapsedMs: elapsedMs(run), startedAt: null } : run));
}

export function setTime(id: string, method: Method, ms: number) {
  updateRun(id, method, (run) => ({ ...run, elapsedMs: Math.max(0, ms), startedAt: null }));
}

/**
 * Sets (or clears, when tag is null) one victim's tag. Returns true when this
 * tag completed the method, in which case the stopwatch has been stopped.
 */
export function setTag(id: string, method: Method, victimId: string, tag: Tag | null): boolean {
  const evaluation = state.evaluations[id];
  if (!evaluation) return false;
  const day = getDay(evaluation.day);
  let completed = false;
  updateRun(id, method, (run) => {
    const answers = { ...run.answers };
    if (tag) answers[victimId] = tag;
    else delete answers[victimId];
    const next = { ...run, answers };
    if (tag && !run.finishedAt && allTagged(day, next)) {
      completed = true;
      return { ...next, elapsedMs: elapsedMs(run), startedAt: null, finishedAt: new Date().toISOString() };
    }
    return next;
  });
  return completed;
}

export function finishMethod(id: string, method: Method) {
  updateRun(id, method, (run) => ({
    ...run,
    elapsedMs: elapsedMs(run),
    startedAt: null,
    finishedAt: run.finishedAt ?? new Date().toISOString(),
  }));
}

export function resetMethod(id: string, method: Method) {
  updateRun(id, method, () => emptyRun());
}

export function completeEvaluation(id: string) {
  updateEvaluation(id, (e) => {
    const runs = { ...e.runs };
    for (const m of Object.keys(runs) as Method[]) {
      const run = runs[m]!;
      runs[m] = { ...run, elapsedMs: elapsedMs(run), startedAt: null, finishedAt: run.finishedAt ?? new Date().toISOString() };
    }
    return { ...e, runs, completedAt: e.completedAt ?? new Date().toISOString() };
  });
}

export function deleteEvaluation(id: string) {
  const next = { ...state.evaluations };
  delete next[id];
  setState({ evaluations: next });
}

export function evaluationsList(evaluations: Record<string, Evaluation>): Evaluation[] {
  return Object.values(evaluations).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function findEvaluationsFor(name: string, day?: DayKey): Evaluation[] {
  const key = normalizeName(name);
  return evaluationsList(state.evaluations).filter(
    (e) => normalizeName(e.traineeName) === key && (!day || e.day === day),
  );
}

// ---------- Roster ----------

export function addRosterEntries(entries: { name: string; group: string }[], mode: 'merge' | 'replace') {
  const base = mode === 'replace' ? [] : state.roster;
  const seen = new Set(base.map((r) => `${normalizeName(r.name)}|${normalizeName(r.group)}`));
  const added: RosterEntry[] = [];
  for (const entry of entries) {
    const name = cleanName(entry.name);
    if (!name) continue;
    const group = cleanName(entry.group);
    const key = `${normalizeName(name)}|${normalizeName(group)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    added.push({ id: newId('roster'), name, group });
  }
  setState({ roster: [...base, ...added] });
  return added.length;
}

export function removeRosterEntry(id: string) {
  setState({ roster: state.roster.filter((r) => r.id !== id) });
}

export function clearRoster() {
  setState({ roster: [] });
}
