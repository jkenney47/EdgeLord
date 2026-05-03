# EdgeLord Agent Instructions

EdgeLord is now a minimal SOXL/SOXS trade labeler. Do not rebuild the old TradingView-style workstation.

When continuing EdgeLord development, use the repo-local skill at `.agents/skills/edgelord-minimal-labeler/SKILL.md` first. It captures the preferred command sequence for proceed/checkpoint/data/import/browser-verification work so future turns do not rediscover it.

When Linear is part of the work loop, also use `.agents/skills/linear-symphony-tracking/SKILL.md`. Treat Linear issues as execution specs, not reminders. Each meaningful issue should describe the goal, current state, included scope, explicit non-goals, expected files or repo surfaces, ordered implementation tasks, acceptance criteria, validation commands, blockers or data risks, PR links, and final proof-of-work notes. Use `pnpm linear:roadmap` before choosing broad development work, `pnpm linear:issue -- JOE-123` to turn the selected issue into an execution packet, and `pnpm linear:comment -- JOE-123 --body-file /tmp/proof.md` after each slice to sync proof of work back to Linear. Move issues with `pnpm linear:start -- JOE-123` and `pnpm linear:done -- JOE-123` only when the repo evidence supports the state change. Mark completed issues Done and archive them promptly to protect the 250 active issue cap.

For broad "proceed with development" runs, use Codex goals to track the larger objective across multiple coherent slices. Write the goal like an execution-ready development phase: objective, end state, included scope, excluded scope, inputs, concrete tasks, validation, done criteria, and blockers that require user input. Do not mark a goal complete merely because one slice was committed; complete it only when the broader run is actually finished or the user closes/narrows it.

Allowed scope:

- Load adjusted SOXL/SOXS OHLCV CSV data.
- Optionally download Alpaca adjusted bars into CSV before import.
- Aggregate `2H`, `4H`, and `1D` bars.
- Show one focused chart.
- Capture `ENTRY`, `EXIT`, `SKIP`, and `INVALID` labels.
- Enforce the long-only SOXL/SOXS state machine.
- Export labels, trades, training features, in-trade candidates, and JSONL.
- Keep a small research scaffold for later Pine Script strategy work.

Do not add drawing tools, trendlines, dashboards, dense review panels, broker integrations, alerts, watchlists, strategy mining UI, backtesting UI, or new indicators until the minimal labeler is working and useful.

Verification:

```bash
pnpm verify
```

Before closing out backend, labeling-rule, or export changes, run:

```bash
pnpm slice:minimal-labeler
```

That command runs the proceed scan, lint, tests, typecheck, web build, temporary acceptance, live API smoke, research fixture, `data:status`, final git status, and closeout reminders. The acceptance check uses a temporary SQLite database and verifies the SOXL/SOXS entry/exit/skip state machine plus CSV/JSONL exports without touching local labeling data.

After importing or replacing historical bars, run:

```bash
pnpm data:status
```

That command writes coverage, label-integrity, export-backup, and dataset-readiness reports. Use it to confirm the local database is on real adjusted data before serious labeling.

For Alpaca data, keep secrets in the shell environment only. Use `pnpm data:alpaca --start 2011-01-01 --end YYYY-MM-DD --output data/alpaca-soxl-soxs-1min.csv`, then validate/import that CSV through the normal `validate:csv` and `import:csv` commands. Current Alpaca SIP minute history for this SOXL/SOXS workflow starts at `2016-01-04`; validate that backfill with `--target-start 2016-01-04` and treat 2011-2015 as an unresolved external data-source gap.

Do not replace cached bars when active labels exist unless the user explicitly accepts the revalidation risk. The API and `pnpm import:csv --replace-bars` guard this by default; only use `--force-replace-bars` after an export backup and follow-up `pnpm labels:integrity`. If labels still reference existing candles but have stale indexes or chart prices after replacement, run `pnpm labels:repair` and then rerun `pnpm labels:integrity`.

For browser/UI verification, use the Codex in-app browser at `http://127.0.0.1:5173/`.
