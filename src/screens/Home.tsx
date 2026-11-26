import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Sheet } from '../components/ui';
import { DAY_KEYS, DAYS, getDay } from '../data/days';
import { cleanName, formatDate, nameMatches, normalizeName, percent } from '../lib/format';
import { navigate } from '../lib/router';
import { nextUnfinishedMethod, scoreEvaluation } from '../lib/scoring';
import { createEvaluation, defaultDrill, evaluationsList, saveDrill, setDrillDay, useAppState } from '../lib/store';
import type { Drill, Evaluation } from '../lib/types';

interface Candidate {
  key: string;
  name: string;
  group: string;
  /** This trainee's sheets for the selected day, newest first. */
  sameDay: Evaluation[];
}

function DrillForm({ initial, onSave, onCancel }: { initial: Drill; onSave: () => void; onCancel?: () => void }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!cleanName(form.evaluatorName)) {
      setError('Enter your name.');
      return;
    }
    saveDrill(form);
    onSave();
  }
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <label className="field">
        <span>Your name (evaluator)</span>
        <input
          autoComplete="name"
          autoCapitalize="words"
          value={form.evaluatorName}
          onChange={(e) => {
            setForm({ ...form, evaluatorName: e.target.value });
            setError('');
          }}
          placeholder="Full name"
          aria-invalid={!!error}
        />
        {error && <span className="field-error">{error}</span>}
      </label>
      <label className="field">
        <span>
          Group or batch <em>optional</em>
        </span>
        <input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="e.g. Batch 3" />
      </label>
      <div className="sheet-actions">
        {onCancel && (
          <button type="button" className="btn secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn primary">
          Save
        </button>
      </div>
    </form>
  );
}

