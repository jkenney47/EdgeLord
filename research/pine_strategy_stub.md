# Pine Strategy Stub

The app now writes a first TradingView-facing scaffold when `pnpm research:report` runs:

- `reports/<timestamp>-strategy-rules.v1.json`
- `reports/<timestamp>-strategy-soxl-soxs.pine`

This is intentionally not a complete trading strategy. It is generated from the top one-feature candidate rule, includes safety comments, and only maps simple exported features to Pine expressions.

Research still happens in Python first. A Pine output should be promoted only after the rule has enough labels, split behavior, exit logic, and human-vs-model review to justify TradingView testing.
