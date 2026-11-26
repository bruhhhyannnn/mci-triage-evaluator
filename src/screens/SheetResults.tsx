import { useState } from 'react';
import { AcceptedTags, Sheet, TagChip, TopBar, toast, useConfirm } from '../components/ui';
import { getDay } from '../data/days';
import { formatClock, formatDate, parseClock, percent } from '../lib/format';
import { navigate, replace } from '../lib/router';
import { nextUnfinishedMethod, scoreEvaluation, victimStatus } from '../lib/scoring';
import { deleteEvaluation, resetMethod, setTag, setTime, updateDetails, useAppState } from '../lib/store';
import type { Method } from '../lib/types';
import { TAGS, TAG_LABEL } from '../lib/types';
import NotFound from './NotFound';

export default function SheetResults({ id }: { id: string }) {
  const evaluation = useAppState((s) => s.evaluations[id]);
  const [tab, setTab] = useState<Method | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [timeText, setTimeText] = useState<string | null>(null);
  const [details, setDetails] = useState<{ traineeName: string; evaluatorName: string; date: string; group: string } | null>(null);
  const confirm = useConfirm();

  if (!evaluation) return <NotFound />;
  const day = getDay(evaluation.day);
  const score = scoreEvaluation(evaluation);
  const method = tab ?? day.methods[0];
  const ms = score.methods.find((m) => m.method === method)!;
  const run = evaluation.runs[method];
  const next = nextUnfinishedMethod(evaluation);

  const rows = day.victims
    .map((v) => ({ victim: v, status: victimStatus(v, method, run) }))
    .filter((r) => showAll || r.status !== 'correct');
  const editingVictim = day.victims.find((v) => v.id === editing);

  async function redo() {
    const ok = await confirm.ask({
      title: `Redo ${method}?`,
      message: <p>All {method} tags and the time for {evaluation!.traineeName} will be cleared.</p>,
      confirmLabel: `Clear and redo ${method}`,
      danger: true,
    });
    if (!ok) return;
    resetMethod(id, method);
    navigate({ name: 'score', id, method });
  }

  async function remove() {
    const ok = await confirm.ask({
      title: 'Delete this sheet?',
      message: (
        <p>
          {evaluation!.traineeName}'s {day.label} sheet will be removed from this device.
        </p>
      ),
      confirmLabel: 'Delete sheet',
      danger: true,
    });
    if (!ok) return;
    deleteEvaluation(id);
    toast('Sheet deleted.');
    replace({ name: 'home' });
  }

  function saveTime() {
    const value = parseClock(timeText ?? '');
    if (value === null) {
      toast('Enter time as minutes:seconds, e.g. 3:05');
      return;
    }
    setTime(id, method, value);
    setTimeText(null);
  }

  return (
    <main className="screen">
      <TopBar
        title={evaluation.traineeName}
        subtitle={`${day.label} · ${formatDate(evaluation.date)}${evaluation.group ? ` · ${evaluation.group}` : ''}`}
        onBack={() => (history.length > 1 ? history.back() : navigate({ name: 'home' }))}
        right={
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              setDetails({
                traineeName: evaluation.traineeName,
                evaluatorName: evaluation.evaluatorName,
                date: evaluation.date,
                group: evaluation.group,
              })
            }
          >
            Edit
          </button>
        }
      />

      <section className="card score-card total" aria-label={`${day.label} score`}>
        <div className="score-big">
          <span className="score-num">
            {score.correct}
            <small>/{score.total}</small>
          </span>
          <span className="score-pct">{percent(score.accuracy)}</span>
        </div>
        <div className="method-bars">
          {score.methods.map((m) => (
            <div key={m.method} className="method-bar">
              <span className="method-bar-name">{m.method}</span>
              <span className="method-bar-track">
                <span className="method-bar-fill" style={{ width: `${m.accuracy * 100}%` }} />
              </span>
              <span className="method-bar-score">
                {m.finished || m.started ? `${m.correct}/${m.total}` : '—'}
              </span>
            </div>
          ))}
        </div>
        <p className="muted small">
          {evaluation.completedAt ? 'Saved' : 'Not finished'} · total time {formatClock(score.timeMs)} · evaluator{' '}
          {evaluation.evaluatorName || '—'}
        </p>
      </section>

      {next && (
        <button type="button" className="card resume-card" onClick={() => navigate({ name: 'score', id })}>
          <span>
            <strong>{next} not finished</strong>
            <span className="muted">Tap to continue scoring</span>
          </span>
          <span className="resume-go">Continue</span>
        </button>
      )}

      <section className="stack-sm" aria-label="Details by method">
        {day.methods.length > 1 && (
          <div className="segmented" role="tablist" aria-label="Method">
            {score.methods.map((m) => (
              <button
                key={m.method}
                type="button"
                role="tab"
                aria-selected={method === m.method}
                onClick={() => setTab(m.method)}
              >
                {m.method}
                {m.wrong + m.untagged > 0 && m.started && <span className="tab-count">{m.wrong + m.untagged}</span>}
              </button>
            ))}
          </div>
        )}

        <div className="method-detail">
          <span>
            <strong>
              {ms.correct}/{ms.total}
            </strong>{' '}
            · {ms.wrong} wrong · {ms.untagged} not tagged
          </span>
          <button type="button" className="link-btn" onClick={() => setTimeText(formatClock(ms.timeMs))}>
            {formatClock(ms.timeMs)} ✎
          </button>
        </div>

        <ul className="list review-list">
          <li className="review-row review-head" aria-hidden="true">
            <span>Victim</span>
            <span>Tagged</span>
            <span>Correct</span>
            <span />
          </li>
          {rows.length === 0 && <li className="empty">All {ms.total} correct.</li>}
          {rows.map(({ victim, status }) => (
            <li key={victim.id}>
              <button type="button" className={`review-row ${status}`} onClick={() => setEditing(victim.id)}>
                <span className="review-id">{victim.id}</span>
                <span>
                  <TagChip tag={run?.answers[victim.id]} size="sm" />
                </span>
                <span>
                  <AcceptedTags tags={victim.correct[method]?.tags ?? []} />
                </span>
                <span className={`review-mark ${status}`} aria-label={status}>
                  {status === 'correct' ? '✓' : status === 'wrong' ? '✗' : '–'}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="row spread">
          <button type="button" className="link-btn" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show mistakes only' : `Show all ${ms.total} victims`}
          </button>
          {ms.started && (
            <button type="button" className="link-btn danger" onClick={redo}>
              Redo {method}
            </button>
          )}
        </div>
      </section>

      <button type="button" className="link-btn danger center" onClick={remove}>
        Delete this sheet
      </button>

      <div className="actions-bar">
        <button type="button" className="btn primary block xlarge" onClick={() => replace({ name: 'home' })}>
          Next trainee
        </button>
      </div>

      <Sheet open={!!editingVictim} title={`${editing} · ${method}`} onClose={() => setEditing(null)}>
        {editingVictim && (
          <>
            <div className="sheet-body">
              Correct: <AcceptedTags tags={editingVictim.correct[method]?.tags ?? []} />
              {editingVictim.correct[method]?.note && <span className="answer-note">{editingVictim.correct[method]?.note}</span>}
            </div>
            <div className="tag-buttons compact">
              {TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-btn tag-${tag.toLowerCase()} ${run?.answers[editingVictim.id] === tag ? 'current' : ''}`}
                  onClick={() => {
                    setTag(id, method, editingVictim.id, tag);
                    setEditing(null);
                  }}
                >
                  {TAG_LABEL[tag]}
                </button>
              ))}
            </div>
            <div className="sheet-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setTag(id, method, editingVictim.id, null);
                  setEditing(null);
                }}
              >
                Clear tag
              </button>
              <button type="button" className="btn primary" onClick={() => setEditing(null)}>
                Close
              </button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={timeText !== null} title={`${method} time`} onClose={() => setTimeText(null)}>
        <label className="field">
          <span>Minutes:seconds</span>
          <input
            inputMode="numeric"
            value={timeText ?? ''}
            onChange={(e) => setTimeText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveTime()}
            placeholder="3:05"
          />
        </label>
        <div className="sheet-actions">
          <button type="button" className="btn secondary" onClick={() => setTimeText(null)}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={saveTime}>
            Save time
          </button>
        </div>
      </Sheet>

      <Sheet open={!!details} title="Sheet details" onClose={() => setDetails(null)}>
        {details && (
          <div className="stack">
            <label className="field">
              <span>Trainee full name</span>
              <input value={details.traineeName} onChange={(e) => setDetails({ ...details, traineeName: e.target.value })} />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Date</span>
                <input type="date" value={details.date} onChange={(e) => setDetails({ ...details, date: e.target.value })} />
              </label>
              <label className="field">
                <span>Group</span>
                <input value={details.group} onChange={(e) => setDetails({ ...details, group: e.target.value })} />
              </label>
            </div>
            <label className="field">
              <span>Evaluator</span>
              <input value={details.evaluatorName} onChange={(e) => setDetails({ ...details, evaluatorName: e.target.value })} />
            </label>
            <div className="sheet-actions">
              <button type="button" className="btn secondary" onClick={() => setDetails(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  updateDetails(id, details);
                  setDetails(null);
                  toast('Details updated.');
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </Sheet>
      {confirm.element}
    </main>
  );
}