export default function Home() {
  const drill = useAppState((s) => s.drill) ?? defaultDrill();
  const hasEvaluator = useAppState((s) => !!s.drill?.evaluatorName);
  const roster = useAppState((s) => s.roster);
  const evaluations = useAppState((s) => s.evaluations);
  const day = getDay(drill.day);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [editDrill, setEditDrill] = useState(!hasEvaluator);
  const [existing, setExisting] = useState<Candidate | null>(null);

  useEffect(() => {
    if (!hasEvaluator) setEditDrill(true);
  }, [hasEvaluator]);

  const all = useMemo(() => evaluationsList(evaluations), [evaluations]);
  const unfinished = useMemo(() => all.filter((e) => !e.completedAt), [all]);

  const candidates = useMemo(() => {
    const map = new Map<string, Candidate>();
    const get = (name: string, group: string) => {
      const key = normalizeName(name);
      let c = map.get(key);
      if (!c) map.set(key, (c = { key, name, group, sameDay: [] }));
      if (!c.group && group) c.group = group;
      return c;
    };
    roster.forEach((r) => get(r.name, r.group));
    all.forEach((e) => {
      const c = get(e.traineeName, e.group);
      if (e.day === drill.day) c.sameDay.push(e);
    });
    return Array.from(map.values());
  }, [roster, all, drill.day]);

  const trimmed = cleanName(query);
  const matches = useMemo(() => {
    const list = trimmed ? candidates.filter((c) => nameMatches(c.name, trimmed)) : candidates;
    // Not yet evaluated today's day first, then the drill's group, then A–Z.
    return [...list].sort(
      (a, b) =>
        Number(a.sameDay.length > 0) - Number(b.sameDay.length > 0) ||
        Number(!!drill.group && b.group === drill.group) - Number(!!drill.group && a.group === drill.group) ||
        a.name.localeCompare(b.name),
    );
  }, [candidates, trimmed, drill.group]);
  const exact = matches.find((c) => c.key === normalizeName(trimmed));
  const notYet = candidates.filter((c) => c.sameDay.length === 0).length;

  function begin(name: string, group = '') {
    const e = createEvaluation(name, drill, group);
    setQuery('');
    navigate({ name: 'score', id: e.id });
  }

  function choose(c: Candidate) {
    if (c.sameDay.length > 0) setExisting(c);
    else begin(c.name, c.group);
  }

  function startNew() {
    if (trimmed.split(' ').length < 2) setError('Type the full name (first and last) to add a new trainee.');
    else begin(trimmed);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    if (exact) choose(exact);
    else if (matches.length === 1 && trimmed.split(' ').length < 2) choose(matches[0]);
    else startNew();
  }

  function switchDay(key: Drill['day']) {
    if (key !== drill.day) setDrillDay(key);
  }

  return (
    <main className="screen home">
      <header className="home-header">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="24" height="24">
            <rect x="12" y="4" width="8" height="24" rx="2" fill="currentColor" />
            <rect x="4" y="12" width="24" height="8" rx="2" fill="currentColor" />
          </svg>
        </div>
        <div className="home-title">
          <h1>MCI Triage Evaluator</h1>
          <button type="button" className="evaluator-line" onClick={() => setEditDrill(true)}>
            {drill.evaluatorName || 'Set evaluator'}
            {drill.group && <span> · {drill.group}</span>}
            <span className="edit-hint">Edit</span>
          </button>
        </div>
      </header>

      <section className="day-switch" aria-label="Day">
        <div className="segmented day-tabs" role="radiogroup" aria-label="Day">
          {DAY_KEYS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={drill.day === k} onClick={() => switchDay(k)}>
              {DAYS[k].label}
            </button>
          ))}
        </div>
        <p className="day-flow">
          {day.methods.map((m, i) => (
            <span key={m}>
              {i > 0 && <span className="arrow"> → </span>}
              <strong>{m}</strong>
            </span>
          ))}
          <span className="muted nowrap">
            {' '}
            · {day.victims.length} victims · {day.victims.length * day.methods.length} pts
          </span>
        </p>
      </section>

      <form className="name-search" onSubmit={submit} noValidate role="search">
        <input
          type="search"
          enterKeyHint="go"
          autoComplete="off"
          autoCapitalize="words"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError('');
          }}
          placeholder="Trainee's last name or full name"
          aria-label="Trainee's last name or full name"
          aria-invalid={!!error}
          aria-describedby="name-hint"
        />
        <p id="name-hint" className={error ? 'field-error' : 'field-hint'}>
          {error ||
            (candidates.length === 0
              ? `Type a full name and press Go to start ${day.methods[0]}.`
              : notYet > 0
                ? `Tap a name to start ${day.methods[0]} · ${notYet} not yet done for ${day.label}.`
                : `Tap a name, or type a new trainee's full name.`)}
        </p>
      </form>

      {!trimmed && unfinished.length > 0 && (
        <section className="stack-sm" aria-label="Not finished">
          <h2 className="section-title">Not finished</h2>
          <ul className="list">
            {unfinished.map((e) => {
              const next = nextUnfinishedMethod(e);
              return (
                <li key={e.id}>
                  <button type="button" className="list-row resume-row" onClick={() => navigate({ name: 'score', id: e.id })}>
                    <span className="list-main">
                      {e.traineeName}
                      <small className="muted">
                        {getDay(e.day).label} · {formatDate(e.date)}
                      </small>
                    </span>
                    <span className="badge warn">Continue {next}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="stack-sm" aria-label="Trainees">
        {trimmed || candidates.length > 0 ? (
          <ul className="list candidate-list">
            {matches.slice(0, 60).map((c) => {
              const latest = c.sameDay[0];
              const s = latest && scoreEvaluation(latest);
              return (
                <li key={c.key}>
                  <button type="button" className="list-row" onClick={() => choose(c)}>
                    <span className="list-main">
                      {c.name}
                      {c.group && <small className="muted">{c.group}</small>}
                    </span>
                    {latest ? (
                      latest.completedAt ? (
                        <span className="list-score done">
                          {s!.correct}/{s!.total}
                          <small>{day.label} done</small>
                        </span>
                      ) : (
                        <span className="badge warn">Unfinished</span>
                      )
                    ) : (
                      <span className="start-chip">Start</span>
                    )}
                  </button>
                </li>
              );
            })}
            {trimmed && !exact && (
              <li>
                <button type="button" className="list-row new-row" onClick={startNew}>
                  <span className="list-main">
                    <span>
                      <span className="plus" aria-hidden="true">
                        +
                      </span>
                      New trainee: <strong>{trimmed}</strong>
                    </span>
                  </span>
                </button>
              </li>
            )}
          </ul>
        ) : (
          <p className="empty">
            No trainees yet. Type a full name above, or import a roster from <strong>Results</strong>.
          </p>
        )}
      </section>

      <Sheet open={editDrill} title={hasEvaluator ? 'Evaluator details' : 'Welcome! Who is evaluating?'} onClose={() => hasEvaluator && setEditDrill(false)}>
        <DrillForm initial={drill} onSave={() => setEditDrill(false)} onCancel={hasEvaluator ? () => setEditDrill(false) : undefined} />
      </Sheet>

      <Sheet open={!!existing} title={`${existing?.name ?? ''} already has ${day.label}`} onClose={() => setExisting(null)}>
        <ul className="list">
          {existing?.sameDay.map((e) => {
            const s = scoreEvaluation(e);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className="list-row"
                  onClick={() => navigate(e.completedAt ? { name: 'sheet', id: e.id } : { name: 'score', id: e.id })}
                >
                  <span className="list-main">
                    {e.completedAt ? 'Open results' : `Continue ${nextUnfinishedMethod(e)}`}
                    <small className="muted">
                      {formatDate(e.date)} · {s.correct}/{s.total} · {percent(s.accuracy)}
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
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const c = existing!;
              setExisting(null);
              begin(c.name, c.group);
            }}
          >
            Evaluate again
          </button>
        </div>
      </Sheet>
    </main>
  );
}
