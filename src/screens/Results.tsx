import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Sheet, TopBar, toast, useConfirm } from '../components/ui';
import { DAY_KEYS, DAYS, getDay } from '../data/days';
import { download, exportCsv, exportExcel } from '../lib/export';
import { cleanName, formatDate, nameMatches, normalizeName, percent, todayISO } from '../lib/format';
import { navigate } from '../lib/router';
import { readRosterFile, ROSTER_TEMPLATE, type RosterImport } from '../lib/roster';
import { scoreEvaluation } from '../lib/scoring';
import { addRosterEntries, clearRoster, evaluationsList, removeRosterEntry, useAppState } from '../lib/store';
import type { DayKey, Evaluation } from '../lib/types';

type View = 'trainees' | 'sheets';

interface TraineeRow {
  key: string;
  name: string;
  group: string;
  rosterId: string | null;
  byDay: Partial<Record<DayKey, Evaluation>>;
}

function openSheet(e: Evaluation) {
  navigate(e.completedAt ? { name: 'sheet', id: e.id } : { name: 'score', id: e.id });
}

export default function Results() {
  const evaluations = useAppState((s) => s.evaluations);
  const roster = useAppState((s) => s.roster);
  const drillGroup = useAppState((s) => s.drill?.group ?? '');
  const [view, setView] = useState<View>('trainees');
  const [query, setQuery] = useState('');
  const [day, setDay] = useState<DayKey | 'all'>('all');
  const [group, setGroup] = useState('all');
  const [panel, setPanel] = useState<'export' | 'roster' | null>(null);
  const [preview, setPreview] = useState<(RosterImport & { fileName: string }) | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const all = useMemo(() => evaluationsList(evaluations), [evaluations]);
  const groups = useMemo(
    () => Array.from(new Set([...all.map((e) => e.group), ...roster.map((r) => r.group)].filter(Boolean))).sort(),
    [all, roster],
  );
  const inGroup = useMemo(() => (g: string) => group === 'all' || (group === '' ? !g : g === group), [group]);

  const sheets = useMemo(
    () => all.filter((e) => (day === 'all' || e.day === day) && inGroup(e.group) && nameMatches(e.traineeName, query)),
    [all, day, inGroup, query],
  );

  const trainees = useMemo(() => {
    const map = new Map<string, TraineeRow>();
    const get = (name: string, g: string) => {
      const key = normalizeName(name);
      let row = map.get(key);
      if (!row) map.set(key, (row = { key, name, group: g, rosterId: null, byDay: {} }));
      if (!row.group && g) row.group = g;
      return row;
    };
    roster.forEach((r) => (get(r.name, r.group).rosterId = r.id));
    // Newest sheet per trainee per day; `all` is newest first.
    all.forEach((e) => (get(e.traineeName, e.group).byDay[e.day] ??= e));
    return Array.from(map.values())
      .filter((t) => inGroup(t.group) && nameMatches(t.name, query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [all, roster, inGroup, query]);

  const exportList = view === 'sheets' ? sheets : all.filter((e) => inGroup(e.group) && nameMatches(e.traineeName, query));
  const filtered = query.trim() !== '' || group !== 'all' || (view === 'sheets' && day !== 'all');

  async function runExport(kind: 'csv' | 'xlsx') {
    if (exportList.length === 0) return;
    const stamp = todayISO();
    try {
      setBusy(true);
      if (kind === 'csv') exportCsv(exportList, stamp);
      else await exportExcel(exportList, stamp);
      toast(`Exported ${exportList.length} ${exportList.length === 1 ? 'sheet' : 'sheets'}.`);
      setPanel(null);
    } catch {
      toast('Export failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const result = await readRosterFile(file);
      if (result.entries.length === 0) throw new Error('No names found in that file.');
      setPreview({ ...result, fileName: file.name });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function addName(e: FormEvent) {
    e.preventDefault();
    const name = cleanName(newName);
    if (name.split(' ').length < 2) {
      toast('Type first and last name.');
      return;
    }
    const added = addRosterEntries([{ name, group: drillGroup }], 'merge');
    toast(added ? `Added ${name}.` : `${name} is already on the roster.`);
    setNewName('');
  }

  async function clearAll() {
    setPanel(null);
    const ok = await confirm.ask({
      title: 'Clear the roster?',
      message: <p>All {roster.length} roster names are removed. Score sheets are kept.</p>,
      confirmLabel: 'Clear roster',
      danger: true,
    });
    if (ok) {
      clearRoster();
      toast('Roster cleared.');
    }
  }

  async function removeFromRoster(t: TraineeRow) {
    const ok = await confirm.ask({
      title: `Remove ${t.name}?`,
      message: <p>They are removed from the roster. Their score sheets are kept.</p>,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok && t.rosterId) removeRosterEntry(t.rosterId);
  }

  return (
    <main className="screen">
      <TopBar
        title="Results"
        subtitle={`${trainees.length} trainees · ${all.length} sheets`}
        right={
          <button type="button" className="link-btn" onClick={() => setPanel('export')} disabled={all.length === 0}>
            Export
          </button>
        }
      />

      <div className="filters">
        <input
          type="search"
          className="search"
          placeholder="Search name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search name"
        />
        <div className="row">
          <div className="segmented small grow" role="tablist" aria-label="View">
            <button type="button" role="tab" aria-selected={view === 'trainees'} onClick={() => setView('trainees')}>
              Trainees
            </button>
            <button type="button" role="tab" aria-selected={view === 'sheets'} onClick={() => setView('sheets')}>
              Sheets
            </button>
          </div>
          {groups.length > 0 && (
            <select className="group-select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group">
              <option value="all">All groups</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              <option value="">No group</option>
            </select>
          )}
        </div>
        {view === 'sheets' && (
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
        )}
      </div>

      {view === 'trainees' ? (
        trainees.length === 0 ? (
          <p className="empty">
            {roster.length + all.length === 0 ? 'No trainees yet. Import a roster or start evaluating.' : 'No one matches.'}
          </p>
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
                  <tr key={t.key}>
                    <th scope="row">
                      {t.rosterId && Object.keys(t.byDay).length === 0 ? (
                        <button type="button" className="name-btn" onClick={() => removeFromRoster(t)} aria-label={`${t.name}, on roster, tap to remove`}>
                          {t.name}
                        </button>
                      ) : (
                        t.name
                      )}
                      {t.group && <small className="muted">{t.group}</small>}
                    </th>
                    {DAY_KEYS.map((k) => {
                      const e = t.byDay[k];
                      if (!e) return <td key={k} className="none">—</td>;
                      const s = scoreEvaluation(e);
                      return (
                        <td key={k}>
                          <button type="button" className={`cell-btn ${e.completedAt ? '' : 'unfinished'}`} onClick={() => openSheet(e)}>
                            {e.completedAt ? percent(s.accuracy) : 'Unfinished'}
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
        )
      ) : sheets.length === 0 ? (
        <p className="empty">{all.length === 0 ? 'No sheets yet.' : 'No sheets match.'}</p>
      ) : (
        <ul className="list">
          {sheets.map((e) => {
            const s = scoreEvaluation(e);
            return (
              <li key={e.id}>
                <button type="button" className="list-row" onClick={() => openSheet(e)}>
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
      )}

      <button type="button" className="card roster-card" onClick={() => setPanel('roster')}>
        <span>
          <strong>Roster</strong>
          <span className="muted">
            {roster.length ? `${roster.length} names on this device` : 'Import a list of trainee names'}
          </span>
        </span>
        <span className="resume-go">{roster.length ? 'Manage' : 'Import'}</span>
      </button>

      <Sheet open={panel === 'export'} title="Export results" onClose={() => setPanel(null)}>
        <p className="sheet-body">
          {exportList.length} {exportList.length === 1 ? 'sheet' : 'sheets'}
          {filtered ? ' matching your filters' : ''}.
        </p>
        <div className="stack-sm">
          <button type="button" className="btn primary block" disabled={busy || !exportList.length} onClick={() => runExport('xlsx')}>
            Excel (.xlsx)
          </button>
          <button type="button" className="btn secondary block" disabled={busy || !exportList.length} onClick={() => runExport('csv')}>
            CSV
          </button>
        </div>
      </Sheet>

      <Sheet open={panel === 'roster'} title="Roster" onClose={() => setPanel(null)}>
        <p className="muted small">
          A .csv or .xlsx file with a <strong>Full Name</strong> column (or Last Name + First Name). A Group or Batch column is
          optional. Roster names show on the Evaluate tab.
        </p>
        <div className="row">
          <button type="button" className="btn primary grow" onClick={() => fileRef.current?.click()}>
            Import file
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => download('roster-template.csv', ROSTER_TEMPLATE, 'text/csv;charset=utf-8')}
          >
            Template
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <form className="row" onSubmit={addName} noValidate>
          <input
            className="search grow"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add one name"
            aria-label="Add one name"
            autoCapitalize="words"
          />
          <button type="submit" className="btn secondary">
            Add
          </button>
        </form>
        {roster.length > 0 && (
          <button type="button" className="link-btn danger" onClick={clearAll}>
            Clear roster ({roster.length})
          </button>
        )}
      </Sheet>

      <Sheet open={!!preview} title={`Import ${preview?.fileName ?? ''}`} onClose={() => setPreview(null)}>
        {preview && (
          <>
            <div className="sheet-body">
              <p>
                Found <strong>{preview.entries.length}</strong> names
                {preview.skipped > 0 ? `, skipped ${preview.skipped} rows without a name` : ''}.
              </p>
              <ul className="preview-list">
                {preview.entries.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    {e.name}
                    {e.group && <span className="muted"> · {e.group}</span>}
                  </li>
                ))}
                {preview.entries.length > 5 && <li className="muted">and {preview.entries.length - 5} more</li>}
              </ul>
            </div>
            <div className="sheet-actions">
              {roster.length > 0 && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    const n = addRosterEntries(preview.entries, 'replace');
                    setPreview(null);
                    setPanel(null);
                    toast(`Roster replaced: ${n} names.`);
                  }}
                >
                  Replace roster
                </button>
              )}
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  const n = addRosterEntries(preview.entries, 'merge');
                  setPreview(null);
                  setPanel(null);
                  toast(`${n} ${n === 1 ? 'name' : 'names'} added.`);
                }}
              >
                {roster.length > 0 ? 'Add to roster' : 'Import'}
              </button>
            </div>
          </>
        )}
      </Sheet>
      {confirm.element}
    </main>
  );
}
