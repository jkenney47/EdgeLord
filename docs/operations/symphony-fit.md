# Symphony Fit Notes

Last updated: 2026-05-03

## Recommendation

Use OpenAI Symphony as a reference pattern for Linear handoffs, bounded work packets, and proof-of-work notes. Do not adopt the Symphony daemon, Elixir runtime, tracker polling, or a root `WORKFLOW.md` for EdgeLord unless a concrete orchestration gap appears.

EdgeLord already has a repo-native workflow:

- `AGENTS.md` defines the minimal labeler scope and verification commands.
- `.agents/skills/edgelord-minimal-labeler/SKILL.md` defines the main implementation workflow.
- `.agents/skills/linear-symphony-tracking/SKILL.md` defines Linear issue-packet hygiene.
- `pnpm slice:minimal-labeler` provides the closeout validation bundle.
- `pnpm data:status` and `pnpm labels:integrity` protect data and label quality.

Linear's role is project status and handoff state. Repo scripts, tests, label exports, and data reports remain implementation truth. Codex goals remain active-run focus.

## What To Borrow

- Treat each meaningful Linear issue as the execution spec: goal, current state, included scope, explicit non-goals, ordered tasks, acceptance criteria, validation commands, blockers, PR link, and proof-of-work notes.
- Keep one normal active implementation issue and one next issue.
- Include acceptance criteria, expected files, validation commands, PR links, and proof-of-work notes.
- Record terminal state clearly: done, blocked, needs review, failed validation, or superseded.
- Archive completed issues immediately to protect the 250 active issue cap.

## What Not To Borrow Yet

- No Symphony daemon.
- No Elixir reference runtime.
- No tracker polling loop.
- No duplicate root workflow contract.
- No heavier roadmap system unless the minimal labeler workflow outgrows the current repo scripts.

## Refresh Procedure

Run:

```bash
pnpm symphony:fit
```

For stable local checks:

```bash
pnpm symphony:fit -- --no-fetch --output-dir=artifacts/symphony-fit/latest
```
