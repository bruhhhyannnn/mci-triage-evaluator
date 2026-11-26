import { describe, expect, it } from 'vitest';
import { DAYS } from '../data/days';
import { parseClock, nameMatches } from './format';
import { methodRows, toCsv } from './export';
import { parseRosterRows } from './roster';
import { scoreEvaluation, scoreMethod } from './scoring';
import type { Evaluation, MethodRun, Tag } from './types';

const run = (answers: Record<string, Tag>, elapsedMs = 0): MethodRun => ({ answers, elapsedMs, startedAt: null, finishedAt: 'x' });

describe('answer keys', () => {
  it('match the original app sizes and point totals', () => {
    expect(DAYS.day1.victims).toHaveLength(20);
    expect(DAYS.day2.victims).toHaveLength(20);
    expect(DAYS.day3.victims).toHaveLength(18);
    expect(DAYS.day1.victims.length * DAYS.day1.methods.length).toBe(40);
    expect(DAYS.day2.victims.length * DAYS.day2.methods.length).toBe(40);
    expect(DAYS.day3.victims.length * DAYS.day3.methods.length).toBe(72);
    expect(DAYS.day3.methods).toEqual(['START', 'SAVE', 'SIEVE', 'SORT']);
  });

  it('has an answer for every victim and method of each day', () => {
    for (const day of Object.values(DAYS)) {
      for (const v of day.victims) for (const m of day.methods) expect(v.correct[m]?.tags.length, `${day.key} ${v.id} ${m}`).toBeGreaterThan(0);
    }
  });

  it('spot-checks keys copied from the original', () => {
    const d2 = DAYS.day2.victims;
    expect(d2.find((v) => v.id === 'T9')?.correct.SAVE?.tags).toEqual(['BLACK']);
    expect(d2.find((v) => v.id === 'T20')?.correct.SORT?.tags).toEqual(['BLACK', 'RED']);
    const e7 = DAYS.day3.victims.find((v) => v.id === 'E7')!;
    expect([e7.correct.START?.tags[0], e7.correct.SAVE?.tags[0], e7.correct.SIEVE?.tags[0], e7.correct.SORT?.tags[0]]).toEqual(['RED', 'RED', 'YELLOW', 'GREEN']);
  });
});

describe('scoring', () => {
  it('counts 1 point per correct tag, any accepted tag scores, untagged scores 0', () => {
    const s = scoreMethod(DAYS.day1, 'START', run({ T1: 'GREEN', T2: 'RED', T20: 'BLACK' }, 65_000));
    expect(s).toMatchObject({ correct: 2, wrong: 1, tagged: 3, untagged: 17, total: 20, timeMs: 65_000 });
  });

  it('totals a Day 3 sheet out of 72', () => {
    const answers = Object.fromEntries(DAYS.day3.victims.map((v) => [v.id, v.correct.START!.tags[0]]));
    const e: Evaluation = {
      id: 'x', day: 'day3', traineeName: 'A B', evaluatorName: '', date: '2026-11-26', group: '',
      runs: { START: run(answers) }, completedAt: null, createdAt: '', updatedAt: '',
    };
    const s = scoreEvaluation(e);
    expect(s.total).toBe(72);
    expect(s.correct).toBe(18);
  });
});

describe('helpers', () => {
  it('parses times', () => {
    expect(parseClock('3:05')).toBe(185_000);
    expect(parseClock('90')).toBe(90_000);
    expect(parseClock('abc')).toBeNull();
  });

  it('finds names by last name or partial words', () => {
    expect(nameMatches('Juan Dela Cruz', 'dela')).toBe(true);
    expect(nameMatches('Juan Dela Cruz', 'cruz ju')).toBe(true);
    expect(nameMatches('María Peña', 'pena')).toBe(true);
    expect(nameMatches('Juan Dela Cruz', 'santos')).toBe(false);
  });

  it('reads roster rows with Last/First columns', () => {
    const r = parseRosterRows([['Roster'], ['Last Name', 'First Name', 'Batch'], ['Cruz', 'Juan', 'B1'], ['', '', ''], ['Santos', 'Maria', '']]);
    expect(r.entries).toEqual([{ name: 'Juan Cruz', group: 'B1' }, { name: 'Maria Santos', group: '' }]);
  });

  it('exports the original CSV columns and escapes commas', () => {
    const e: Evaluation = {
      id: 'id1', day: 'day1', traineeName: 'Cruz, Juan', evaluatorName: 'Ev', date: '2026-11-26', group: 'B1',
      runs: { START: run({ T1: 'GREEN' }, 10_000) }, completedAt: 'x', createdAt: '', updatedAt: '',
    };
    const rows = methodRows([e]);
    expect(rows[0].slice(0, 11)).toEqual(['session_id', 'day', 'evaluation_date', 'evaluator', 'team', 'member_full_name', 'method', 'correct', 'total', 'accuracy_percent', 'time_seconds']);
    expect(rows).toHaveLength(3);
    expect(toCsv(rows)).toContain('"Cruz, Juan"');
  });
});
