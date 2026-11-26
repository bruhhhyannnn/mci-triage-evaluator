import { getDay } from '../data/days';
import type { DayConfig, Evaluation, Method, MethodRun, Tag, Victim } from './types';

export function emptyRun(): MethodRun {
  return { answers: {}, elapsedMs: 0, startedAt: null, finishedAt: null };
}

export function elapsedMs(run: MethodRun | undefined, now = Date.now()): number {
  if (!run) return 0;
  return run.startedAt ? run.elapsedMs + Math.max(0, now - run.startedAt) : run.elapsedMs;
}

export function isCorrect(victim: Victim, method: Method, tag: Tag | undefined): boolean {
  return !!tag && (victim.correct[method]?.tags ?? []).includes(tag);
}

export type VictimStatus = 'correct' | 'wrong' | 'untagged';

export function victimStatus(victim: Victim, method: Method, run: MethodRun | undefined): VictimStatus {
  const tag = run?.answers[victim.id];
  if (!tag) return 'untagged';
  return isCorrect(victim, method, tag) ? 'correct' : 'wrong';
}

export interface MethodScore {
  method: Method;
  correct: number;
  wrong: number;
  tagged: number;
  untagged: number;
  total: number;
  accuracy: number;
  timeMs: number;
  started: boolean;
  finished: boolean;
}

export function scoreMethod(day: DayConfig, method: Method, run: MethodRun | undefined, now = Date.now()): MethodScore {
  let correct = 0;
  let tagged = 0;
  for (const victim of day.victims) {
    const tag = run?.answers[victim.id];
    if (!tag) continue;
    tagged += 1;
    if (isCorrect(victim, method, tag)) correct += 1;
  }
  const total = day.victims.length;
  const timeMs = elapsedMs(run, now);
  return {
    method,
    correct,
    wrong: tagged - correct,
    tagged,
    untagged: total - tagged,
    total,
    accuracy: total ? correct / total : 0,
    timeMs,
    started: !!run && (timeMs > 0 || run.startedAt !== null || tagged > 0),
    finished: !!run?.finishedAt,
  };
}

export interface EvaluationScore {
  day: DayConfig;
  methods: MethodScore[];
  correct: number;
  total: number;
  accuracy: number;
  timeMs: number;
  finishedMethods: number;
}

export function scoreEvaluation(evaluation: Evaluation, now = Date.now()): EvaluationScore {
  const day = getDay(evaluation.day);
  const methods = day.methods.map((m) => scoreMethod(day, m, evaluation.runs[m], now));
  const correct = methods.reduce((sum, m) => sum + m.correct, 0);
  const total = methods.reduce((sum, m) => sum + m.total, 0);
  return {
    day,
    methods,
    correct,
    total,
    accuracy: total ? correct / total : 0,
    timeMs: methods.reduce((sum, m) => sum + m.timeMs, 0),
    finishedMethods: methods.filter((m) => m.finished).length,
  };
}

/** The first method on this sheet that hasn't been finished, or null when all are done. */
export function nextUnfinishedMethod(evaluation: Evaluation): Method | null {
  const day = getDay(evaluation.day);
  return day.methods.find((m) => !evaluation.runs[m]?.finishedAt) ?? null;
}

export function allTagged(day: DayConfig, run: MethodRun | undefined): boolean {
  return !!run && day.victims.every((v) => !!run.answers[v.id]);
}
