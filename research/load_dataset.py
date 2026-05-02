from __future__ import annotations

import argparse
from pathlib import Path

try:
    import pandas as pd
except ImportError as exc:
    raise SystemExit("pandas is required: pip install pandas") from exc


def load_csv(path: str):
    return pd.read_csv(Path(path))


def main() -> None:
    parser = argparse.ArgumentParser(description="Load an EdgeLord CSV export.")
    parser.add_argument("csv_path")
    args = parser.parse_args()
    df = load_csv(args.csv_path)
    print(df.head().to_string(index=False))
    print(f"rows={len(df)} columns={len(df.columns)}")


if __name__ == "__main__":
    main()
