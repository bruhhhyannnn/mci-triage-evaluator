import { useState } from 'react';
import { Sheet, TopBar, toast, useConfirm } from '../components/ui';
import { formatClock, formatDate, percent } from '../lib/format';
import { navigate, replace } from '../lib/router';
import { scoreEvaluation } from '../lib/scoring';
import { completeEvaluation, deleteEvaluation, updateDetails, useAppState } from '../lib/store';
import NotFound from './NotFound';

export default function Summary({ id }: { id: string }) {
  const evaluation = useAppState((s) => s.evaluations[id]);
  const [editOpen, setEditOpen] = useState(false);
  const [details, setDetails] = useState({ traineeName: '', evaluatorName: '', date: '', group: '' });
  const confirm = useConfirm();

  if (!evaluation) return <NotFound />;
  const score = scoreEvaluation(evaluation);
  const saved = !!evaluation.completedAt;
  const unfinished = score.methods.filter((m) => !m.finished);

  function save(next: 'trainee' | 'home') {
    completeEvaluation(id);
    toast(`Saved ${evaluation!.traineeName}: ${score.correct}/${score.total}.`);
    if (next === 'trainee') replace({ name: 'trainee' });
    else replace({ name: 'home' });
  }

  async function remove() {
    const ok = await confirm.ask({
      title: 'Delete this sheet?',
      message: (
        <p>
          {evaluation!.traineeName}'s {score.day.label} sheet will be removed from this device. Export first if you need a copy.
        </p>
      ),
      confirmLabel: 'Delete sheet',
      danger: true,
    });
    if (!ok) return;
    deleteEvaluation(id);
    toast('Sheet deleted.');
    replace({ name: saved ? 'records' : 'home' });
  }

  return (
    <main className="screen">
      <TopBar
        title={evaluation.traineeName}
        subtitle={`${score.day.label} · ${saved ? 'Saved' : 'Not saved yet'}`}
        onBack={() => history.back()}
        right={
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setDetails({
                traineeName: evaluation.traineeName,
                evaluatorName: evaluation.evaluatorName,
                date: evaluation.date,
                group: evaluation.group,
              });
              setEditOpen(true);
            }}
          >
            Edit
          </button>
        }
      />

      <section className="card score-card total" aria-label="Day score">
        <span className="eyebrow">{score.day.label} score</span>
        <div className="score-big">
          <span className="score-num">
            {score.correct}
            <small>/{score.total}</small>
          </span>
          <span className="score-pct">{percent(score.accuracy)}</span>
        </div>
        <dl className="score-meta">
          <div>
            <dt>Total time</dt>
            <dd>{formatClock(score.timeMs)}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(evaluation.date)}</dd>
          </div>
          <div>
            <dt>Group</dt>
            <dd>{evaluation.group || '—'}</dd>
          </div>
        </dl>
        <p className="muted small">Evaluator: {evaluation.evaluatorName || '—'}</p>
      </section>

      <ul className="list method-list" aria-label="Score by method">
        {score.methods.map((m) => (
          <li key={m.method}>
            <button
              type="button"
              className="list-row"
              onClick={() => navigate({ name: m.finished ? 'review' : 'run', id, method: m.method })}
            >
              <span className="list-main">
                <strong>{m.method}</strong>
                <small className="muted">
                  {m.finished
                    ? `${formatClock(m.timeMs)} · ${m.wrong} wrong · ${m.untagged} not tagged`
                    : m.started
                      ? `In progress · ${m.tagged}/${m.total} tagged`
                      : 'Not started'}
                </small>
              </span>
              <span className="list-score">
                {m.correct}/{m.total}
                <small>{percent(m.accuracy)}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {saved ? (
        <div className="actions-bar">
          <button type="button" className="btn danger-outline" onClick={remove}>
            Delete
          </button>
          <button type="button" className="btn primary grow large" onClick={() => navigate({ name: 'trainee' })}>
            Evaluate next trainee
          </button>
        </div>
      ) : unfinished.length > 0 ? (
        <div className="actions-bar">
          <button type="button" className="btn danger-outline" onClick={remove}>
            Discard
          </button>
          <button
            type="button"
            className="btn primary grow large"
            onClick={() => navigate({ name: 'run', id, method: unfinished[0].method })}
          >
            Continue {unfinished[0].method}
          </button>
        </div>
      ) : (
        <div className="actions-bar column">
          <button type="button" className="btn primary block xlarge" onClick={() => save('trainee')}>
            Save and evaluate next trainee
          </button>
          <div className="row">
            <button type="button" className="btn secondary grow" onClick={() => save('home')}>
              Save and go home
            </button>
            <button type="button" className="btn danger-outline" onClick={remove}>
              Discard
            </button>
          </div>
        </div>
      )}

      <Sheet open={editOpen} title="Edit sheet details" onClose={() => setEditOpen(false)}>
        <div className="stack">
          <label className="field">
            <span>Trainee full name</span>
            <input value={details.traineeName} onChange={(e) => setDetails({ ...details, traineeName: e.target.value })} />
          </label>
          <label className="field">
            <span>Evaluator</span>
            <input value={details.evaluatorName} onChange={(e) => setDetails({ ...details, evaluatorName: e.target.value })} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Date</span>
              <input type="date" value={details.date} onChange={(e) => setDetails({ ...details, date: e.target.value })} />
            </label>
            <label className="field">
              <span>Group or batch</span>
              <input value={details.group} onChange={(e) => setDetails({ ...details, group: e.target.value })} />
            </label>
          </div>
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn secondary" onClick={() => setEditOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              updateDetails(id, details);
              setEditOpen(false);
              toast('Details updated.');
            }}
          >
            Save details
          </button>
        </div>
      </Sheet>
      {confirm.element}
    </main>
  );
}
