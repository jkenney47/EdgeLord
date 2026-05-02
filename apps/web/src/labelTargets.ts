import type { Label, Trade } from "./api";

export const LABEL_TARGETS = {
  decisions: 300,
  entries: 100,
  skips: 100,
  closedTrades: 30
} as const;

export type LabelTargetProgress = {
  key: keyof typeof LABEL_TARGETS;
  label: string;
  current: number;
  target: number;
  complete: boolean;
};

export function labelTargetProgress(labels: Label[], trades: Trade[]): LabelTargetProgress[] {
  const trainingLabels = labels.filter((label) => label.training_eligible === 1);
  const closedTrades = trades.filter((trade) => trade.status === "closed");
  const counts = {
    decisions: trainingLabels.length,
    entries: trainingLabels.filter((label) => label.action === "ENTRY").length,
    skips: trainingLabels.filter((label) => label.action === "SKIP").length,
    closedTrades: closedTrades.length
  };

  const items: Array<Omit<LabelTargetProgress, "complete">> = [
    { key: "decisions", label: "Decisions", current: counts.decisions, target: LABEL_TARGETS.decisions },
    { key: "entries", label: "Entries", current: counts.entries, target: LABEL_TARGETS.entries },
    { key: "skips", label: "Skips", current: counts.skips, target: LABEL_TARGETS.skips },
    { key: "closedTrades", label: "Closed", current: counts.closedTrades, target: LABEL_TARGETS.closedTrades }
  ];

  return items.map((item) => ({
    ...item,
    complete: item.current >= item.target
  }));
}
