---
name: focused-ui-verify
description: Use when scanning, editing, or verifying EdgeLord focused chart or capture UI changes.
---

# Focused UI Workflow

Use this skill whenever the user asks to `proceed`, continue development, test the app, or implement the next EdgeLord focused chart/capture/review/export UI slice.

Run this from `/Users/JoeyKenney/Documents/EdgeLord` at the start of every focused chart, capture, review, replay, or export UI loop:

```bash
pnpm workflow:focused-ui
```

This is the reusable command packet for focused UI development. Do not re-create the sequence manually unless the script itself is being changed.

Use the script output as the working packet:

- read the current slice and next slice
- keep edits scoped to chart/capture UI
- avoid analytics, backtesting, or larger review features
- update `docs/CURRENT_HANDOFF.md` and `docs/NEXT_IMPLEMENTATION_PLAN.md` when a slice is completed

One-step default while working:

```bash
pnpm workflow:focused-ui
```

Only add targeted tests while editing when the touched surface needs faster feedback.

After focused chart or capture UI changes, use this one-command closeout:

```bash
pnpm workflow:focused-ui -- --verify
```

That command prints the active slice, runs the focused UI test packet, then runs the full repo gate:

```bash
pnpm test:focused-ui
pnpm verify
```

Use `pnpm test:focused-ui` for a fast preflight when only capture panel/store/review behavior changed, but finish with `pnpm workflow:focused-ui -- --verify`.

Use `pnpm verify` alone for non-UI work.

`pnpm smoke:ui:legacy-playwright` is legacy opt-in tooling only. Do not run it for normal EdgeLord UI verification unless the user explicitly authorizes standalone Playwright for that turn.

For browser QA, use the Codex in-app browser at `http://127.0.0.1:5173/` after the code change and before final closeout when the slice affects visible chart, capture, replay, review, import, or export behavior.

Hard browser rule for this repo:

- Use the Codex in-app browser for live visual and interaction QA.
- Do not use standalone Playwright, Chrome DevTools, external browser sessions, or generic browser automation for EdgeLord UI review unless the user explicitly authorizes a fallback in that same turn.
- The Browser plugin may expose an internal `tab.playwright` API after initializing backend `iab`; that is acceptable because it controls the Codex in-app browser, not a separate Playwright browser.

Default focused UI loop:

```bash
pnpm workflow:focused-ui
# edit the scoped slice
pnpm test:focused-ui
# reload and inspect http://127.0.0.1:5173/ in the Codex in-app browser
pnpm workflow:focused-ui -- --verify
```

If the target slice is backend-facing but affects Capture/Review/export UI contracts, run the relevant targeted API tests before `pnpm test:focused-ui`, then still close with `pnpm workflow:focused-ui -- --verify`.
