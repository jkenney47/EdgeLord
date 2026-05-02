from __future__ import annotations

import argparse
import csv
import sys

from load_dataset import is_training_eligible, load_rows, sort_key, value


def main() -> None:
    parser = argparse.ArgumentParser(description="Pair ENTRY and EXIT labels into completed trade rows.")
    parser.add_argument("dataset", help="Path to CSV, JSON, or JSONL export")
    parser.add_argument("--include-ineligible", action="store_true", help="Include labels excluded from training")
    args = parser.parse_args()

    rows = sorted(load_rows(args.dataset), key=sort_key)
    if not args.include_ineligible:
        rows = [row for row in rows if is_training_eligible(row)]

    open_by_trade_id: dict[str, dict[str, object]] = {}
    open_by_ticker: dict[str, dict[str, object]] = {}
    trades: list[dict[str, object]] = []
    unmatched_exits = 0

    for row in rows:
        label_type = str(value(row, "labelType", "label_type")).upper()
        ticker = str(value(row, "ticker", default=""))
        trade_id = str(value(row, "tradeId", "trade_id", default=""))
        parent_label_id = str(value(row, "parentLabelId", "parent_label_id", default=""))

        if label_type == "ENTRY":
            key = trade_id or str(value(row, "id", "label_id", default=""))
            open_by_trade_id[key] = row
            open_by_ticker[ticker] = row
            continue

        if label_type != "EXIT":
            continue

        entry = open_by_trade_id.get(trade_id) if trade_id else None
        if entry is None and parent_label_id:
            entry = next(
                (
                    candidate
                    for candidate in open_by_trade_id.values()
                    if str(value(candidate, "id", "label_id", default="")) == parent_label_id
                ),
                None,
            )
        if entry is None:
            entry = open_by_ticker.get(ticker)

        if entry is None:
            unmatched_exits += 1
            continue

        entry_price = float(value(entry, "price", default=0) or 0)
        exit_price = float(value(row, "price", default=0) or 0)
        return_pct = ((exit_price - entry_price) / entry_price * 100) if entry_price else ""
        resolved_trade_id = trade_id or str(value(entry, "tradeId", "trade_id", "id", "label_id", default=""))

        trades.append(
            {
                "trade_id": resolved_trade_id,
                "entry_label_id": value(entry, "id", "label_id", default=""),
                "exit_label_id": value(row, "id", "label_id", default=""),
                "ticker": ticker,
                "entry_timestamp": value(entry, "timestamp", default=""),
                "exit_timestamp": value(row, "timestamp", default=""),
                "entry_price": entry_price,
                "exit_price": exit_price,
                "return_pct": round(return_pct, 6) if isinstance(return_pct, float) else "",
                "entry_label_source": value(entry, "labelSource", "label_source", default=""),
                "exit_label_source": value(row, "labelSource", "label_source", default=""),
            }
        )

        for key, candidate in list(open_by_trade_id.items()):
            if candidate is entry:
                del open_by_trade_id[key]
        if open_by_ticker.get(ticker) is entry:
            del open_by_ticker[ticker]

    fieldnames = [
        "trade_id",
        "entry_label_id",
        "exit_label_id",
        "ticker",
        "entry_timestamp",
        "exit_timestamp",
        "entry_price",
        "exit_price",
        "return_pct",
        "entry_label_source",
        "exit_label_source",
    ]
    writer = csv.DictWriter(sys.stdout, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(trades)

    print(f"# paired_trades={len(trades)} unmatched_exits={unmatched_exits} open_trades={len(open_by_trade_id)}", file=sys.stderr)


if __name__ == "__main__":
    main()
