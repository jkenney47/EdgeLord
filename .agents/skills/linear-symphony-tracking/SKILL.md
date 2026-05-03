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

Each meaningful EdgeLord implementation issue should be an execution spec with:

- title: action-oriented and outcome-specific,
- goal: the concrete result this issue should produce,
- why it matters: short product, research, or operational context,
- current state: relevant behavior, files, docs, commands, screenshots, or known gaps,
- scope included: behavior, files, screens, scripts, exports, or data flows to change,
- scope excluded / non-goals: adjacent work Codex should avoid in this issue,
- required work: ordered implementation tasks,
- acceptance criteria: observable behavior that must be true when the issue is done,
- validation: exact commands such as `pnpm verify`, `pnpm slice:minimal-labeler`, `pnpm data:status`, or focused browser checks,
- dependencies/blockers: secrets, access, data/labeling risk boundaries, upstream decisions, or risky replacement steps,
- PR link once opened,
- completion handoff: final proof-of-work summary, validation results, changed files, and any follow-ups before Done.

Avoid issue bodies like "Improve labeler UI" or "Work on exports." Replace them with bounded packets such as "Keep exit-review capture panel within one viewport" or "Add manifest coverage for trade-candidate export rows."

## State Hygiene

Use this normal lifecycle:

1. `Todo`: scoped and ready, but not active.
2. `In Progress`: exactly one normal active implementation issue.
3. `Done`: validated and PR/merge status is clear.
4. Archive completed issues immediately to protect the 250 active issue cap.

Use the repo-local Linear sync commands so issue state stays attached to execution evidence:

```bash
pnpm linear:roadmap
pnpm linear:issue -- JOE-123
pnpm linear:start -- JOE-123
pnpm linear:comment -- JOE-123 --body-file /tmp/proof.md
pnpm linear:done -- JOE-123
```

Do not mark an issue Done just because one slice passed. Mark it Done only when the issue acceptance criteria are satisfied, validation passed, and the repo state is clear enough for handoff.

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
