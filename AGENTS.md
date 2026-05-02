# EdgeLord Agent Instructions

EdgeLord is now a minimal SOXL/SOXS trade labeler. Do not rebuild the old TradingView-style workstation.

Allowed scope:

- Load adjusted SOXL/SOXS OHLCV CSV data.
- Aggregate `2H`, `4H`, and `1D` bars.
- Show one focused chart.
- Capture `ENTRY`, `EXIT`, `SKIP`, and `INVALID` labels.
- Enforce the long-only SOXL/SOXS state machine.
- Export labels, trades, training features, and JSONL.
- Keep a small research scaffold for later Pine Script strategy work.

Do not add drawing tools, trendlines, dashboards, dense review panels, broker integrations, alerts, watchlists, strategy mining UI, backtesting UI, or new indicators until the minimal labeler is working and useful.

Verification:

```bash
pnpm verify
```

Before closing out backend, labeling-rule, or export changes, run:

```bash
pnpm acceptance:minimal-labeler
```

That command uses a temporary SQLite database and verifies the SOXL/SOXS entry/exit/skip state machine plus CSV/JSONL exports without touching local labeling data.

For browser/UI verification, use the Codex in-app browser at `http://127.0.0.1:5173/`.
