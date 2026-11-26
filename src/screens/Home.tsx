import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { RosterSheet } from '../components/RosterSheet';
import { SettingsSheet } from '../components/SettingsSheet';
import { EmptyState, IconButton, SearchField, SegmentedControl, Sheet, StatusChip } from '../components/ui';
import { DAY_KEYS, DAYS, getDay } from '../data/days';
import { cleanName, formatDate, nameMatches, normalizeName, percent } from '../lib/format';
import { haptic } from '../lib/haptics';
import { navigate } from '../lib/router';
import { nextUnfinishedMethod, scoreEvaluation } from '../lib/scoring';
import { promptInstall, useInstallMode } from '../lib/install';
import { createEvaluation, defaultDrill, evaluationsList, setDrillDay, updateSettings, useAppState } from '../lib/store';
import type { DayKey, Evaluation } from '../lib/types';

interface Candidate {
  key: string;
  name: string;
  group: string;
  /** This trainee's sheets for the selected day, newest first. */
  sameDay: Evaluation[];
}

const ALL = '__all__';
const LIST_LIMIT = 80;

function InstallCard() {
  const mode = useInstallMode();
  const dismissed = useAppState((s) => s.settings.installDismissed);
  if (!mode || dismissed) return null;
  return (
    <section className="card install-card" aria-label="Install the app">
      <span className="row-plus" aria-hidden="true">
        <Icon name="smartphone" size={18} />
      </span>
      <div className="install-text">
        <strong>Install the app on this phone</strong>
        <span className="muted">
          {mode === 'ios'
            ? 'Tap Share, then Add to Home Screen. It opens full screen, works offline and keeps your scores safe.'
            : 'It opens full screen, works offline and keeps your scores safe.'}
        </span>
        <div className="row">
          {mode === 'prompt' && (
            <button
              type="button"
              className="btn primary sm"
              onClick={async () => {
                haptic('tap');
                if (await promptInstall()) updateSettings({ installDismissed: true });
              }}
            >
              Install
            </button>
          )}
          <button type="button" className="btn ghost sm" onClick={() => updateSettings({ installDismissed: true })}>
            {mode === 'ios' ? 'Got it' : 'Not now'}
          </button>
        </div>
      </div>
    </section>
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [existing, setExisting] = useState<Candidate | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);

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

  const groups = useMemo(() => Array.from(new Set(candidates.map((c) => c.group).filter(Boolean))).sort(), [candidates]);
  // Default to the drill's group when it exists in the list.
  const group = groupFilter ?? (drill.group && groups.includes(drill.group) ? drill.group : ALL);

  const trimmed = cleanName(query);
  const matches = useMemo(() => {
    const list = candidates.filter((c) => (group === ALL || c.group === group) && (!trimmed || nameMatches(c.name, trimmed)));
    // Not yet done for this day first, then A–Z.
    return list.sort((a, b) => Number(a.sameDay.length > 0) - Number(b.sameDay.length > 0) || a.name.localeCompare(b.name));
  }, [candidates, trimmed, group]);
  const exact = candidates.find((c) => c.key === normalizeName(trimmed));
  const inScope = candidates.filter((c) => group === ALL || c.group === group);
  const scored = inScope.filter((c) => c.sameDay.some((e) => e.completedAt)).length;
  // Without a search: split into who is left and who is done. Unfinished sheets have their own section above.
  const toScore = matches.filter((c) => c.sameDay.length === 0);
  const done = matches.filter((c) => c.sameDay.length > 0 && c.sameDay[0].completedAt);

  function begin(name: string, g = '') {
    haptic('tap');
    const e = createEvaluation(name, drill, g);
    setQuery('');
    navigate({ name: 'score', id: e.id });
  }

  function choose(c: Candidate) {
    if (c.sameDay.length > 0) {
      haptic('select');
      setExisting(c);
    } else begin(c.name, c.group);
  }

  function startNew() {
    if (trimmed.split(' ').length < 2) {
      haptic('warning');
      setError("Type the trainee's first and last name to add them.");
    } else begin(trimmed, group === ALL ? '' : group);
  }

  function submit() {
    if (!trimmed) return;
    if (exact) choose(exact);
    else if (matches.length === 1 && trimmed.split(' ').length < 2) choose(matches[0]);
    else startNew();
  }

  function renderRow(c: Candidate) {
    const latest = c.sameDay[0];
    const sc = latest && scoreEvaluation(latest);
    return (
      <button key={c.key} type="button" className={`row-card ${latest?.completedAt ? 'done' : ''}`} onClick={() => choose(c)}>
        <span className="row-main">
          <span className="row-title">{c.name}</span>
          {c.group && <span className="row-sub">{c.group}</span>}
        </span>
        {latest ? (
          latest.completedAt ? (
            <StatusChip status="live">
              Done <span className="mono">{sc!.correct}/{sc!.total}</span>
            </StatusChip>
          ) : (
            <StatusChip status="pending">Unfinished</StatusChip>
          )
        ) : (
          <span className="row-go" aria-hidden="true">
            <Icon name="chevron-right" size={20} />
          </span>
        )}
      </button>
    );
  }

  const hint = error
    ? error
    : candidates.length === 0
      ? `Type a full name and press Go, or import your list of names.`
      : `Tap a name to start ${day.methods[0]}, or type a new trainee's full name.`;

  return (
    <main className="screen home">
      <header className="home-header">
        <div>
          <div className="eyebrow">MCI triage drill</div>
          <h1 className="title">Evaluate</h1>
          <p className="meta-line">
            <Icon name="user" size={16} />
            {drill.evaluatorName || 'No evaluator set'}
            {drill.group && <span> · {drill.group}</span>}
          </p>
        </div>
        <IconButton icon="settings" label="Settings" onClick={() => setSettingsOpen(true)} />
      </header>

      <InstallCard />

      <section className="stack-sm" aria-label="Day">
        <SegmentedControl<DayKey>
          label="Day"
          role="radiogroup"
          className="day-tabs"
          value={drill.day}
          onChange={(k) => k !== drill.day && setDrillDay(k)}
          options={DAY_KEYS.map((k) => ({ value: k, label: DAYS[k].label }))}
        />
        <p className="day-flow">
          {day.methods.map((m, i) => (
            <span key={m}>
              {i > 0 && <span className="arrow"> → </span>}
              {m}
            </span>
          ))}
          <span className="day-flow-meta">
            {day.victims.length} victims · {day.victims.length * day.methods.length} pts
          </span>
        </p>
      </section>

      <section className="stack-sm" aria-label="Find trainee">
        <SearchField
          value={query}
          onChange={(v) => {
            setQuery(v);
            setError('');
          }}
          onSubmit={submit}
          placeholder="Trainee's last name or full name"
          label="Trainee's last name or full name"
          invalid={!!error}
          describedBy="name-hint"
        />
        <p id="name-hint" className={error ? 'field-error' : 'hint'}>
          {hint}
        </p>
        {inScope.length > 0 && !trimmed && (
          <div className="progress" aria-label={`${scored} of ${inScope.length} scored for ${day.label}`}>
            <div className="progress-text">
              <span>
                <strong className="mono">{scored}</strong>
                <span className="muted">
                  {' '}
                  of <span className="mono">{inScope.length}</span> scored for {day.label}
                  {group !== ALL ? ` · ${group}` : ''}
                </span>
              </span>
              <span className="mono muted">{Math.round((scored / inScope.length) * 100)}%</span>
            </div>
            <div className="progress-track">
              <span className="progress-fill" style={{ width: `${(scored / inScope.length) * 100}%` }} />
            </div>
          </div>
        )}
        {groups.length > 1 && (
          <div className="chips" role="group" aria-label="Group">
            {[ALL, ...groups].map((g) => (
              <button
                key={g}
                type="button"
                className={`chip ${group === g ? 'on' : ''}`}
                aria-pressed={group === g}
                onClick={() => {
                  haptic('select');
                  setGroupFilter(g);
                }}
              >
                {g === ALL ? 'All groups' : g}
              </button>
            ))}
          </div>
        )}
      </section>

      {!trimmed && unfinished.length > 0 && (
        <section className="stack-sm" aria-label="Not finished">
          <h2 className="section-label">Not finished</h2>
          {unfinished.map((e) => (
            <button key={e.id} type="button" className="row-card pending" onClick={() => navigate({ name: 'score', id: e.id })}>
              <span className="row-main">
                <span className="row-title">{e.traineeName}</span>
                <span className="row-sub">
                  {getDay(e.day).label} · {formatDate(e.date)}
                </span>
              </span>
              <StatusChip status="pending">Continue {nextUnfinishedMethod(e)}</StatusChip>
            </button>
          ))}
        </section>
      )}

      {candidates.length === 0 && !trimmed ? (
        <EmptyState
          icon="users"
          title="Add your trainees"
          body="Import the list of names once, then tap a name to start scoring."
          action={
            <button type="button" className="btn primary" onClick={() => setRosterOpen(true)}>
              <Icon name="upload" size={18} />
              Import names
            </button>
          }
        />
      ) : trimmed ? (
        <section className="stack-sm" aria-label="Matches">
          <h2 className="section-label">
            Matches <span className="count">{matches.length}</span>
          </h2>
          {matches.slice(0, LIST_LIMIT).map(renderRow)}
          {matches.length > LIST_LIMIT && <p className="hint">Showing {LIST_LIMIT} of {matches.length}. Type more of the name to narrow it down.</p>}
          {!exact && (
            <button type="button" className="row-card new" onClick={startNew}>
              <span className="row-plus" aria-hidden="true">
                <Icon name="plus" size={18} />
              </span>
              <span className="row-main">
                <span className="row-title">Add “{trimmed}”</span>
                <span className="row-sub">New trainee · starts {day.methods[0]}</span>
              </span>
            </button>
          )}
        </section>
      ) : (
        <>
          <section className="stack-sm" aria-label="To score">
            <div className="section-head">
              <h2 className="section-label">
                To score <span className="count">{toScore.length}</span>
              </h2>
              <button type="button" className="btn ghost sm" onClick={() => setRosterOpen(true)}>
                <Icon name="upload" size={16} />
                Import names
              </button>
            </div>
            {toScore.length === 0 ? (
              <p className="all-done">
                <StatusChip status="live">Everyone here is scored for {day.label}</StatusChip>
              </p>
            ) : (
              toScore.slice(0, LIST_LIMIT).map(renderRow)
            )}
            {toScore.length > LIST_LIMIT && (
              <p className="hint">
                Showing {LIST_LIMIT} of {toScore.length}. Search to find the rest.
              </p>
            )}
          </section>
          {done.length > 0 && (
            <section className="stack-sm" aria-label="Done">
              <h2 className="section-label">
                Done for {day.label} <span className="count">{done.length}</span>
              </h2>
              {done.slice(0, LIST_LIMIT).map(renderRow)}
            </section>
          )}
        </>
      )}

      <SettingsSheet open={settingsOpen || !hasEvaluator} firstRun={!hasEvaluator} onClose={() => setSettingsOpen(false)} />
      <RosterSheet open={rosterOpen} onClose={() => setRosterOpen(false)} />

      <Sheet open={!!existing} title={existing?.name ?? ''} eyebrow={`Already has ${day.label}`} onClose={() => setExisting(null)}>
        <div className="stack-sm">
          {existing?.sameDay.map((e) => {
            const s = scoreEvaluation(e);
            return (
              <button
                key={e.id}
                type="button"
                className="row-card"
                onClick={() => navigate(e.completedAt ? { name: 'sheet', id: e.id } : { name: 'score', id: e.id })}
              >
                <span className="row-main">
                  <span className="row-title">{e.completedAt ? 'Open results' : `Continue ${nextUnfinishedMethod(e)}`}</span>
                  <span className="row-sub">
                    {formatDate(e.date)} · <span className="mono">{s.correct}/{s.total}</span> · {percent(s.accuracy)}
                  </span>
                </span>
                <span className="row-go" aria-hidden="true">
                  <Icon name="chevron-right" size={20} />
                </span>
              </button>
            );
          })}
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn outline" onClick={() => setExisting(null)}>
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
