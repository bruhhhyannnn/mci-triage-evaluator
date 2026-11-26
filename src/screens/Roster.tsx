import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Sheet, TopBar, toast, useConfirm } from '../components/ui';
import { download } from '../lib/export';
import { cleanName, nameMatches } from '../lib/format';
import { readRosterFile, ROSTER_TEMPLATE, type RosterImport } from '../lib/roster';
import { addRosterEntries, clearRoster, removeRosterEntry, useAppState } from '../lib/store';

export default function Roster() {
  const roster = useAppState((s) => s.roster);
  const drillGroup = useAppState((s) => s.drill?.group ?? '');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<(RosterImport & { fileName: string }) | null>(null);
  const [name, setName] = useState('');
  const [group, setGroup] = useState(drillGroup);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const shown = useMemo(
    () => roster.filter((r) => nameMatches(r.name, query)).sort((a, b) => a.name.localeCompare(b.name)),
    [roster, query],
  );

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

  function importPreview(mode: 'merge' | 'replace') {
    if (!preview) return;
    const added = addRosterEntries(preview.entries, mode);
    setPreview(null);
    toast(`${added} ${added === 1 ? 'name' : 'names'} added to the roster.`);
  }

  function addOne(e: FormEvent) {
    e.preventDefault();
    const clean = cleanName(name);
    if (clean.split(' ').length < 2) {
      setError('Enter first and last name.');
      return;
    }
    const added = addRosterEntries([{ name: clean, group }], 'merge');
    toast(added ? `Added ${clean}.` : `${clean} is already on the roster.`);
    setName('');
    setError('');
  }

  async function clearAll() {
    const ok = await confirm.ask({
      title: 'Clear the roster?',
      message: <p>All {roster.length} names will be removed from this device. Saved score sheets are kept.</p>,
      confirmLabel: 'Clear roster',
      danger: true,
    });
    if (ok) {
      clearRoster();
      toast('Roster cleared.');
    }
  }

  return (
    <main className="screen">
      <TopBar title="Roster" subtitle="Names to pick from when evaluating" />

      <section className="card stack-sm">
        <h2 className="card-title">Import a list</h2>
        <p className="muted small">
          A .csv or .xlsx file with a <strong>Full Name</strong> column (or Last Name + First Name). A Group or Batch column is
          optional.
        </p>
        <div className="row">
          <button type="button" className="btn primary grow" onClick={() => fileRef.current?.click()}>
            Choose file
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
      </section>

      <form className="card stack-sm" onSubmit={addOne} noValidate>
        <h2 className="card-title">Add one name</h2>
        <div className="field-row">
          <label className="field">
            <span>Full name</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              autoCapitalize="words"
              placeholder="Juan Dela Cruz"
              aria-invalid={!!error}
            />
            {error && <span className="field-error">{error}</span>}
          </label>
          <label className="field">
            <span>Group</span>
            <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="optional" />
          </label>
        </div>
        <button type="submit" className="btn secondary block">
          Add to roster
        </button>
      </form>

      <section className="stack-sm">
        <div className="section-head">
          <h2 className="section-title">On this device ({roster.length})</h2>
          {roster.length > 0 && (
            <button type="button" className="link-btn danger" onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
        {roster.length > 8 && (
          <input
            type="search"
            className="search"
            placeholder="Search roster"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search roster"
          />
        )}
        {roster.length === 0 ? (
          <p className="empty">No roster yet. You can still type names when you evaluate.</p>
        ) : (
          <ul className="list">
            {shown.slice(0, 200).map((r) => (
              <li key={r.id} className="list-row static">
                <span className="list-main">
                  {r.name}
                  {r.group && <small className="muted">{r.group}</small>}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${r.name}`}
                  onClick={() => {
                    removeRosterEntry(r.id);
                    toast(`Removed ${r.name}.`);
                  }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
                <button type="button" className="btn secondary" onClick={() => importPreview('replace')}>
                  Replace roster
                </button>
              )}
              <button type="button" className="btn primary" onClick={() => importPreview('merge')}>
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
