import { useEffect, useState, type FormEvent } from 'react';
import { cleanName } from '../lib/format';
import { haptic, hapticsSupported } from '../lib/haptics';
import { defaultDrill, saveDrill, updateSettings, useAppState, type Appearance } from '../lib/store';
import { Icon } from './Icon';
import { SegmentedControl, Sheet } from './ui';

/** Evaluator details plus app settings (appearance, vibration). First launch asks for the evaluator's name. */
export function SettingsSheet({ open, onClose, firstRun }: { open: boolean; onClose: () => void; firstRun: boolean }) {
  const drill = useAppState((s) => s.drill) ?? defaultDrill();
  const settings = useAppState((s) => s.settings);
  const [name, setName] = useState(drill.evaluatorName);
  const [group, setGroup] = useState(drill.group);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(drill.evaluatorName);
      setGroup(drill.group);
      setError('');
    }
    // Reset the form each time the sheet opens (not on every store change while it is open).
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!cleanName(name)) {
      haptic('warning');
      setError('Enter your name.');
      return;
    }
    saveDrill({ ...drill, evaluatorName: name, group });
    haptic('tap');
    onClose();
  }

  return (
    <Sheet
      open={open}
      title={firstRun ? 'Who is evaluating?' : 'Settings'}
      eyebrow={firstRun ? 'MCI Triage Evaluator' : undefined}
      onClose={() => !firstRun && onClose()}
    >
      <form className="stack" onSubmit={submit} noValidate>
        <label className="field">
          <span className="label">Your name (evaluator)</span>
          <input
            className="input"
            autoComplete="name"
            autoCapitalize="words"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="Full name"
            aria-invalid={!!error}
          />
          {error && <span className="field-error">{error}</span>}
        </label>
        <label className="field">
          <span className="label">
            Group or batch <span className="muted">· optional</span>
          </span>
          <input className="input" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Batch 3" />
        </label>

        {!firstRun && (
          <>
            <div className="field">
              <span className="label">Appearance</span>
              <SegmentedControl<Appearance>
                label="Appearance"
                role="radiogroup"
                value={settings.appearance}
                onChange={(appearance) => updateSettings({ appearance })}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'Match phone' },
                ]}
              />
            </div>
            <label className="switch-row">
              <span className="switch-text">
                <Icon name="vibrate" size={20} />
                <span>
                  <strong>Vibrate on tap</strong>
                  <span className="muted">{hapticsSupported() ? 'Short buzz when you tag, start and finish.' : 'Not supported on this device.'}</span>
                </span>
              </span>
              <input
                type="checkbox"
                className="switch"
                checked={settings.haptics}
                onChange={(e) => {
                  updateSettings({ haptics: e.target.checked });
                  if (e.target.checked) haptic('success');
                }}
              />
            </label>
          </>
        )}

        <div className="sheet-actions">
          {!firstRun && (
            <button type="button" className="btn outline" onClick={onClose}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn primary">
            {firstRun ? 'Start' : 'Save'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
