from __future__ import annotations

import argparse
from pathlib import Path

try:
    import pandas as pd
except ImportError as exc:
    raise SystemExit("pandas is required: pip install pandas") from exc


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize EdgeLord labels.csv.")
    parser.add_argument("labels_csv")
    args = parser.parse_args()
    labels = pd.read_csv(Path(args.labels_csv))
    print(f"labels: {len(labels)}")
    if "action" in labels:
      print(labels["action"].value_counts(dropna=False).to_string())
    if "label_source" in labels:
      print(labels["label_source"].value_counts(dropna=False).to_string())
    if "training_eligible" in labels:
      print(labels["training_eligible"].value_counts(dropna=False).to_string())


if __name__ == "__main__":
    main()
