import { useMemo } from 'react';
import { getDay } from '../data/days';
import { formatDate, percent } from '../lib/format';
import { navigate } from '../lib/router';
import { nextUnfinishedMethod, scoreEvaluation } from '../lib/scoring';
import { evaluationsList, useAppState } from '../lib/store';
import type { Evaluation } from '../lib/types';

function openEvaluation(e: Evaluation) {
  const next = nextUnfinishedMethod(e);
  if (e.completedAt || !next) navigate({ name: 'summary', id: e.id });
  else navigate({ name: 'run', id: e.id, method: next });
}

export default function Home() {
  const drill = useAppState((s) => s.drill)!;
  const evaluations = useAppState((s) => s.evaluations);
  const day = getDay(drill.day);

  const { inProgress, thisDrill } = useMemo(() => {
    const list = evaluationsList(evaluations);
    return {
      inProgress: list.filter((e) => !e.completedAt),
      thisDrill: list.filter(
        (e) => e.completedAt && e.day === drill.day && e.date === drill.date && e.group === drill.group,
      ),
    };
  }, [evaluations, drill]);

  return (
    <main className="screen">
      <header className="home-header">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="28" height="28">
            <rect x="12" y="4" width="8" height="24" rx="2" fill="currentColor" />
            <rect x="4" y="12" width="24" height="8" rx="2" fill="currentColor" />
          </svg>
        </div>
        <div>
          <h1>MCI Triage Evaluator</h1>
          <p>Score one trainee at a time</p>
        </div>
      </header>

      <section className="card drill-card" aria-label="Current drill">
        <div className="drill-card-top">
          <div>
            <span className="eyebrow">{day.setTitle}</span>
            <h2>{day.label}</h2>
          </div>
          <button type="button" className="btn small secondary" onClick={() => navigate({ name: 'setup' })}>
            Change
          </button>
        </div>
        <div className="method-flow">
          {day.methods.map((m, i) => (
            <span key={m}>
              {i > 0 && <span className="arrow">→</span>}
              <span className="method-pill">{m}</span>
            </span>
          ))}
        </div>
        <dl className="drill-meta">
          <div>
            <dt>Evaluator</dt>
            <dd>{drill.evaluatorName}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(drill.date)}</dd>
          </div>
          <div>
            <dt>Group</dt>
            <dd>{drill.group || '—'}</dd>
          </div>
        </dl>
      </section>

      {inProgress.length > 0 && (
        <section className="stack-sm" aria-label="Unfinished evaluations">
          <h2 className="section-title">Not finished</h2>
          {inProgress.map((e) => {
            const next = nextUnfinishedMethod(e);
            return (
              <button key={e.id} type="button" className="card resume-card" onClick={() => openEvaluation(e)}>
                <div>
                  <strong>{e.traineeName}</strong>
                  <span className="muted">
                    {getDay(e.day).label} · {next ? `Continue ${next}` : 'Ready to save'}
                  </span>
                </div>
                <span className="resume-go">Resume</span>
              </button>
            );
          })}
        </section>
      )}

      <button type="button" className="btn primary block xlarge" onClick={() => navigate({ name: 'trainee' })}>
        Evaluate a trainee
      </button>

      <section className="stack-sm" aria-label="Evaluated in this drill">
        <div className="section-head">
          <h2 className="section-title">Done in this drill ({thisDrill.length})</h2>
          {thisDrill.length > 0 && (
            <button type="button" className="link-btn" onClick={() => navigate({ name: 'records' })}>
              All records
            </button>
          )}
        </div>
        {thisDrill.length === 0 ? (
          <p className="empty">Trainees you save will show up here.</p>
        ) : (
          <ul className="list">
            {thisDrill.slice(0, 8).map((e) => {
              const s = scoreEvaluation(e);
              return (
                <li key={e.id}>
                  <button type="button" className="list-row" onClick={() => navigate({ name: 'summary', id: e.id })}>
                    <span className="list-main">{e.traineeName}</span>
                    <span className="list-score">
                      {s.correct}/{s.total}
                      <small>{percent(s.accuracy)}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
