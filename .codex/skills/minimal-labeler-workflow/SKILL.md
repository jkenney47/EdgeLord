---
name: minimal-labeler-workflow
description: Use when scanning, editing, or verifying EdgeLord minimal SOXL/SOXS labeler changes.
---

# Minimal Labeler Workflow

Use this skill whenever the user asks to `proceed`, continue development, test the app, or implement the next EdgeLord minimal labeler slice.

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
pnpm acceptance:minimal-labeler
```

That command runs `pnpm verify`, starts a temporary API with a temporary SQLite database, seeds sample bars, creates entry/exit/skip/hindsight labels, checks that opposite ETF entry is blocked while a trade is open, verifies exit pairing, and checks all export endpoints. It does not touch local labeling data.

Equivalent explicit form:

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

For browser QA, use the Codex in-app browser at `http://127.0.0.1:5173/` after code changes and before final closeout when the slice affects visible chart, capture, replay, import, or export behavior.

Browser rule for this repo:

- Use the Codex in-app browser for live visual and interaction QA.
- Do not use standalone Playwright, Chrome DevTools, external browser sessions, or generic browser automation for EdgeLord UI review unless the user explicitly authorizes a fallback in that same turn.
- The Browser plugin may expose an internal `tab.playwright` API after initializing backend `iab`; that is acceptable because it controls the Codex in-app browser, not a separate Playwright browser.

Default labeler loop:

```bash
pnpm workflow:minimal-labeler
# edit the scoped slice
pnpm acceptance:minimal-labeler
# if UI changed, reload and inspect http://127.0.0.1:5173/ in the Codex in-app browser
```
