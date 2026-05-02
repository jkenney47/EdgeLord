---
name: minimal-labeler-workflow
description: Use when scanning, editing, verifying, browser-testing, or closing out EdgeLord minimal SOXL/SOXS labeler changes.
---

# Minimal Labeler Workflow

Use this skill whenever the user asks to `proceed`, continue development, test the app, or implement the next EdgeLord minimal labeler slice.

For a plain `proceed` request, use this one loop without asking again:

1. Run `git status --short --branch` and `pnpm workflow:minimal-labeler`.
2. Pick the next smallest useful slice in this order: data/import safety, label integrity, exports, research reports, Pine scaffold, then UI only if visible behavior changed or the user asks.
3. Make the scoped edit.
4. Run `pnpm closeout:minimal-labeler`.
5. Commit and push when the tree is cleanly verified and the change is a coherent checkpoint.

Run this from `/Users/JoeyKenney/Documents/EdgeLord` at the start of every labeler, state-machine, capture, import, or export loop:

```bash
pnpm workflow:minimal-labeler
```

This is the reusable command packet for the restarted EdgeLord app. Do not re-create the sequence manually unless the script itself is being changed.

Keep work scoped to the minimal labeler:

- one focused SOXL/SOXS chart
- replay-safe `ENTRY`, `EXIT`, `SKIP`, and `INVALID` labels
- long-only SOXL/SOXS state machine with no implicit reversal
- local adjusted CSV import
- labels, trades, training-features, and JSONL exports
- small research scaffold for later Pine Script strategy work

Close out backend, labeling-rule, or export changes with:

```bash
pnpm closeout:minimal-labeler
```

That command runs lint, tests, typecheck, web build, a temporary API acceptance check, and a live API smoke check when the dev API is already running. The temporary acceptance check uses a temporary SQLite database, seeds sample bars, creates entry/exit/skip/hindsight labels, checks that opposite ETF entry is blocked while a trade is open, verifies exit pairing, and checks all export endpoints. It does not touch local labeling data.

Use the narrower acceptance-only check when you do not need lint or live API smoke:

```bash
pnpm workflow:minimal-labeler -- --acceptance
```

Use a live API smoke check only when the local dev server is already running and you specifically want to verify the active local database:

```bash
pnpm workflow:minimal-labeler -- --api-smoke
```

Use `--reset-db` only when intentionally clearing the local labeling database:

```bash
pnpm workflow:minimal-labeler -- --reset-db
```

Do not add drawing tools, trendlines, dashboards, dense review panels, broker integrations, alerts, watchlists, strategy mining UI, backtesting UI, or new indicators unless the user explicitly changes the product direction.

For browser QA, choose the best tool for the job:

- Use the Codex in-app browser at `http://127.0.0.1:5173/` for visual truth: layout, clutter, spacing, chart framing, and user-flow feel.
- Use Playwright when repeatability matters: keyboard flows, viewport sweeps, export links, form behavior, and regression checks.
- Use code gates only for backend/data-only changes that do not affect visible behavior.

Preferred in-app browser setup:

1. Read the Browser Use skill before browser work.
2. If the Node REPL JavaScript tool is not visible, search for `node_repl js`.
3. Initialize Browser Use through `node_repl` with backend `iab`.
4. Reuse the selected tab instead of reloading unless a reload is needed after code changes.

The Browser plugin may expose an internal `tab.playwright` API after initializing backend `iab`; that is acceptable because it controls the Codex in-app browser.

Default labeler loop:

```bash
pnpm workflow:minimal-labeler
# edit the scoped slice
pnpm closeout:minimal-labeler
# if UI changed, inspect http://127.0.0.1:5173/ in the Codex in-app browser; add Playwright only when repeatable automation is useful
```
