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

## Goal Tracking

For long autonomous development runs, use Codex goals to keep the broader objective explicit across slices. If no active goal exists and the user has asked to continue development broadly, create one like:

```text
Continue EdgeLord minimal-labeler development through coherent backend/export/research/UI slices, validating with the repo workflow and committing/pushing natural checkpoints until the labeling and research pipeline is materially stronger.
```

Do not mark the goal complete after a single slice. Mark it complete only when the broader development objective has actually been achieved or the user explicitly narrows/closes the run.

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
pnpm slice:commit -- "<imperative summary>" <changed files>
```

This wrapper starts a temporary `pnpm dev:api` server when the live API is not already healthy, runs `pnpm slice:minimal-labeler`, prints the selected diff for review, stages only the listed files, commits, pushes, and prints final status. Keep using explicit file paths so unrelated local changes such as `.codex/config.toml` are not staged.

The wrapper refuses `.codex/`, `data/`, `exports/`, and `reports/` paths, and it exits before running the heavy gate if none of the selected files have changes. If a generated artifact is truly needed in git, stop and handle it manually instead of bypassing the guard casually.

Skip the separate `pnpm proceed:minimal-labeler` orientation command unless you need recent checkpoint context before choosing a slice. `pnpm slice:minimal-labeler` already includes the proceed scan.

If you only need orientation before editing, use:

```bash
git status --short --branch
pnpm proceed:minimal-labeler
```

## One-Step Slice Closeout

Prefer one repo command for verification, commit, and push once the slice files are known:

```bash
pnpm slice:commit -- "<imperative summary>" <changed files>
```

Do not run separate ad hoc lint/test/typecheck/build/commit/push sequences unless `slice:commit` is blocked. The wrapper is the canonical single-step closeout: it runs the proceed scan, lint, tests, typecheck, web build, temporary acceptance, research fixture, `data:status`, selected diff review, explicit staging, commit, push, and final status.

When continuing from a broad `proceed` prompt, avoid reopening planning unless repo evidence changed. Pick the next useful slice from the priority order, make the smallest scoped edit, then finish through `pnpm slice:commit -- "<imperative summary>" <changed files>`.

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

## Labeling Doctrine

The product direction is hindsight-friendly labeling. Treat regular historical labels and replay labels as equally serious training data.

- `actual_trade`, `retrospective_replay`, and `retrospective_hindsight` labels should all be training-eligible by default.
- Keep recording `capture_mode`, `visible_until_timestamp`, and `potential_visual_leakage` metadata, but do not use those fields to exclude regular/hindsight labels from exports or research unless the user explicitly asks for a filter.
- Do not reintroduce "replay-safe only" language in app copy, reports, docs, acceptance checks, or Pine scaffold warnings.
- The main user workflow is fast historical chart review: mark ENTRY, EXIT, and SKIP decisions directly on the regular view, then use exports/research/Pine scaffolds from those labels.
- If future work needs stricter anti-hindsight experiments, add an optional segment/filter without changing the default training pipeline.

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
pnpm slice:commit -- "<imperative summary>" <changed files>
```

Do not commit ignored `data/`, `exports/`, or generated `reports/` artifacts.
