import { useState } from 'react';
import { AcceptedTags, Sheet, Steps, TagChip, TopBar, toast, useConfirm } from '../components/ui';
import { getDay } from '../data/days';
import { formatClock, parseClock, percent } from '../lib/format';
import { navigate } from '../lib/router';
import { scoreMethod, victimStatus, type VictimStatus } from '../lib/scoring';
import { resetMethod, setTag, setTime, useAppState } from '../lib/store';
import type { Method } from '../lib/types';
import { TAGS, TAG_LABEL } from '../lib/types';
import NotFound from './NotFound';

type Filter = 'all' | 'wrong' | 'untagged';

export default function MethodReview({ id, method }: { id: string; method: Method }) {
  const evaluation = useAppState((s) => s.evaluations[id]);
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeText, setTimeText] = useState('');
  const confirm = useConfirm();

  if (!evaluation) return <NotFound />;
  const day = getDay(evaluation.day);
  if (!day.methods.includes(method)) return <NotFound />;
  const run = evaluation.runs[method];
  const score = scoreMethod(day, method, run);
  const index = day.methods.indexOf(method);
  const nextMethod = day.methods[index + 1];
  const done = new Set(day.methods.filter((m) => evaluation.runs[m]?.finishedAt));

  const statuses = new Map<string, VictimStatus>(day.victims.map((v) => [v.id, victimStatus(v, method, run)]));
  const rows = day.victims.filter((v) => {
    const s = statuses.get(v.id);
    return filter === 'all' || (filter === 'wrong' ? s === 'wrong' : s === 'untagged');
  });

  async function redo() {
    const ok = await confirm.ask({
      title: `Redo ${method}?`,
      message: <p>All {method} tags and the time for {evaluation!.traineeName} will be cleared.</p>,
      confirmLabel: `Clear and redo`,
      danger: true,
    });
    if (!ok) return;
    resetMethod(id, method);
    navigate({ name: 'run', id, method });
  }

  function saveTime() {
    const ms = parseClock(timeText);
    if (ms === null) {
      toast('Enter time as minutes:seconds, e.g. 3:05');
      return;
    }
    setTime(id, method, ms);
    setTimeOpen(false);
    toast(`${method} time set to ${formatClock(ms)}.`);
  }

  const editingVictim = day.victims.find((v) => v.id === editing);

  return (
    <main className="screen">
      <TopBar
        title={`${method} results`}
        subtitle={`${evaluation.traineeName} · ${day.label}`}
        onBack={() => history.back()}
      />
      <Steps methods={day.methods} current={method} done={done} />

      <section className="card score-card" aria-label={`${method} score`}>
        <div className="score-big">
          <span className="score-num">
            {score.correct}
            <small>/{score.total}</small>
          </span>
          <span className="score-pct">{percent(score.accuracy)}</span>
        </div>
        <dl className="score-meta">
          <div>
            <dt>Time</dt>
            <dd>
              {formatClock(score.timeMs)}{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setTimeText(formatClock(score.timeMs));
                  setTimeOpen(true);
                }}
              >
                Edit
              </button>
            </dd>
          </div>
          <div>
            <dt>Wrong</dt>
            <dd>{score.wrong}</dd>
          </div>
          <div>
            <dt>Not tagged</dt>
            <dd>{score.untagged}</dd>
          </div>
        </dl>
      </section>

      <div className="segmented" role="tablist" aria-label="Show victims">
        {(
          [
            ['all', `All ${score.total}`],
            ['wrong', `Wrong ${score.wrong}`],
            ['untagged', `Not tagged ${score.untagged}`],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      <ul className="list review-list">
        <li className="review-row review-head" aria-hidden="true">
          <span>Victim</span>
          <span>Tagged</span>
          <span>Correct</span>
          <span />
        </li>
        {rows.length === 0 && <li className="empty">{filter === 'wrong' ? 'No wrong tags.' : 'Every victim was tagged.'}</li>}
        {rows.map((v) => {
          const status = statuses.get(v.id)!;
          return (
            <li key={v.id}>
              <button type="button" className={`review-row ${status}`} onClick={() => setEditing(v.id)}>
                <span className="review-id">{v.id}</span>
                <span className="review-given">
                  <TagChip tag={run?.answers[v.id]} size="sm" />
                </span>
                <span className="review-correct">
                  <AcceptedTags tags={v.correct[method]?.tags ?? []} />
                </span>
                <span className={`review-mark ${status}`} aria-label={status}>
                  {status === 'correct' ? '✓' : status === 'wrong' ? '✗' : '–'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="actions-bar">
        <button type="button" className="btn secondary" onClick={redo}>
          Redo {method}
        </button>
        {nextMethod ? (
          <button
            type="button"
            className="btn primary grow large"
            onClick={() => navigate({ name: evaluation.runs[nextMethod]?.finishedAt ? 'review' : 'run', id, method: nextMethod })}
          >
            Next: {nextMethod}
          </button>
        ) : (
          <button type="button" className="btn primary grow large" onClick={() => navigate({ name: 'summary', id })}>
            See {day.label} summary
          </button>
        )}
      </div>

      <Sheet open={!!editingVictim} title={`Change ${editing} tag`} onClose={() => setEditing(null)}>
        {editingVictim && (
          <>
            <p className="sheet-body">
              Correct: <AcceptedTags tags={editingVictim.correct[method]?.tags ?? []} />
              {editingVictim.correct[method]?.note && <span className="answer-note">{editingVictim.correct[method]?.note}</span>}
            </p>
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

      <Sheet open={timeOpen} title={`${method} time`} onClose={() => setTimeOpen(false)}>
        <label className="field">
          <span>Minutes:seconds</span>
          <input
            type="text"
            inputMode="numeric"
            value={timeText}
            onChange={(e) => setTimeText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveTime()}
            placeholder="3:05"
          />
        </label>
        <div className="sheet-actions">
          <button type="button" className="btn secondary" onClick={() => setTimeOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={saveTime}>
            Save time
          </button>
        </div>
      </Sheet>
      {confirm.element}
    </main>
  );
}
