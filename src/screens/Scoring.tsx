import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { AcceptedTags, TopBar, toast, useConfirm, useNow, useWakeLock } from '../components/ui';
import { getDay } from '../data/days';
import { formatClock } from '../lib/format';
import { haptic } from '../lib/haptics';
import { navigate, replace } from '../lib/router';
import { elapsedMs, nextUnfinishedMethod, scoreMethod, victimStatus } from '../lib/scoring';
import { finishMethod, getState, pauseTimer, setTag, startTimer, useAppState } from '../lib/store';
import type { DayConfig, Evaluation, Method, Tag } from '../lib/types';
import { TAGS, TAG_LABEL } from '../lib/types';
import NotFound from './NotFound';

export default function Scoring({ id, method: explicit }: { id: string; method?: Method }) {
  const evaluation = useAppState((s) => s.evaluations[id]);
  const method = evaluation ? (explicit ?? nextUnfinishedMethod(evaluation)) : null;

  // Every method finished: the sheet is saved, show its results.
  useEffect(() => {
    if (evaluation && !method) replace({ name: 'sheet', id });
  }, [evaluation, method, id]);

  if (!evaluation) return <NotFound />;
  const day = getDay(evaluation.day);
  if (!method) return null;
  if (!day.methods.includes(method)) return <NotFound />;
  // Keyed so selection and undo start fresh for each method.
  return <MethodPanel key={method} evaluation={evaluation} day={day} method={method} explicit={!!explicit} />;
}

