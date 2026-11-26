import { useEffect, useState } from 'react';
import { AcceptedTags, Steps, TopBar, toast, useConfirm, useNow } from '../components/ui';
import { getDay } from '../data/days';
import { formatClock } from '../lib/format';
import { navigate, replace } from '../lib/router';
import { elapsedMs, scoreMethod, victimStatus } from '../lib/scoring';
import { finishMethod, pauseTimer, setTag, startTimer, useAppState } from '../lib/store';
import type { Method, Tag } from '../lib/types';
import { TAGS, TAG_LABEL } from '../lib/types';
import NotFound from './NotFound';

export default function MethodRun({ id, method }: { id: string; method: Method }) {
  const evaluation = useAppState((s) => s.evaluations[id]);
  const [selected, setSelected] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<{ victimId: string; previous: Tag | null }[]>([]);
  const confirm = useConfirm();
  const run = evaluation?.runs[method];
  const running = !!run?.startedAt;
  const now = useNow(running);

  // Keyboard shortcuts for tablets with a keyboard: G/Y/R/B tag the selected victim.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = ({ g: 'GREEN', y: 'YELLOW', r: 'RED', b: 'BLACK' } as const)[e.key.toLowerCase() as 'g'];
      if (tag) applyTag(tag);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!evaluation) return <NotFound />;
  const day = getDay(evaluation.day);
  if (!day.methods.includes(method)) return <NotFound />;

  const index = day.methods.indexOf(method);
  const score = scoreMethod(day, method, run, now);
  const done = new Set(day.methods.filter((m) => evaluation.runs[m]?.finishedAt));
  const selectedVictim = day.victims.find((v) => v.id === selected) ?? null;
  const selectedTag = selected ? run?.answers[selected] : undefined;

  function applyTag(tag: Tag | null) {
    if (!selected) return;
    setUndoStack((s) => [...s.slice(-30), { victimId: selected, previous: run?.answers[selected] ?? null }]);
    const completed = setTag(id, method, selected, tag);
    setSelected(null);
    if (completed) {
      toast(`All ${day.victims.length} victims tagged. Stopwatch stopped.`);
      replace({ name: 'review', id, method });
    }
  }

  function undo() {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setTag(id, method, last.victimId, last.previous);
    setUndoStack((s) => s.slice(0, -1));
    setSelected(last.victimId);
  }

  async function finish() {
    if (run?.finishedAt) {
      replace({ name: 'review', id, method });
      return;
    }
    if (score.untagged > 0) {
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
    replace({ name: 'review', id, method });
  }

  async function leave() {
    if (running) {
      const ok = await confirm.ask({
        title: `Leave ${method}?`,
        message: <p>The stopwatch will pause. Tags are saved, so you can resume from Home.</p>,
        confirmLabel: 'Pause and leave',
      });
      if (!ok) return;
      pauseTimer(id, method);
    }
    navigate({ name: 'home' });
  }

  // ----- Before the stopwatch starts: one clear action -----
  if (!score.started) {
    return (
      <main className="screen">
        <TopBar
          title={evaluation.traineeName}
          subtitle={`${day.label} · ${evaluation.group || 'No group'}`}
          onBack={() => history.back()}
        />
        <Steps methods={day.methods} current={method} done={done} />
        <section className="prestart">
          <span className="eyebrow">
            Method {index + 1} of {day.methods.length}
          </span>
          <h2 className="method-title">{method}</h2>
          <p className="muted">
            {day.victims.length} victims ({day.victims[0].id}–{day.victims[day.victims.length - 1].id}). Tap the victim the
            trainee is at, then the tag they give. The stopwatch stops when every victim is tagged.
          </p>
        </section>
        <div className="actions-bar">
          <button type="button" className="btn primary block xlarge" onClick={() => startTimer(id, method)}>
            Start stopwatch
          </button>
        </div>
        {confirm.element}
      </main>
    );
  }

  // ----- Scoring: only the stopwatch, victims and tag colors -----
  return (
    <main className="screen run-screen">
      <TopBar
        title={evaluation.traineeName}
        subtitle={`${method} · ${index + 1} of ${day.methods.length}`}
        onBack={leave}
        backLabel="Leave"
      />

      <div className="run-layout">
        <section className="run-left">
          <div className={`timer-bar ${running ? 'running' : 'paused'}`}>
            <div className="timer-readout">
              <span className="timer-time" aria-live="off">
                {formatClock(elapsedMs(run, now))}
              </span>
              <span className="timer-state">{running ? 'Running' : run?.finishedAt ? 'Stopped' : 'Paused'}</span>
            </div>
            <div className="timer-progress">
              <strong>
                {score.tagged}/{score.total}
              </strong>{' '}
              tagged
            </div>
            <button
              type="button"
              className="btn secondary"
              onClick={() => (running ? pauseTimer(id, method) : startTimer(id, method))}
            >
              {running ? 'Pause' : 'Resume'}
            </button>
          </div>

          <div className="victim-grid" role="group" aria-label="Victims">
            {day.victims.map((v) => {
              const tag = run?.answers[v.id];
              const status = victimStatus(v, method, run);
              return (
                <button
                  key={v.id}
                  type="button"
                  className={`victim ${tag ? `tag-${tag.toLowerCase()}` : ''} ${selected === v.id ? 'selected' : ''}`}
                  aria-pressed={selected === v.id}
                  aria-label={`${v.id}${tag ? `, tagged ${TAG_LABEL[tag]}, ${status}` : ', not tagged'}`}
                  onClick={() => setSelected(selected === v.id ? null : v.id)}
                >
                  <span className="victim-id">{v.id}</span>
                  {tag && <span className={`victim-mark ${status}`}>{status === 'correct' ? '✓' : '✗'}</span>}
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
                  <span className="answer-victim">{selectedVictim.id}</span>
                  <span className="answer-label">Correct:</span>
                  <AcceptedTags tags={selectedVictim.correct[method]?.tags ?? []} />
                </div>
                {selectedVictim.correct[method]?.note && <p className="answer-note">{selectedVictim.correct[method]?.note}</p>}
              </>
            ) : (
              <p>Tap the victim the trainee is at.</p>
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

          <div className="run-footer">
            <button type="button" className="btn secondary" onClick={undo} disabled={undoStack.length === 0}>
              Undo
            </button>
            {selectedTag && (
              <button type="button" className="btn secondary" onClick={() => applyTag(null)}>
                Clear {selected}
              </button>
            )}
            <button type="button" className="btn primary grow" onClick={finish}>
              {run?.finishedAt ? 'Review' : `Done with ${method}`}
            </button>
          </div>
        </section>
      </div>
      {confirm.element}
    </main>
  );
}
