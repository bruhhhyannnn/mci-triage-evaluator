import { useMemo, useState, type FormEvent } from 'react';
import { TopBar } from '../components/ui';
import { DAY_KEYS, DAYS } from '../data/days';
import { navigate } from '../lib/router';
import { defaultDrill, saveDrill, useAppState } from '../lib/store';
import type { Drill } from '../lib/types';

export default function Setup({ firstRun }: { firstRun: boolean }) {
  const drill = useAppState((s) => s.drill);
  const roster = useAppState((s) => s.roster);
  const evaluations = useAppState((s) => s.evaluations);
  const [form, setForm] = useState<Drill>(() => drill ?? defaultDrill());
  const [error, setError] = useState('');

  const groupOptions = useMemo(() => {
    const groups = new Set<string>();
    roster.forEach((r) => r.group && groups.add(r.group));
    Object.values(evaluations).forEach((e) => e.group && groups.add(e.group));
    return Array.from(groups).sort();
  }, [roster, evaluations]);

  const evaluatorOptions = useMemo(
    () => Array.from(new Set(Object.values(evaluations).map((e) => e.evaluatorName).filter(Boolean))).sort(),
    [evaluations],
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.evaluatorName.trim()) {
      setError('Enter your name as the evaluator.');
      return;
    }
    saveDrill(form);
    navigate({ name: 'home' });
  }

  return (
    <main className="screen">
      <TopBar
        title={firstRun ? 'Set up the drill' : 'Drill details'}
        subtitle={firstRun ? 'You only do this once per drill.' : 'Used for every trainee you evaluate next.'}
        onBack={firstRun ? undefined : () => history.back()}
      />
      <form className="stack" onSubmit={submit} noValidate>
        <fieldset className="field">
          <legend>Which day?</legend>
          <div className="day-cards">
            {DAY_KEYS.map((key) => {
              const day = DAYS[key];
              const selected = form.day === key;
              return (
                <label key={key} className={`day-card ${selected ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="day"
                    value={key}
                    checked={selected}
                    onChange={() => setForm({ ...form, day: key })}
                  />
                  <span className="day-card-label">{day.label}</span>
                  <span className="day-card-count">
                    {day.victims.length} victims · {day.victims.length * day.methods.length} pts
                  </span>
                  <span className="day-card-set">{day.setTitle}</span>
                  <span className="day-card-methods">{day.methods.join(' → ')}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="field">
          <span>Evaluator name</span>
          <input
            type="text"
            autoComplete="name"
            list="evaluator-options"
            value={form.evaluatorName}
            onChange={(e) => {
              setForm({ ...form, evaluatorName: e.target.value });
              setError('');
            }}
            aria-invalid={!!error}
            placeholder="Your full name"
          />
          <datalist id="evaluator-options">
            {evaluatorOptions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          {error && <span className="field-error">{error}</span>}
        </label>

        <div className="field-row">
          <label className="field">
            <span>Date</span>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label className="field">
            <span>
              Group or batch <em>optional</em>
            </span>
            <input
              type="text"
              list="group-options"
              value={form.group}
              onChange={(e) => setForm({ ...form, group: e.target.value })}
              placeholder="e.g. Batch 3"
            />
            <datalist id="group-options">
              {groupOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </label>
        </div>

        <div className="actions-bar">
          <button type="submit" className="btn primary block large">
            {firstRun ? 'Start drill' : 'Save drill details'}
          </button>
        </div>
      </form>
    </main>
  );
}
