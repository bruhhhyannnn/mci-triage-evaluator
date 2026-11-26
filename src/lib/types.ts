export type Tag = 'GREEN' | 'YELLOW' | 'RED' | 'BLACK';
export type Method = 'START' | 'SIEVE' | 'SAVE' | 'SORT';
export type DayKey = 'day1' | 'day2' | 'day3';

export const TAGS: Tag[] = ['GREEN', 'YELLOW', 'RED', 'BLACK'];
export const TAG_LABEL: Record<Tag, string> = {
  GREEN: 'Green',
  YELLOW: 'Yellow',
  RED: 'Red',
  BLACK: 'Black',
};

export interface AcceptedAnswer {
  /** Any of these tags scores the point. */
  tags: Tag[];
  /** Condition explaining when each tag applies, shown to the evaluator. */
  note?: string;
}

export interface Victim {
  id: string;
  correct: Partial<Record<Method, AcceptedAnswer>>;
}

export interface DayConfig {
  key: DayKey;
  label: string;
  setTitle: string;
  /** Methods in the order they are run on that day. */
  methods: Method[];
  victims: Victim[];
}

/** One method (e.g. START) as run by one trainee. */
export interface MethodRun {
  answers: Record<string, Tag>;
  /** Time accumulated while the stopwatch was running, excluding the current run. */
  elapsedMs: number;
  /** Epoch ms when the stopwatch was last started; null when stopped. */
  startedAt: number | null;
  /** ISO time the method was finished (all tagged or Done tapped). */
  finishedAt: string | null;
}

export interface Evaluation {
  id: string;
  day: DayKey;
  traineeName: string;
  evaluatorName: string;
  /** YYYY-MM-DD */
  date: string;
  group: string;
  runs: Partial<Record<Method, MethodRun>>;
  /** ISO time the evaluator saved the finished sheet; null while in progress. */
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Drill details set once and reused for every trainee. */
export interface Drill {
  day: DayKey;
  evaluatorName: string;
  date: string;
  group: string;
}

export interface RosterEntry {
  id: string;
  name: string;
  group: string;
}
