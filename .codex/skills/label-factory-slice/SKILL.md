---
name: label-factory-slice
description: Use for EdgeLord work after the strategy-discovery pivot. Keeps implementation focused on replay-safe labeling throughput, research exports, and the 300-label gate.
---

# EdgeLord Label Factory Slice

## Start Here

Read these first:

- `AGENTS.md`
- `docs/STRATEGY_DISCOVERY_PIVOT.md`
- `docs/CURRENT_HANDOFF.md`
- `docs/NEXT_IMPLEMENTATION_PLAN.md`

## Default Scope

Allowed before 300 replay-safe labels:

- Reduce labeling friction.
- Make replay-safe capture the default.
- Keep `ENTRY`, `EXIT`, `SKIP`, `INVALID`, undo, and recent labels prominent.
- Improve simple label and modeling exports.
- Improve `research/` scripts.
- Fix bugs in labels, replay/leakage metadata, imports, aggregation, indicators, validation, or exports.

Do not add charting features, drawing features, dashboard features, responsive polish, broker features, new indicators, or strategy-mining UI unless the user explicitly overrides the gate.

## Verification

For code changes, start with the narrow checks:

```bash
pnpm verify:label-factory
```

If you need to isolate a failure, run the relevant check directly:

```bash
pnpm --filter @edgelord/api test -- tests/exportRoutes.test.ts tests/reviewRoutes.test.ts
pnpm --filter @edgelord/web test -- src/store/useAppStore.test.ts src/components/ToolRail.test.tsx src/charts/ChartGrid4H.test.tsx
pnpm --filter @edgelord/web typecheck
PYTHONDONTWRITEBYTECODE=1 python3 -m py_compile research/load_dataset.py research/summarize_labels.py research/discover_rules.py research/walkforward_eval.py research/pair_trades.py research/human_vs_model_diff.py research/build_candidate_packet.py
```

For simple research export changes:

```bash
pnpm --filter @edgelord/api test -- tests/exportRoutes.test.ts
curl -sS 'http://127.0.0.1:4317/export/research-labels?format=csv' | python3 research/summarize_labels.py /dev/stdin
```

For visual UI work, use the Codex in-app browser only. Do not use standalone Playwright or Chrome DevTools unless the user explicitly authorizes that fallback in the same turn.

## UI Simplification Loop

When the user says the app still feels too complex after the pivot:

1. Reduce visible default controls before adding anything new.
2. Keep only ticker/timeframe, replay mode, previous/next, load, selected candle, `ENTRY`/`EXIT`/`SKIP`/`INVALID`, undo, label source, active trade state, progress, and recent labels in the default surface.
3. Move data import, replay speed/start, export links, confidence/setup quality, reasons, notes, and linkage metadata behind a collapsed control.
4. Verify with:

```bash
pnpm --filter @edgelord/web typecheck
pnpm --filter @edgelord/web test -- src/store/useAppStore.test.ts src/components/ToolRail.test.tsx src/charts/ChartGrid4H.test.tsx
```

5. Reload `http://127.0.0.1:5173/` in the Codex in-app browser and take a screenshot. The first viewport should read as one focused chart plus one capture workflow, not a workstation.
