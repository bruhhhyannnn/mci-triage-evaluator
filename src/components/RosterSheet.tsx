import { useRef, useState, type FormEvent } from 'react';
import { download } from '../lib/export';
import { cleanName } from '../lib/format';
import { haptic } from '../lib/haptics';
import { readRosterFile, ROSTER_TEMPLATE, type RosterImport } from '../lib/roster';
import { addRosterEntries, clearRoster, useAppState } from '../lib/store';
import { Icon } from './Icon';
import { Sheet, toast, useConfirm } from './ui';

/**
 * Import trainee names (.csv / .xlsx), add one name, or clear the roster.
 * Imported names appear on the Evaluate tab to tap and start.
 */
export function RosterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const roster = useAppState((s) => s.roster);
  const drillGroup = useAppState((s) => s.drill?.group ?? '');
  const [preview, setPreview] = useState<(RosterImport & { fileName: string }) | null>(null);
  const [name, setName] = useState('');
  const [group, setGroup] = useState(drillGroup);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const result = await readRosterFile(file);
      if (result.entries.length === 0) throw new Error('No names found in that file.');
      setPreview({ ...result, fileName: file.name });
    } catch (e) {
      haptic('warning');
      toast(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function importNames(mode: 'merge' | 'replace') {
    if (!preview) return;
    const n = addRosterEntries(preview.entries, mode);
    haptic('success');
    toast(mode === 'replace' ? `Roster replaced with ${n} names.` : `${n} ${n === 1 ? 'name' : 'names'} added.`);
    setPreview(null);
    onClose();
  }

  function addOne(e: FormEvent) {
    e.preventDefault();
    const clean = cleanName(name);
    if (clean.split(' ').length < 2) {
      haptic('warning');
      toast('Type the first and last name.');
      return;
    }
    const added = addRosterEntries([{ name: clean, group }], 'merge');
    haptic('tap');
    toast(added ? `Added ${clean}.` : `${clean} is already on the roster.`);
    setName('');
  }

  async function clearAll() {
    onClose();
    const ok = await confirm.ask({
      title: 'Clear the roster?',
      message: <p>All {roster.length} names are removed from this device. Score sheets are kept.</p>,
      confirmLabel: 'Clear roster',
      danger: true,
    });
    if (ok) {
      clearRoster();
      toast('Roster cleared.');
    }
  }

  return (
    <>
      <Sheet open={open && !preview} title="Trainee names" eyebrow={`Roster · ${roster.length} on this device`} onClose={onClose}>
        <p className="sheet-body muted">
          Import a .csv or .xlsx file with a <strong>Full Name</strong> column (or Last Name and First Name). A Group or Batch
          column is optional. The names show on the Evaluate tab, ready to tap.
        </p>
        <div className="row">
          <button type="button" className="btn primary grow" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} />
            Import file
          </button>
          <button
            type="button"
            className="btn outline"
            onClick={() => download('roster-template.csv', ROSTER_TEMPLATE, 'text/csv;charset=utf-8')}
          >
            <Icon name="download" size={18} />
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
        <form className="stack-sm" onSubmit={addOne} noValidate>
          <span className="label">Or add one name</span>
          <div className="row">
            <input
              className="input grow"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              aria-label="Full name"
              autoCapitalize="words"
            />
            <input className="input group-input" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Group" aria-label="Group" />
          </div>
          <button type="submit" className="btn outline block">
            <Icon name="plus" size={18} />
            Add name
          </button>
        </form>
        {roster.length > 0 && (
          <button type="button" className="btn ghost danger-text" onClick={clearAll}>
            Clear roster
          </button>
        )}
      </Sheet>

      <Sheet open={!!preview} title={`Found ${preview?.entries.length ?? 0} names`} eyebrow={preview?.fileName} onClose={() => setPreview(null)}>
        {preview && (
          <>
            <div className="sheet-body">
              {preview.skipped > 0 && <p className="muted">Skipped {preview.skipped} rows without a name.</p>}
              <ul className="preview-list">
                {preview.entries.slice(0, 6).map((e, i) => (
                  <li key={i}>
                    <span>{e.name}</span>
                    {e.group && <span className="muted"> · {e.group}</span>}
                  </li>
                ))}
                {preview.entries.length > 6 && <li className="muted">and {preview.entries.length - 6} more</li>}
              </ul>
            </div>
            <div className="sheet-actions">
              {roster.length > 0 && (
                <button type="button" className="btn outline" onClick={() => importNames('replace')}>
                  Replace roster
                </button>
              )}
              <button type="button" className="btn primary" onClick={() => importNames('merge')}>
                {roster.length > 0 ? 'Add to roster' : 'Import names'}
              </button>
            </div>
          </>
        )}
      </Sheet>
      {confirm.element}
    </>
  );
}
