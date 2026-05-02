---
name: edgelord-minimal-labeler
description: Use when continuing EdgeLord development, checking SOXL/SOXS data readiness, importing Alpaca CSV data, validating labels, or closing out a minimal-labeler slice.
---

# EdgeLord Minimal Labeler

## First Command

From `/Users/JoeyKenney/Documents/EdgeLord`:

```bash
pnpm slice:minimal-labeler
```

Use `pnpm slice:minimal-labeler` for the normal autonomous loop. It runs the proceed scan, lint, tests, typecheck, web build, temporary acceptance, live API smoke, research fixture, `data:status`, final git status, and closeout reminders in one command.

## Proceed Turn Macro

When the user says `Proceed`, `Proceed with development`, or `Do whatever you recommend`, use this exact loop:

```bash
git status --short --branch
```

If the tree is clean, pick the next slice in this order unless the user gave a narrower target:

1. data/import safety
2. label integrity
3. exports
4. research reports
5. Pine scaffold
6. UI only when visible behavior changed or the user asks

After edits, run:

```bash
pnpm slice:minimal-labeler
git diff --stat
git diff -- <changed files>
git add <changed files>
git commit -m "<imperative summary>"
git push
git status --short --branch
```

Skip the separate `pnpm proceed:minimal-labeler` orientation command unless you need recent checkpoint context before choosing a slice. `pnpm slice:minimal-labeler` already includes the proceed scan.

If you only need orientation before editing, use:

```bash
git status --short --branch
pnpm proceed:minimal-labeler
```

## Normal Development Loop

Use this sequence only when you need a narrower manual loop:

```bash
pnpm --filter @edgelord/web test
pnpm --filter @edgelord/web build
pnpm checkpoint:minimal-labeler
git status --short --branch
```

For backend/export/research changes, run `pnpm slice:minimal-labeler` after focused tests unless there is a concrete reason to use the narrower `pnpm checkpoint:minimal-labeler`.

For UI changes, verify in the Codex in-app browser at `http://127.0.0.1:5173/` after code checks. Prefer browser snapshots/clicks for layout and workflow checks.

## Alpaca Data Path

Alpaca credentials are loaded from `.env` by `pnpm data:alpaca`; do not print secrets.

Current known-good imported dataset:

```text
source: Alpaca SIP adjusted 1Min, RTH-only
range: 2016-01-04 to 2026-04-01
file: data/alpaca-soxl-soxs-1min-2011-20260401-rth.csv
rows: 1,806,117 raw rows
chart bars: 32,699 aggregate bars
```

The account did not return 2011-2015 minute data for this workflow. Validate the Alpaca-minute backfill with the 2016 target:

```bash
pnpm validate:csv data/alpaca-soxl-soxs-1min-2011-20260401-rth.csv --research-ready --target-start 2016-01-04 --min-years 10 --min-paired-overlap-pct 85
```

If replacing bars with active labels:

```bash
pnpm export:backup
pnpm import:csv data/alpaca-soxl-soxs-1min-2011-20260401-rth.csv --replace-bars --force-replace-bars --research-ready --target-start 2016-01-04 --min-years 10
pnpm labels:integrity
pnpm labels:repair
pnpm data:status
```

Only use `--force-replace-bars` after an export backup. `labels:repair` fixes stale bar indexes/chart prices only when the labeled candle still exists.

## Closeout

Before claiming completion:

```bash
pnpm slice:minimal-labeler
git status --short --branch
```

Commit and push coherent slices when requested or when a natural milestone is complete:

```bash
git add <changed files>
git commit -m "<imperative summary>"
git push
```

Do not commit ignored `data/`, `exports/`, or generated `reports/` artifacts.
