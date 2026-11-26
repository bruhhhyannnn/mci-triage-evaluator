import { useMemo, useState } from 'react';
import { TopBar, toast } from '../components/ui';
import { DAY_KEYS, DAYS, getDay } from '../data/days';
import { exportCsv, exportExcel } from '../lib/export';
import { formatDate, nameMatches, normalizeName, percent, todayISO } from '../lib/format';
import { navigate } from '../lib/router';
import { nextUnfinishedMethod, scoreEvaluation } from '../lib/scoring';
import { evaluationsList, useAppState } from '../lib/store';
import type { DayKey, Evaluation } from '../lib/types';

type View = 'sheets' | 'trainees';
type Status = 'all' | 'saved' | 'unfinished';

function open(e: Evaluation) {
  const next = nextUnfinishedMethod(e);
  if (!e.completedAt && next && !e.runs[next]) navigate({ name: 'run', id: e.id, method: next });
  else navigate({ name: 'summary', id: e.id });
}

export default function Records() {
  const evaluations = useAppState((s) => s.evaluations);
  const [view, setView] = useState<View>('sheets');
  const [query, setQuery] = useState('');
  const [day, setDay] = useState<DayKey | 'all'>('all');
  const [group, setGroup] = useState('all');
  const [status, setStatus] = useState<Status>('all');
  const [busy, setBusy] = useState(false);

  const all = useMemo(() => evaluationsList(evaluations), [evaluations]);
  const groups = useMemo(() => Array.from(new Set(all.map((e) => e.group).filter(Boolean))).sort(), [all]);

  const filtered = useMemo(
    () =>
      all.filter(
        (e) =>
          (day === 'all' || e.day === day) &&
          (group === 'all' || (group === '' ? !e.group : e.group === group)) &&
          (status === 'all' || (status === 'saved' ? !!e.completedAt : !e.completedAt)) &&
          nameMatches(e.traineeName, query),
      ),
    [all, day, group, status, query],
  );

  const trainees = useMemo(() => {
    const map = new Map<string, { name: string; group: string; byDay: Partial<Record<DayKey, Evaluation>> }>();
    // Newest sheet per trainee per day wins; `filtered` is already newest first.
    for (const e of filtered) {
      const key = normalizeName(e.traineeName);
      const entry = map.get(key) ?? { name: e.traineeName, group: e.group, byDay: {} };
      entry.byDay[e.day] ??= e;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  async function runExport(kind: 'csv' | 'xlsx') {
    if (filtered.length === 0) return;
    const stamp = `${todayISO()}${day !== 'all' ? `-${day}` : ''}`;
    try {
      setBusy(true);
      if (kind === 'csv') exportCsv(filtered, stamp);
      else await exportExcel(filtered, stamp);
      toast(`Exported ${filtered.length} ${filtered.length === 1 ? 'sheet' : 'sheets'}.`);
    } catch {
      toast('Export failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const filtersActive = day !== 'all' || group !== 'all' || status !== 'all' || query.trim() !== '';

  return (
    <main className="screen">
      <TopBar title="Records" subtitle={`${all.length} ${all.length === 1 ? 'sheet' : 'sheets'} on this device`} />

      <div className="filters">
        <input
          type="search"
          className="search"
          placeholder="Search trainee name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search trainee name"
        />
        <div className="chips" role="group" aria-label="Day">
          <button type="button" className={day === 'all' ? 'chip on' : 'chip'} aria-pressed={day === 'all'} onClick={() => setDay('all')}>
            All days
          </button>
          {DAY_KEYS.map((k) => (
            <button key={k} type="button" className={day === k ? 'chip on' : 'chip'} aria-pressed={day === k} onClick={() => setDay(k)}>
              {DAYS[k].label}
            </button>
          ))}
        </div>
        <div className="field-row">
          <label className="field compact">
            <span>Group</span>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="all">All groups</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              <option value="">No group</option>
            </select>
          </label>
          <label className="field compact">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="all">All</option>
              <option value="saved">Saved</option>
              <option value="unfinished">Not finished</option>
            </select>
          </label>
        </div>
      </div>

      <div className="records-toolbar">
        <div className="segmented small" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={view === 'sheets'} onClick={() => setView('sheets')}>
            Sheets ({filtered.length})
          </button>
          <button type="button" role="tab" aria-selected={view === 'trainees'} onClick={() => setView('trainees')}>
            By trainee ({trainees.length})
          </button>
        </div>
        {filtersActive && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setQuery('');
              setDay('all');
              setGroup('all');
              setStatus('all');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="empty">{all.length === 0 ? 'No sheets saved yet.' : 'No sheets match these filters.'}</p>
      ) : view === 'sheets' ? (
        <ul className="list">
          {filtered.map((e) => {
            const s = scoreEvaluation(e);
            return (
              <li key={e.id}>
                <button type="button" className="list-row" onClick={() => open(e)}>
                  <span className="list-main">
                    {e.traineeName}
                    <small className="muted">
                      {getDay(e.day).label} · {formatDate(e.date)}
                      {e.group ? ` · ${e.group}` : ''}
                    </small>
                  </span>
                  {e.completedAt ? (
                    <span className="list-score">
                      {s.correct}/{s.total}
                      <small>{percent(s.accuracy)}</small>
                    </span>
                  ) : (
                    <span className="badge warn">Unfinished</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="table-wrap">
          <table className="trainee-table">
            <thead>
              <tr>
                <th scope="col">Trainee</th>
                {DAY_KEYS.map((k) => (
                  <th key={k} scope="col">
                    {DAYS[k].label.replace(' E-Set', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trainees.map((t) => (
                <tr key={t.name}>
                  <th scope="row">
                    {t.name}
                    {t.group && <small className="muted">{t.group}</small>}
                  </th>
                  {DAY_KEYS.map((k) => {
                    const e = t.byDay[k];
                    if (!e) return <td key={k} className="none">—</td>;
                    const s = scoreEvaluation(e);
                    return (
                      <td key={k}>
                        <button type="button" className="cell-btn" onClick={() => open(e)}>
                          {e.completedAt ? percent(s.accuracy) : '…'}
                          <small>
                            {s.correct}/{s.total}
                          </small>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="export-bar">
          <span className="muted small">
            Export {filtersActive ? 'filtered' : 'all'} {filtered.length} {filtered.length === 1 ? 'sheet' : 'sheets'}
          </span>
          <div className="row">
            <button type="button" className="btn secondary" disabled={busy} onClick={() => runExport('xlsx')}>
              Excel
            </button>
            <button type="button" className="btn secondary" disabled={busy} onClick={() => runExport('csv')}>
              CSV
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
