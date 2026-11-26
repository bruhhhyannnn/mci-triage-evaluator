# MCI Triage Evaluator

Offline score sheets for MCI triage drills. Evaluators score **one trainee at a time** through each day's methods:

| Day | Set | Methods (in order) | Victims | Points |
| --- | --- | --- | --- | --- |
| Day 1 | Primary Triage-T Set | START → SIEVE | T1–T20 | 40 |
| Day 2 | Secondary Triage-T Set | SAVE → SORT | T1–T20 | 40 |
| Day 3 E-Set | Grand Simulation E-Set | START → SAVE → SIEVE → SORT | E1–E18 | 72 |

Answer keys and point totals are carried over unchanged from the original MCI Triage Evaluation app (`src/data/days.ts`).

## Evaluator flow

1. **Set up the drill** once: day, evaluator, date, group or batch.
2. **Pick the trainee**: search by last name or full name (from the roster or anyone saved before), or type a new full name.
3. **Run each method**: a single "Start stopwatch" screen, then a focused scoring screen with only the stopwatch, the victim grid and the four tag colors. Tap the victim the trainee is at, then the tag they give. The correct tag (and any condition, e.g. T20) shows for the selected victim. The stopwatch stops by itself when every victim is tagged; "Done" finishes early (untagged victims score 0).
4. **Review** the method: score, time, and wrong or untagged victims; fix any tag, then go on to the next method.
5. **Summary**: day score per method → *Save and evaluate next trainee*.

Other screens: **Records** (filter by name, day, group, status; per-trainee Day 1/2/3 view; Excel and CSV export) and **Roster** (import a .csv/.xlsx list of names or add names one by one).

Everything is stored on the device (`localStorage`) and works offline once loaded (installable PWA). The CSV export uses the same columns as the original app.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (scoring, answer keys, export, roster import)
npm run build      # type-check + production build in dist/
```

Deploy on Vercel as a Vite project (build command `npm run build`, output directory `dist`).

## Not built yet

- Admin area (quizzes, final grade, analytics) and cloud sync — planned as a fresh build.
