import { useMemo, useState, type FormEvent } from 'react';
import { Sheet, TopBar } from '../components/ui';
import { getDay } from '../data/days';
import { cleanName, formatDate, nameMatches, normalizeName } from '../lib/format';
import { navigate, replace } from '../lib/router';
import { nextUnfinishedMethod, scoreEvaluation } from '../lib/scoring';
import { createEvaluation, evaluationsList, useAppState } from '../lib/store';
import type { Evaluation } from '../lib/types';

interface Candidate {
  key: string;
  name: string;
  group: string;
  inRoster: boolean;
  /** This trainee's sheets for the drill's day, newest first. */
  sameDay: Evaluation[];
  otherDays: Evaluation[];
}

export default function Trainee() {
  const drill = useAppState((s) => s.drill)!;
  const roster = useAppState((s) => s.roster);
  const evaluations = useAppState((s) => s.evaluations);
  const day = getDay(drill.day);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [existing, setExisting] = useState<Candidate | null>(null);

  const candidates = useMemo(() => {
    const map = new Map<string, Candidate>();
    const get = (name: string, group: string) => {
      const key = normalizeName(name);
      let c = map.get(key);
      if (!c) {
        c = { key, name, group, inRoster: false, sameDay: [], otherDays: [] };
        map.set(key, c);
      }
      if (!c.group && group) c.group = group;
      return c;
    };
    roster.forEach((r) => (get(r.name, r.group).inRoster = true));
    evaluationsList(evaluations).forEach((e) => {
      const c = get(e.traineeName, e.group);
      (e.day === drill.day ? c.sameDay : c.otherDays).push(e);
    });
    return Array.from(map.values());
  }, [roster, evaluations, drill.day]);

  const trimmed = cleanName(query);
  const matches = useMemo(() => {
    const list = trimmed ? candidates.filter((c) => nameMatches(c.name, trimmed)) : candidates;
    // Same group as the drill first, then people not yet scored today, then A–Z.
    return [...list]
      .sort((a, b) => {
        const g = Number(!!drill.group && b.group === drill.group) - Number(!!drill.group && a.group === drill.group);
        if (g) return g;
        const done = Number(a.sameDay.length > 0) - Number(b.sameDay.length > 0);
        if (done) return done;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 30);
  }, [candidates, trimmed, drill.group]);
  const exact = matches.find((c) => c.key === normalizeName(trimmed));

  function begin(name: string) {
    const evaluation = createEvaluation(name, drill);
    // Back from the first method returns to Home, not to this name screen.
    replace({ name: 'run', id: evaluation.id, method: day.methods[0] });
  }

  function startNew() {
    if (trimmed.split(' ').length < 2) setError('Enter the full name (first and last) for a new trainee.');
    else begin(trimmed);
  }

  function choose(c: Candidate) {
    if (c.sameDay.length > 0) setExisting(c);
    else begin(c.name);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) {
      setError("Type the trainee's last name or full name.");
      return;
    }
    if (exact) choose(exact);
    else if (matches.length > 0 && trimmed.split(' ').length < 2) setError('Tap a name below, or type the full name for a new trainee.');
    else startNew();
  }

  return (
    <main className="screen">
      <TopBar title="Who are you evaluating?" subtitle={`${day.label} · ${day.methods.join(' → ')}`} onBack={() => history.back()} />
      <form className="stack" onSubmit={submit} noValidate>
        <label className="field">
          <span>Last name or full name</span>
          <input
            type="search"
            enterKeyHint="go"
            autoFocus
            autoComplete="off"
            autoCapitalize="words"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError('');
            }}
            placeholder="e.g. Dela Cruz"
            aria-invalid={!!error}
            aria-describedby="trainee-hint"
          />
          <span id="trainee-hint" className={error ? 'field-error' : 'field-hint'}>
            {error ||
              (candidates.length
                ? 'Tap a name below, or type the full name of a new trainee.'
                : 'Type the full name. Names you save are suggested next time.')}
          </span>
        </label>

        <ul className="list candidate-list" aria-label="Matching trainees">
          {matches.map((c) => {
            const latest = c.sameDay[0];
            return (
              <li key={c.key}>
                <button type="button" className="list-row" onClick={() => choose(c)}>
                  <span className="list-main">
                    {c.name}
                    <small className="muted">
                      {[c.group, c.otherDays.length ? c.otherDays.map((e) => getDay(e.day).label).join(', ') + ' done' : '']
                        .filter(Boolean)
                        .join(' · ') || (c.inRoster ? 'From roster' : '')}
                    </small>
                  </span>
                  {latest && (
                    <span className={`badge ${latest.completedAt ? 'done' : 'warn'}`}>
                      {latest.completedAt ? `${day.label} done` : 'Unfinished'}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {trimmed && !exact && (
            <li>
              <button type="button" className="list-row new-row" onClick={startNew}>
                <span className="list-main">
                  <span className="plus" aria-hidden="true">+</span> New trainee: <strong>{trimmed}</strong>
                </span>
              </button>
            </li>
          )}
          {!trimmed && matches.length === 0 && <li className="empty">No saved trainees yet. Type a full name to start.</li>}
        </ul>

        <div className="actions-bar">
          <button type="submit" className="btn primary block large" disabled={!trimmed}>
            Start {day.methods[0]}
          </button>
        </div>
      </form>

      <Sheet open={!!existing} title={`${existing?.name ?? ''} already has a ${day.label} sheet`} onClose={() => setExisting(null)}>
        <ul className="list">
          {existing?.sameDay.map((e) => {
            const s = scoreEvaluation(e);
            const next = nextUnfinishedMethod(e);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className="list-row"
                  onClick={() =>
                    !e.completedAt && next
                      ? navigate({ name: 'run', id: e.id, method: next })
                      : navigate({ name: 'summary', id: e.id })
                  }
                >
                  <span className="list-main">
                    {e.completedAt ? 'Open saved sheet' : `Resume (${next ?? 'ready to save'})`}
                    <small className="muted">
                      {formatDate(e.date)} · {s.correct}/{s.total}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="sheet-actions">
          <button type="button" className="btn secondary" onClick={() => setExisting(null)}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={() => existing && begin(existing.name)}>
            Evaluate again
          </button>
        </div>
      </Sheet>
    </main>
  );
}
