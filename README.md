# MCI Triage Evaluator

Offline score sheets for MCI triage drills. Evaluators score **one trainee at a time** through each day's methods:

| Day | Set | Methods (in order) | Victims | Points |
| --- | --- | --- | --- | --- |
| Day 1 | Primary Triage-T Set | START → SIEVE | T1–T20 | 40 |
| Day 2 | Secondary Triage-T Set | SAVE → SORT | T1–T20 | 40 |
| Day 3 E-Set | Grand Simulation E-Set | START → SAVE → SIEVE → SORT | E1–E18 | 72 |

Answer keys and point totals are carried over unchanged from the original MCI Triage Evaluation app (`src/data/days.ts`).

## Evaluator flow

Two tabs: **Evaluate** and **Results**.

1. **Evaluate tab**: pick the day at the top, then tap the trainee's name (from the roster or anyone saved before) or type a new full name and press Go. The evaluator's name and group are asked once and shown at the top.
2. **Scoring screen** (one screen for the whole day): tap **Start START** when the trainee begins. While the stopwatch runs, the screen shows only the timer, the victim grid and the four tag colors. Tap the victim the trainee is at, then the tag they give; the correct tag (and any condition, e.g. T20) shows for the selected victim. The stopwatch stops by itself when every victim is tagged (or tap **Finish**; untagged victims score 0), and the same screen moves on to the next method (e.g. **Start SIEVE**).
3. **Results**: after the last method the sheet saves itself and shows the day score, each method's mistakes (tap one to fix it), time, and **Next trainee**.

The **Results tab** lists every trainee with their Day 1/2/3 scores (or every sheet, filterable by day), filters by name and group, exports to Excel or CSV, and holds the roster import (.csv/.xlsx or one name at a time).

Everything is stored on the device (`localStorage`) and works offline once loaded (installable PWA). The screen stays awake while a stopwatch runs. The CSV export uses the same columns as the original app.

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
