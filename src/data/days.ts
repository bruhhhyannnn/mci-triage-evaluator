import type { AcceptedAnswer, DayConfig, DayKey, Method, Tag, Victim } from '../lib/types';

// Answer keys carried over unchanged from the original MCI Triage Evaluation app.

const one = (tag: Tag): AcceptedAnswer => ({ tags: [tag] });
const v = (id: string, correct: Partial<Record<Method, AcceptedAnswer>>): Victim => ({ id, correct });

/** Day 1: same tag for START and SIEVE unless noted. */
const day1: Victim[] = [
  ['T1', 'GREEN'], ['T2', 'YELLOW'], ['T3', 'GREEN'], ['T4', 'YELLOW'], ['T5', 'GREEN'],
  ['T6', 'GREEN'], ['T7', 'RED'], ['T8', 'YELLOW'], ['T9', 'RED'], ['T10', 'GREEN'],
  ['T11', 'YELLOW'], ['T12', 'RED'], ['T13', 'GREEN'], ['T14', 'GREEN'], ['T15', 'RED'],
  ['T16', 'YELLOW'], ['T17', 'GREEN'], ['T18', 'GREEN'], ['T19', 'GREEN'],
].map(([id, tag]) => v(id, { START: one(tag as Tag), SIEVE: one(tag as Tag) }));
day1.push(
  v('T20', {
    START: { tags: ['RED', 'BLACK'], note: 'RED if airway opened; BLACK if not attempted' },
    SIEVE: { tags: ['RED', 'BLACK'], note: 'RED or BLACK if not breathing' },
  }),
);

const day2: Victim[] = [
  v('T1', {
    SAVE: { tags: ['RED', 'YELLOW', 'BLACK'], note: 'RED = head injury; YELLOW = intoxication; BLACK if no NSS' },
    SORT: one('YELLOW'),
  }),
  v('T2', { SAVE: one('RED'), SORT: one('YELLOW') }),
  v('T3', { SAVE: one('YELLOW'), SORT: one('GREEN') }),
  v('T4', {
    SAVE: { tags: ['GREEN', 'RED'], note: 'RED if wound not packed within 5 mins of being seen' },
    SORT: one('GREEN'),
  }),
  v('T5', { SAVE: one('RED'), SORT: one('GREEN') }),
  v('T6', { SAVE: one('RED'), SORT: one('GREEN') }),
  v('T7', { SAVE: one('RED'), SORT: one('RED') }),
  v('T8', { SAVE: one('YELLOW'), SORT: one('GREEN') }),
  v('T9', { SAVE: one('BLACK'), SORT: one('RED') }),
  v('T10', { SAVE: one('RED'), SORT: one('YELLOW') }),
  v('T11', { SAVE: one('GREEN'), SORT: one('GREEN') }),
  v('T12', { SAVE: one('RED'), SORT: { tags: ['YELLOW', 'RED'], note: 'RED if TP develops' } }),
  v('T13', { SAVE: one('RED'), SORT: one('RED') }),
  v('T14', { SAVE: one('RED'), SORT: one('YELLOW') }),
  v('T15', { SAVE: one('BLACK'), SORT: one('BLACK') }),
  v('T16', { SAVE: one('YELLOW'), SORT: one('GREEN') }),
  v('T17', { SAVE: one('RED'), SORT: one('RED') }),
  v('T18', { SAVE: one('RED'), SORT: one('YELLOW') }),
  v('T19', { SAVE: one('GREEN'), SORT: one('GREEN') }),
  v('T20', { SAVE: one('GREEN'), SORT: { tags: ['BLACK', 'RED'], note: 'BLACK if not revived; RED if revived' } }),
];

/** Day 3 E-Set, columns in run order: START, SAVE, SIEVE, SORT. */
const e = (id: string, start: Tag, save: Tag, sieve: Tag, sort: Tag): Victim =>
  v(id, { START: one(start), SAVE: one(save), SIEVE: one(sieve), SORT: one(sort) });

const day3: Victim[] = [
  e('E1', 'GREEN', 'GREEN', 'GREEN', 'GREEN'),
  v('E2', {
    START: one('YELLOW'),
    SAVE: { tags: ['YELLOW', 'RED'], note: 'YELLOW at 10 min arrival (PR 120/min); RED at 5 min arrival (90/60)' },
    SIEVE: one('YELLOW'),
    SORT: { tags: ['GREEN', 'RED'], note: 'GREEN at 10 min arrival (PR 120/min); RED at 5 min arrival (90/60)' },
  }),
  e('E3', 'GREEN', 'GREEN', 'GREEN', 'GREEN'),
  e('E4', 'GREEN', 'GREEN', 'GREEN', 'GREEN'),
  e('E5', 'GREEN', 'RED', 'GREEN', 'GREEN'),
  e('E6', 'GREEN', 'RED', 'GREEN', 'GREEN'),
  e('E7', 'RED', 'RED', 'YELLOW', 'GREEN'),
  e('E8', 'RED', 'RED', 'YELLOW', 'GREEN'),
  e('E9', 'RED', 'BLACK', 'RED', 'RED'),
  e('E10', 'BLACK', 'BLACK', 'BLACK', 'BLACK'),
  e('E11', 'GREEN', 'RED', 'GREEN', 'YELLOW'),
  e('E12', 'YELLOW', 'GREEN', 'YELLOW', 'GREEN'),
  e('E13', 'RED', 'RED', 'RED', 'YELLOW'),
  e('E14', 'GREEN', 'RED', 'GREEN', 'YELLOW'),
  e('E15', 'RED', 'RED', 'RED', 'RED'),
  e('E16', 'GREEN', 'RED', 'GREEN', 'YELLOW'),
  e('E17', 'RED', 'BLACK', 'RED', 'RED'),
  e('E18', 'BLACK', 'BLACK', 'BLACK', 'BLACK'),
];

export const DAYS: Record<DayKey, DayConfig> = {
  day1: { key: 'day1', label: 'Day 1', setTitle: 'Primary Triage-T Set', methods: ['START', 'SIEVE'], victims: day1 },
  day2: { key: 'day2', label: 'Day 2', setTitle: 'Secondary Triage-T Set', methods: ['SAVE', 'SORT'], victims: day2 },
  day3: {
    key: 'day3',
    label: 'Day 3 E-Set',
    setTitle: 'Grand Simulation E-Set',
    methods: ['START', 'SAVE', 'SIEVE', 'SORT'],
    victims: day3,
  },
};

export const DAY_KEYS: DayKey[] = ['day1', 'day2', 'day3'];

export function getDay(key: DayKey): DayConfig {
  return DAYS[key] ?? DAYS.day1;
}
