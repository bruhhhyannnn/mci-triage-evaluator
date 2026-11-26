import { getDay } from '../data/days';
import { scoreEvaluation, scoreMethod, isCorrect } from './scoring';
import type { Evaluation } from './types';

type Cell = string | number;

function csvCell(value: Cell): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * One row per trainee per method. Same columns as the original app's export,
 * so files from both tools line up in a spreadsheet.
 */
export function methodRows(evaluations: Evaluation[]): Cell[][] {
  const victimIds = Array.from(new Set(evaluations.flatMap((e) => getDay(e.day).victims.map((v) => v.id))));
  const header: Cell[] = [
    'session_id',
    'day',
    'evaluation_date',
    'evaluator',
    'team',
    'member_full_name',
    'method',
    'correct',
    'total',
    'accuracy_percent',
    'time_seconds',
    ...victimIds.flatMap((id) => [`${id}_answer`, `${id}_correct`]),
  ];
  const rows: Cell[][] = [header];
  for (const e of evaluations) {
    const day = getDay(e.day);
    for (const method of day.methods) {
      const run = e.runs[method];
      const score = scoreMethod(day, method, run);
      rows.push([
        e.id,
        day.label,
        e.date,
        e.evaluatorName,
        e.group,
        e.traineeName,
        method,
        score.correct,
        score.total,
        Math.round(score.accuracy * 100),
        Math.round(score.timeMs / 1000),
        ...victimIds.flatMap((id) => {
          const victim = day.victims.find((v) => v.id === id);
          const tag = run?.answers[id];
          if (!victim) return ['', ''];
          return [tag ?? '', isCorrect(victim, method, tag) ? 'yes' : 'no'];
        }),
      ]);
    }
  }
  return rows;
}

/** One row per evaluation sheet: the quick overview. */
export function summaryRows(evaluations: Evaluation[]): Cell[][] {
  const rows: Cell[][] = [
    [
      'Trainee',
      'Day',
      'Date',
      'Group or batch',
      'Evaluator',
      'START',
      'SIEVE',
      'SAVE',
      'SORT',
      'Total correct',
      'Total possible',
      'Score %',
      'Time (s)',
      'Status',
    ],
  ];
  for (const e of evaluations) {
    const score = scoreEvaluation(e);
    const byMethod = (m: string) => {
      const s = score.methods.find((x) => x.method === m);
      return s ? `${s.correct}/${s.total}` : '';
    };
    rows.push([
      e.traineeName,
      score.day.label,
      e.date,
      e.group,
      e.evaluatorName,
      byMethod('START'),
      byMethod('SIEVE'),
      byMethod('SAVE'),
      byMethod('SORT'),
      score.correct,
      score.total,
      Math.round(score.accuracy * 100),
      Math.round(score.timeMs / 1000),
      e.completedAt ? 'Saved' : 'In progress',
    ]);
  }
  return rows;
}

/** One row per trainee with their newest Day 1, Day 2 and Day 3 scores side by side. */
export function traineeRows(evaluations: Evaluation[]): Cell[][] {
  const rows: Cell[][] = [
    ['Trainee', 'Group or batch', 'Day 1', 'Day 1 %', 'Day 2', 'Day 2 %', 'Day 3 E-Set', 'Day 3 %'],
  ];
  const byTrainee = new Map<string, { name: string; group: string; days: Partial<Record<string, Evaluation>> }>();
  const newestFirst = [...evaluations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const e of newestFirst) {
    const key = e.traineeName.toLowerCase().replace(/\s+/g, ' ').trim();
    const entry = byTrainee.get(key) ?? { name: e.traineeName, group: e.group, days: {} };
    entry.days[e.day] ??= e;
    byTrainee.set(key, entry);
  }
  const cells = (e: Evaluation | undefined): Cell[] => {
    if (!e) return ['', ''];
    const s = scoreEvaluation(e);
    return [`${s.correct}/${s.total}${e.completedAt ? '' : ' (unfinished)'}`, Math.round(s.accuracy * 100)];
  };
  for (const t of [...byTrainee.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    rows.push([t.name, t.group, ...cells(t.days.day1), ...cells(t.days.day2), ...cells(t.days.day3)]);
  }
  return rows;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function download(filename: string, data: BlobPart, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv(evaluations: Evaluation[], stamp: string) {
  // BOM so Excel opens names with accents (e.g. Peña) correctly.
  download(`mci-triage-${stamp}.csv`, '﻿' + toCsv(methodRows(evaluations)), 'text/csv;charset=utf-8');
}

export async function exportExcel(evaluations: Evaluation[], stamp: string) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const addSheet = (name: string, rows: Cell[][]) => {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    rows.forEach((r) => sheet.addRow(r));
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((col, i) => {
      const longest = Math.max(...rows.map((r) => String(r[i] ?? '').length), 6);
      col.width = Math.min(40, longest + 2);
    });
  };
  addSheet('By trainee', traineeRows(evaluations));
  addSheet('Sheets', summaryRows(evaluations));
  addSheet('By method', methodRows(evaluations));
  const buffer = await workbook.xlsx.writeBuffer();
  download(
    `mci-triage-${stamp}.xlsx`,
    buffer as ArrayBuffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
