---
name: edgelord-minimal-labeler
description: Use when continuing EdgeLord development, checking SOXL/SOXS data readiness, importing Alpaca CSV data, validating labels, or closing out a minimal-labeler slice.
---

# EdgeLord Minimal Labeler

## First Commands

From `/Users/JoeyKenney/Documents/EdgeLord`:

```bash
git status --short --branch
pnpm proceed:minimal-labeler
```

Use `pnpm proceed:minimal-labeler` before implementation to avoid rediscovering the repo state. It prints the current minimal-labeler workflow, local data posture, and expected closeout path.

## Normal Development Loop

Use this sequence for ordinary slices:

```bash
pnpm --filter @edgelord/web test
pnpm --filter @edgelord/web build
pnpm checkpoint:minimal-labeler
git status --short --branch
```

For backend/export/research changes, run `pnpm checkpoint:minimal-labeler` directly after focused tests. It covers lint, tests, typecheck, web build, temporary acceptance, live API smoke, research fixture, `data:status`, and final git status.

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
pnpm validate:csv data/alpaca-soxl-soxs-1min-2011-20260401-rth.csv --research-ready --target-start 2016-01-04 --min-years 10
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
pnpm checkpoint:minimal-labeler
git status --short --branch
```

Commit and push coherent slices when requested or when a natural milestone is complete:

```bash
git add <changed files>
git commit -m "<imperative summary>"
git push
```

Do not commit ignored `data/`, `exports/`, or generated `reports/` artifacts.
