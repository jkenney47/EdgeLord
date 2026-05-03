---
name: linear-symphony-tracking
description: Use when creating, updating, or closing Linear issues for EdgeLord using Symphony-inspired issue orchestration patterns without adopting the Symphony daemon or Elixir runtime.
---

# Linear Symphony Tracking

Use this with EdgeLord Linear work so issues stay useful as implementation packets and the 250 active issue cap stays protected.

## Boundary

- Linear tracks project issue state, blockers, PR links, and handoffs.
- `AGENTS.md`, repo scripts, code, tests, and data reports remain implementation truth.
- Codex goals track the active run.
- Do not install Symphony, add a root `WORKFLOW.md`, or create an always-on Linear polling daemon unless a concrete orchestration gap is proven.

## Issue Shape

Each meaningful EdgeLord implementation issue should include:

- objective,
- acceptance criteria,
- expected files or repo surfaces,
- validation commands such as `pnpm verify`, `pnpm slice:minimal-labeler`, or `pnpm data:status`,
- data/labeling risk boundary,
- PR link once opened,
- final proof-of-work summary before Done.

## State Hygiene

Use this normal lifecycle:

1. `Todo`: scoped and ready, but not active.
2. `In Progress`: exactly one normal active implementation issue.
3. `Done`: validated and PR/merge status is clear.
4. Archive completed issues immediately to protect the 250 active issue cap.

Archive command:

```bash
~/.codex/bin/linear-archive-done --project "<Project name>" --apply
```

If the available Linear tool surface cannot archive completed issues, leave a clear manual cleanup list.

## Symphony Patterns To Borrow

- Treat the issue as the work packet.
- Keep workspace/branch isolation per issue or per tight issue group.
- Record terminal state clearly: done, blocked, needs review, failed validation, or superseded.
- Include proof of work: validation commands, PR checks, review status, data integrity checks, and handoff notes.
- Keep bounded concurrency: one active issue and one next issue unless the user explicitly wants parallel work.

## What Not To Borrow

- No Symphony daemon by default.
- No Elixir reference runtime by default.
- No tracker polling until manual/connector Linear updates become a repeated bottleneck.
- No duplicate root workflow contract that competes with `AGENTS.md`, repo scripts, and repo-local skills.