function MethodPanel({
  evaluation,
  day,
  method,
  explicit,
}: {
  evaluation: Evaluation;
  day: DayConfig;
  method: Method;
  explicit: boolean;
}) {
  const id = evaluation.id;
  const run = evaluation.runs[method];
  const running = !!run?.startedAt;
  const started = !!run && (running || run.elapsedMs > 0 || Object.keys(run.answers).length > 0);
  const now = useNow(running);
  const [selected, setSelected] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<{ victimId: string; previous: Tag | null }[]>([]);
  const confirm = useConfirm();
  useWakeLock(running);

  const index = day.methods.indexOf(method);
  const score = scoreMethod(day, method, run, now);
  const selectedVictim = day.victims.find((v) => v.id === selected) ?? null;
  const selectedTag = selected ? run?.answers[selected] : undefined;

  /** After a method finishes: next method on this same screen, or the results when all are done. */
  function afterFinish() {
    haptic('success');
    const latest = getState().evaluations[id];
    const s = scoreMethod(day, method, latest?.runs[method]);
    const next = latest ? nextUnfinishedMethod(latest) : null;
    toast(next ? `${method} done: ${s.correct}/${s.total}. Next: ${next}.` : `${method} done: ${s.correct}/${s.total}. Sheet saved.`);
    if (explicit || !next) replace(next ? { name: 'score', id } : { name: 'sheet', id });
  }

  function select(victimId: string) {
    haptic('select');
    setSelected(selected === victimId ? null : victimId);
  }

  function applyTag(tag: Tag | null) {
    if (!selected) return;
    setUndoStack((s) => [...s.slice(-30), { victimId: selected, previous: run?.answers[selected] ?? null }]);
    const completed = setTag(id, method, selected, tag);
    setSelected(null);
    if (completed) afterFinish();
    else haptic('tap');
  }

  // Tablets with a keyboard: G / Y / R / B tag the selected victim.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = ({ g: 'GREEN', y: 'YELLOW', r: 'RED', b: 'BLACK' } as Record<string, Tag>)[e.key.toLowerCase()];
      if (tag) applyTag(tag);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function start() {
    haptic('start');
    startTimer(id, method);
  }

  function togglePause() {
    haptic('start');
    if (running) pauseTimer(id, method);
    else startTimer(id, method);
  }

  function undo() {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    haptic('select');
    setTag(id, method, last.victimId, last.previous);
    setUndoStack((s) => s.slice(0, -1));
    setSelected(last.victimId);
  }

  async function finish() {
    if (score.untagged > 0) {
      haptic('warning');
      const ok = await confirm.ask({
        title: `Finish ${method} now?`,
        message: (
          <p>
            {score.untagged} {score.untagged === 1 ? 'victim is' : 'victims are'} not tagged and will score 0.
          </p>
        ),
        confirmLabel: `Finish ${method}`,
      });
      if (!ok) return;
    }
    finishMethod(id, method);
    setSelected(null);
    afterFinish();
  }

  async function leave() {
    if (running) {
      const ok = await confirm.ask({
        title: `Leave ${method}?`,
        message: <p>The stopwatch pauses and the tags are kept. Continue from the Evaluate tab.</p>,
        confirmLabel: 'Pause and leave',
      });
      if (!ok) return;
      pauseTimer(id, method);
    }
    navigate({ name: 'home' });
  }

  return (
    <main className={`screen run-screen ${started ? 'started' : 'not-started'}`}>
      <TopBar title={evaluation.traineeName} subtitle={day.label} onBack={leave} backLabel="Leave" />

      {day.methods.length > 1 && (
        <ol className="method-steps" aria-label="Methods">
          {day.methods.map((m, i) => {
            const r = evaluation.runs[m];
            const s = scoreMethod(day, m, r);
            const state = m === method ? 'current' : r?.finishedAt ? 'done' : '';
            return (
              <li key={m} className={state} aria-current={m === method ? 'step' : undefined}>
                {state === 'done' ? <Icon name="check" size={14} stroke={3} /> : <span className="step-num">{i + 1}</span>}
                <span className="step-name">{m}</span>
                {state === 'done' && (
                  <span className="step-score mono">
                    {s.correct}/{s.total}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="run-layout">
        <section className="run-left">
          {started ? (
            <div className={`timer-panel ${running ? 'running' : 'paused'}`}>
              <div className="timer-readout">
                <span className="eyebrow">
                  {method} · {running ? 'Running' : 'Paused'}
                </span>
                <span className="timer-time mono">{formatClock(elapsedMs(run, now))}</span>
              </div>
              <div className="timer-progress">
                <span className="mono">
                  <strong>{score.tagged}</strong>/{score.total}
                </span>
                <span className="label">tagged</span>
              </div>
              <button type="button" className="timer-toggle" onClick={togglePause} aria-label={running ? 'Pause stopwatch' : 'Resume stopwatch'}>
                <Icon name={running ? 'pause' : 'play'} size={22} />
              </button>
            </div>
          ) : (
            <button type="button" className="start-bar" onClick={start}>
              <span className="start-icon">
                <Icon name="play" size={22} />
              </span>
              <span className="start-text">
                <span className="start-title">Start {method}</span>
                <span className="start-sub">
                  Method {index + 1} of {day.methods.length} · starts the stopwatch
                </span>
              </span>
            </button>
          )}

          <div className="victim-grid" role="group" aria-label={`${method} victims`}>
            {day.victims.map((v) => {
              const tag = run?.answers[v.id];
              const status = victimStatus(v, method, run);
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={!started}
                  className={`victim ${tag ? `tag-${tag.toLowerCase()}` : ''} ${selected === v.id ? 'selected' : ''}`}
                  aria-pressed={selected === v.id}
                  aria-label={`${v.id}${tag ? `, tagged ${TAG_LABEL[tag]}, ${status}` : ', not tagged'}`}
                  onClick={() => select(v.id)}
                >
                  <span className="victim-id mono">{v.id}</span>
                  {tag && (
                    <span className={`victim-mark ${status}`}>
                      <Icon name={status === 'correct' ? 'check' : 'x'} size={12} stroke={3.2} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="run-right">
          <div className={`answer-panel ${selectedVictim ? '' : 'idle'}`} aria-live="polite">
            {selectedVictim ? (
              <>
                <div className="answer-head">
                  <span className="answer-victim mono">{selectedVictim.id}</span>
                  <span className="label">Correct</span>
                  <AcceptedTags tags={selectedVictim.correct[method]?.tags ?? []} />
                </div>
                {selectedVictim.correct[method]?.note && <p className="answer-note">{selectedVictim.correct[method]?.note}</p>}
              </>
            ) : (
              <p>{started ? 'Tap the victim the trainee is at.' : `Tap Start ${method} when the trainee begins.`}</p>
            )}
          </div>

          <div className="tag-buttons" role="group" aria-label="Tag given by trainee">
            {TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`tag-btn tag-${tag.toLowerCase()} ${selectedTag === tag ? 'current' : ''}`}
                disabled={!selectedVictim}
                onClick={() => applyTag(tag)}
              >
                {TAG_LABEL[tag]}
              </button>
            ))}
          </div>

          {started && (
            <div className="run-footer">
              <button type="button" className="btn outline" onClick={undo} disabled={undoStack.length === 0}>
                <Icon name="undo-2" size={18} />
                Undo
              </button>
              {selectedTag && (
                <button type="button" className="btn outline" onClick={() => applyTag(null)}>
                  Clear {selected}
                </button>
              )}
              <button type="button" className="btn final grow" onClick={finish}>
                Finish {method}
              </button>
            </div>
          )}
        </section>
      </div>
      {confirm.element}
    </main>
  );
}
