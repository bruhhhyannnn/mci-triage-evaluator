import { useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { RosterSheet } from '../components/RosterSheet';
import { EmptyState, SearchField, SegmentedControl, Sheet, StatusChip, toast, useConfirm } from '../components/ui';
import { DAY_KEYS, DAYS, getDay } from '../data/days';
import { download, exportCsv, exportExcel } from '../lib/export';
import { formatDate, nameMatches, normalizeName, percent, todayISO } from '../lib/format';
import { haptic } from '../lib/haptics';
import { navigate } from '../lib/router';
import { scoreEvaluation } from '../lib/scoring';
import { evaluationsList, makeBackup, removeRosterEntry, restoreBackup, updateSettings, useAppState } from '../lib/store';
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
  const lastBackupAt = useAppState((s) => s.settings.lastBackupAt);
  const [view, setView] = useState<View>('trainees');
  const [query, setQuery] = useState('');
  const [day, setDay] = useState<DayKey | 'all'>('all');
  const [group, setGroup] = useState('all');
  const [panel, setPanel] = useState<'export' | 'roster' | null>(null);
  const [busy, setBusy] = useState(false);
  const backupRef = useRef<HTMLInputElement>(null);
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
    try {
      setBusy(true);
      if (kind === 'csv') exportCsv(exportList, todayISO());
      else await exportExcel(exportList, todayISO());
      haptic('success');
      toast(`Exported ${exportList.length} ${exportList.length === 1 ? 'sheet' : 'sheets'}.`);
      setPanel(null);
    } catch {
      haptic('warning');
      toast('Export failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  // Remind about a backup when sheets changed since the last one (or there has never been one).
  const changedSinceBackup = all.filter((e) => !lastBackupAt || e.updatedAt > lastBackupAt).length;

  function saveBackup() {
    download(`mci-triage-backup-${todayISO()}.json`, JSON.stringify(makeBackup()), 'application/json');
    updateSettings({ lastBackupAt: new Date().toISOString() });
    haptic('success');
    toast('Backup file saved.');
    setPanel(null);
  }

  async function onBackupFile(file: File | undefined) {
    if (!file) return;
    try {
      const result = restoreBackup(JSON.parse(await file.text()));
      haptic('success');
      toast(`Restored ${result.sheets} sheets and ${result.names} names.`);
      setPanel(null);
    } catch (e) {
      haptic('warning');
      toast(e instanceof Error && e.message.includes('backup') ? e.message : 'Could not read that backup file.');
    } finally {
      if (backupRef.current) backupRef.current.value = '';
    }
  }

  async function removeFromRoster(t: TraineeRow) {
    const ok = await confirm.ask({
      title: `Remove ${t.name}?`,
      message: <p>They are taken off the roster. Their score sheets are kept.</p>,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok && t.rosterId) removeRosterEntry(t.rosterId);
  }

  return (
    <main className="screen">
      <header className="home-header">
        <div>
          <div className="eyebrow">MCI triage drill</div>
          <h1 className="title">Results</h1>
          <p className="meta-line">
            {trainees.length} trainees · {all.length} sheets
          </p>
        </div>
        <button type="button" className="btn outline sm" onClick={() => setPanel('export')}>
          <Icon name="download" size={16} />
          Export
        </button>
      </header>

      {changedSinceBackup > 0 && (
        <button type="button" className="row-card pending" onClick={() => setPanel('export')}>
          <span className="row-plus warn" aria-hidden="true">
            <Icon name="alert-triangle" size={18} />
          </span>
          <span className="row-main">
            <span className="row-title">Back up your results</span>
            <span className="row-sub">
              {lastBackupAt
                ? `${changedSinceBackup} ${changedSinceBackup === 1 ? 'sheet' : 'sheets'} changed since ${formatDate(lastBackupAt.slice(0, 10))}`
                : `${changedSinceBackup} ${changedSinceBackup === 1 ? 'sheet is' : 'sheets are'} only on this phone`}
            </span>
          </span>
          <span className="row-go" aria-hidden="true">
            <Icon name="chevron-right" size={20} />
          </span>
        </button>
      )}

      <div className="stack-sm">
        <SearchField value={query} onChange={setQuery} placeholder="Search name" label="Search name" />
        <div className="row">
          <SegmentedControl<View>
            label="View"
            className="grow"
            value={view}
            onChange={setView}
            options={[
              { value: 'trainees', label: 'Trainees' },
              { value: 'sheets', label: 'Sheets' },
            ]}
          />
          {groups.length > 0 && (
            <select className="select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group">
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
            {(['all', ...DAY_KEYS] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`chip ${day === k ? 'on' : ''}`}
                aria-pressed={day === k}
                onClick={() => {
                  haptic('select');
                  setDay(k);
                }}
              >
                {k === 'all' ? 'All days' : DAYS[k].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'trainees' ? (
        trainees.length === 0 ? (
          roster.length + all.length === 0 ? (
            <EmptyState
              icon="users"
              title="No trainees yet"
              body="Import the list of names, or start evaluating from the Evaluate tab."
              action={
                <button type="button" className="btn primary" onClick={() => setPanel('roster')}>
                  <Icon name="upload" size={18} />
                  Import names
                </button>
              }
            />
          ) : (
            <EmptyState title="No one matches" body="Try another name or group." />
          )
        ) : (
          <div className="card table-card">
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
                        <button type="button" className="name-btn" onClick={() => removeFromRoster(t)} title="Tap to remove from roster">
                          {t.name}
                        </button>
                      ) : (
                        <span>{t.name}</span>
                      )}
                      {t.group && <small>{t.group}</small>}
                    </th>
                    {DAY_KEYS.map((k) => {
                      const e = t.byDay[k];
                      if (!e) return <td key={k} className="none">—</td>;
                      const s = scoreEvaluation(e);
                      return (
                        <td key={k}>
                          <button type="button" className={`cell-btn ${e.completedAt ? '' : 'unfinished'}`} onClick={() => openSheet(e)}>
                            <span>{e.completedAt ? percent(s.accuracy) : 'Unfinished'}</span>
                            <small className="mono">
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
        <EmptyState icon="clipboard-check" title={all.length === 0 ? 'No sheets yet' : 'No sheets match'} body={all.length === 0 ? 'Sheets you score show up here.' : 'Try another day, name or group.'} />
      ) : (
        <div className="stack-sm">
          {sheets.map((e) => {
            const s = scoreEvaluation(e);
            return (
              <button key={e.id} type="button" className="row-card" onClick={() => openSheet(e)}>
                <span className="row-main">
                  <span className="row-title">{e.traineeName}</span>
                  <span className="row-sub">
                    {getDay(e.day).label} · {formatDate(e.date)}
                    {e.group ? ` · ${e.group}` : ''}
                  </span>
                </span>
                {e.completedAt ? (
                  <span className="row-score">
                    <span className="mono">
                      {s.correct}/{s.total}
                    </span>
                    <small>{percent(s.accuracy)}</small>
                  </span>
                ) : (
                  <StatusChip status="pending">Unfinished</StatusChip>
                )}
              </button>
            );
          })}
        </div>
      )}

      <button type="button" className="row-card" onClick={() => setPanel('roster')}>
        <span className="row-plus" aria-hidden="true">
          <Icon name="users" size={18} />
        </span>
        <span className="row-main">
          <span className="row-title">Trainee names</span>
          <span className="row-sub">{roster.length ? `${roster.length} names on this device` : 'Import a list of names'}</span>
        </span>
        <span className="row-go" aria-hidden="true">
          <Icon name="chevron-right" size={20} />
        </span>
      </button>

      <Sheet open={panel === 'export'} title="Export and backup" onClose={() => setPanel(null)}>
        <p className="sheet-body muted">
          {exportList.length} {exportList.length === 1 ? 'sheet' : 'sheets'}
          {filtered ? ' match your filters' : ' on this device'}.
        </p>
        <div className="stack-sm">
          <button type="button" className="btn primary block" disabled={busy || !exportList.length} onClick={() => runExport('xlsx')}>
            <Icon name="file-spreadsheet" size={18} />
            Excel (.xlsx)
          </button>
          <button type="button" className="btn outline block" disabled={busy || !exportList.length} onClick={() => runExport('csv')}>
            CSV
          </button>
        </div>
        <div className="divider" />
        <p className="sheet-body muted small">
          Scores are saved on this phone only. A backup file keeps a copy and moves everything (sheets and names) to another
          device. Last backup: {lastBackupAt ? formatDate(lastBackupAt.slice(0, 10)) : 'never'}.
        </p>
        <div className="row">
          <button type="button" className="btn outline grow" onClick={saveBackup} disabled={all.length + roster.length === 0}>
            <Icon name="download" size={18} />
            Save backup
          </button>
          <button type="button" className="btn outline grow" onClick={() => backupRef.current?.click()}>
            <Icon name="upload" size={18} />
            Restore
          </button>
        </div>
        <input ref={backupRef} type="file" accept=".json,application/json" hidden onChange={(e) => onBackupFile(e.target.files?.[0])} />
      </Sheet>

      <RosterSheet open={panel === 'roster'} onClose={() => setPanel(null)} />
      {confirm.element}
    </main>
  );
}
