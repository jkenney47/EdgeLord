from __future__ import annotations

import argparse
from pathlib import Path

try:
    import pandas as pd
except ImportError as exc:
    raise SystemExit("pandas is required: pip install pandas") from exc


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect EdgeLord trades.csv.")
    parser.add_argument("trades_csv")
    args = parser.parse_args()
    trades = pd.read_csv(Path(args.trades_csv))
    print(f"trades: {len(trades)}")
    if "status" in trades:
        print(trades["status"].value_counts(dropna=False).to_string())
    if "return_pct" in trades and len(trades):
        print(trades["return_pct"].describe().to_string())


if __name__ == "__main__":
    main()
