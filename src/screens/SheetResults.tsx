import { useState } from 'react';
import { Icon } from '../components/Icon';
import { AcceptedTags, SegmentedControl, Sheet, StatusChip, TagChip, TopBar, toast, useConfirm } from '../components/ui';
import { getDay } from '../data/days';
import { formatClock, formatDate, parseClock, percent } from '../lib/format';
import { haptic } from '../lib/haptics';
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
      haptic('warning');
      toast('Enter time as minutes:seconds, for example 3:05');
      return;
    }
    setTime(id, method, value);
    haptic('tap');
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
            className="icon-btn card"
            style={{ width: 44, height: 44 }}
            aria-label="Edit sheet details"
            title="Edit sheet details"
            onClick={() =>
              setDetails({
                traineeName: evaluation.traineeName,
                evaluatorName: evaluation.evaluatorName,
                date: evaluation.date,
                group: evaluation.group,
              })
            }
          >
            <Icon name="pencil" size={18} />
          </button>
        }
      />

      <section className="card score-card" aria-label={`${day.label} score`}>
        <div className="score-top">
          <div>
            <div className="eyebrow">{day.label} score</div>
            <div className="moment">
              {score.correct}
              <span className="moment-of">/{score.total}</span>
            </div>
          </div>
          <div className="score-side">
            <span className="score-pct mono">{percent(score.accuracy)}</span>
            {evaluation.completedAt ? <StatusChip status="live">Saved</StatusChip> : <StatusChip status="pending">Not finished</StatusChip>}
          </div>
        </div>
        <div className="method-bars">
          {score.methods.map((m) => (
            <div key={m.method} className="method-bar">
              <span className="method-bar-name">{m.method}</span>
              <span className="method-bar-track">
                <span className="method-bar-fill" style={{ width: `${m.accuracy * 100}%` }} />
              </span>
              <span className="method-bar-score mono">{m.finished || m.started ? `${m.correct}/${m.total}` : '—'}</span>
            </div>
          ))}
        </div>
        <p className="meta-line small">
          <Icon name="clock" size={14} />
          <span className="mono">{formatClock(score.timeMs)}</span> total · {evaluation.evaluatorName || 'No evaluator'}
        </p>
      </section>

      {next && (
        <button type="button" className="row-card pending" onClick={() => navigate({ name: 'score', id })}>
          <span className="row-main">
            <span className="row-title">{next} is not finished</span>
            <span className="row-sub">Tap to continue scoring</span>
          </span>
          <StatusChip status="pending">Continue</StatusChip>
        </button>
      )}

      <section className="stack-sm" aria-label="Details by method">
        {day.methods.length > 1 && (
          <SegmentedControl<Method>
            label="Method"
            value={method}
            onChange={setTab}
            options={score.methods.map((m) => ({
              value: m.method,
              label: (
                <>
                  {m.method}
                  {m.started && m.wrong + m.untagged > 0 && <span className="tab-count">{m.wrong + m.untagged}</span>}
                </>
              ),
            }))}
          />
        )}

        <div className="method-detail">
          <span>
            <strong className="mono">
              {ms.correct}/{ms.total}
            </strong>
            <span className="muted">
              {' '}
              · {ms.wrong} wrong · {ms.untagged} not tagged
            </span>
          </span>
          <button type="button" className="btn ghost sm" onClick={() => setTimeText(formatClock(ms.timeMs))} aria-label={`Edit ${method} time`}>
            <Icon name="timer" size={16} />
            <span className="mono">{formatClock(ms.timeMs)}</span>
          </button>
        </div>

        <div className="card list-card">
          <div className="review-row review-head" aria-hidden="true">
            <span>Victim</span>
            <span>Tagged</span>
            <span>Correct</span>
            <span />
          </div>
          {rows.length === 0 && (
            <div className="all-correct">
              <StatusChip status="live">All {ms.total} correct</StatusChip>
            </div>
          )}
          {rows.map(({ victim, status }) => (
            <button key={victim.id} type="button" className={`review-row ${status}`} onClick={() => setEditing(victim.id)}>
              <span className="review-id mono">{victim.id}</span>
              <span>
                <TagChip tag={run?.answers[victim.id]} size="sm" />
              </span>
              <span>
                <AcceptedTags tags={victim.correct[method]?.tags ?? []} />
              </span>
              <span className={`review-mark ${status}`} aria-label={status}>
                {status === 'untagged' ? '–' : <Icon name={status === 'correct' ? 'check' : 'x'} size={16} stroke={3} />}
              </span>
            </button>
          ))}
        </div>
        <div className="row spread">
          <button type="button" className="btn ghost sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show mistakes only' : `Show all ${ms.total} victims`}
          </button>
          {ms.started && (
            <button type="button" className="btn ghost sm danger-text" onClick={redo}>
              <Icon name="rotate-ccw" size={16} />
              Redo {method}
            </button>
          )}
        </div>
      </section>

      <button type="button" className="btn ghost sm danger-text center" onClick={remove}>
        <Icon name="trash-2" size={16} />
        Delete this sheet
      </button>

      <div className="actions-bar">
        <button type="button" className="btn final block large" onClick={() => replace({ name: 'home' })}>
          Next trainee
          <Icon name="arrow-right" size={20} />
        </button>
      </div>

      <Sheet open={!!editingVictim} title={`Change ${editing}`} eyebrow={method} onClose={() => setEditing(null)}>
        {editingVictim && (
          <>
            <div className="sheet-body answer-head">
              <span className="label">Correct</span>
              <AcceptedTags tags={editingVictim.correct[method]?.tags ?? []} />
            </div>
            {editingVictim.correct[method]?.note && <p className="answer-note">{editingVictim.correct[method]?.note}</p>}
            <div className="tag-buttons compact">
              {TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-btn tag-${tag.toLowerCase()} ${run?.answers[editingVictim.id] === tag ? 'current' : ''}`}
                  onClick={() => {
                    haptic('tap');
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
                className="btn outline"
                onClick={() => {
                  haptic('select');
                  setTag(id, method, editingVictim.id, null);
                  setEditing(null);
                }}
              >
                Clear tag
              </button>
              <button type="button" className="btn primary" onClick={() => setEditing(null)}>
                Done
              </button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={timeText !== null} title={`${method} time`} onClose={() => setTimeText(null)}>
        <label className="field">
          <span className="label">Minutes:seconds</span>
          <input
            className="input mono"
            inputMode="numeric"
            value={timeText ?? ''}
            onChange={(e) => setTimeText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveTime()}
            placeholder="3:05"
          />
        </label>
        <div className="sheet-actions">
          <button type="button" className="btn outline" onClick={() => setTimeText(null)}>
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
              <span className="label">Trainee full name</span>
              <input className="input" value={details.traineeName} onChange={(e) => setDetails({ ...details, traineeName: e.target.value })} />
            </label>
            <div className="row">
              <label className="field grow">
                <span className="label">Date</span>
                <input className="input" type="date" value={details.date} onChange={(e) => setDetails({ ...details, date: e.target.value })} />
              </label>
              <label className="field grow">
                <span className="label">Group</span>
                <input className="input" value={details.group} onChange={(e) => setDetails({ ...details, group: e.target.value })} />
              </label>
            </div>
            <label className="field">
              <span className="label">Evaluator</span>
              <input className="input" value={details.evaluatorName} onChange={(e) => setDetails({ ...details, evaluatorName: e.target.value })} />
            </label>
            <div className="sheet-actions">
              <button type="button" className="btn outline" onClick={() => setDetails(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  updateDetails(id, details);
                  haptic('tap');
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
