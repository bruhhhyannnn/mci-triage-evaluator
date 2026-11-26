import { describe, expect, it } from 'vitest';
import { DAYS } from '../data/days';
import { traineeRows } from './export';
import {
  createEvaluation,
  finishMethod,
  getState,
  makeBackup,
  reopenMethod,
  resetMethod,
  restoreBackup,
  setTag,
  startTimer,
} from './store';
import type { Drill, Tag } from './types';

const drill: Drill = { day: 'day1', evaluatorName: 'Ana Reyes', group: 'Batch 3' };
const tagAllCorrect = (id: string, method: 'START' | 'SIEVE') => {
  let completed = false;
  for (const v of DAYS.day1.victims) completed = setTag(id, method, v.id, v.correct[method]!.tags[0] as Tag);
  return completed;
};

describe('sheet lifecycle', () => {
  it('saves the sheet itself once the last method finishes', () => {
    const e = createEvaluation('Juan Dela Cruz', drill);
    startTimer(e.id, 'START');
    expect(tagAllCorrect(e.id, 'START')).toBe(true);
    const afterStart = getState().evaluations[e.id];
    expect(afterStart.runs.START?.finishedAt).toBeTruthy();
    expect(afterStart.runs.START?.startedAt).toBeNull();
    expect(afterStart.completedAt).toBeNull();

    startTimer(e.id, 'SIEVE');
    finishMethod(e.id, 'SIEVE');
    expect(getState().evaluations[e.id].completedAt).toBeTruthy();
  });

  it('Undo after the last tag restores it, reopens the method and restarts the stopwatch', () => {
    const e = createEvaluation('Maria Santos', drill);
    startTimer(e.id, 'START');
    for (const v of DAYS.day1.victims.slice(0, 19)) setTag(e.id, 'START', v.id, v.correct.START!.tags[0] as Tag);
    expect(setTag(e.id, 'START', 'T20', 'GREEN')).toBe(true);
    reopenMethod(e.id, 'START', { victimId: 'T20', previous: null });
    const run = getState().evaluations[e.id].runs.START!;
    expect(run.finishedAt).toBeNull();
    expect(run.startedAt).not.toBeNull();
    expect(run.answers.T20).toBeUndefined();
  });

  it('redoing a method on a saved sheet marks it unfinished again', () => {
    const e = createEvaluation('Pedro Penduko', drill);
    tagAllCorrect(e.id, 'START');
    finishMethod(e.id, 'SIEVE');
    expect(getState().evaluations[e.id].completedAt).toBeTruthy();
    resetMethod(e.id, 'START');
    expect(getState().evaluations[e.id].completedAt).toBeNull();
  });

  it('dates the sheet today and takes the roster group when the drill has none', () => {
    const e = createEvaluation('Ana Lim', { ...drill, group: '' }, 'Batch 4');
    expect(e.group).toBe('Batch 4');
    expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('backup', () => {
  it('restores into another device by merging, newer copy wins', () => {
    const backup = makeBackup();
    const id = backup.evaluations[0].id;
    const older = { ...backup, evaluations: backup.evaluations.map((e) => ({ ...e, updatedAt: '2000-01-01T00:00:00.000Z' })) };
    expect(restoreBackup(older).sheets).toBe(0);
    const newer = {
      ...backup,
      evaluations: backup.evaluations.map((e) => (e.id === id ? { ...e, traineeName: 'Renamed', updatedAt: '2999-01-01T00:00:00.000Z' } : e)),
    };
    expect(restoreBackup(newer).sheets).toBe(1);
    expect(getState().evaluations[id].traineeName).toBe('Renamed');
  });

  it('rejects files that are not a backup', () => {
    expect(() => restoreBackup({ hello: 'world' })).toThrow(/not an MCI Triage Evaluator backup/);
  });
});

describe('Excel by-trainee sheet', () => {
  it('puts each trainee on one row with their newest score per day', () => {
    const rows = traineeRows(Object.values(getState().evaluations));
    expect(rows[0]).toEqual(['Trainee', 'Group or batch', 'Day 1', 'Day 1 %', 'Day 2', 'Day 2 %', 'Day 3 E-Set', 'Day 3 %']);
    const juan = rows.find((r) => r[0] === 'Juan Dela Cruz')!;
    expect(juan[2]).toBe('20/40');
    expect(juan[4]).toBe('');
  });
});
