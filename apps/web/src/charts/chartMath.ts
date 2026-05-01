export function candleIndexFromPointerRatio(ratio: number, candleCount: number): number | null {
  if (candleCount <= 0) {
    return null;
  }

  const clampedRatio = Math.max(0, Math.min(1, ratio));
  return Math.max(0, Math.min(candleCount - 1, Math.floor(clampedRatio * candleCount)));
}
