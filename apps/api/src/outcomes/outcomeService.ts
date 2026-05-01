import type { SqliteDatabase } from "../db/database.js";
import { listTradeEvents, updateTradeEvent } from "../labels/labelService.js";
import type { TradeEventDto } from "../labels/labelService.js";
import { outcomeRuleVersion } from "./outcomeVersions.js";

type OutcomeBarRow = {
  timestamp: string;
  high: number;
  low: number;
  close: number;
};

export type OutcomeCalculationOptions = {
  horizonBars?: number;
};

const returnHorizons = [1, 3, 5, 10] as const;

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function signedReturnPercent(entryPrice: number, exitPrice: number, isShort: boolean): number {
  const rawReturn = ((exitPrice - entryPrice) / entryPrice) * 100;
  return round6(isShort ? -rawReturn : rawReturn);
}

function firstHitBar(
  bars: OutcomeBarRow[],
  price: number | null,
  isShort: boolean,
  type: "target" | "stop"
): number | null {
  if (price === null) {
    return null;
  }

  const hitIndex = bars.findIndex((bar) => {
    if (type === "target") {
      return isShort ? bar.low <= price : bar.high >= price;
    }

    return isShort ? bar.high >= price : bar.low <= price;
  });

  return hitIndex === -1 ? null : hitIndex + 1;
}

function futureReturnForHorizon(
  bars: OutcomeBarRow[],
  entryPrice: number,
  isShort: boolean,
  horizon: (typeof returnHorizons)[number]
): number | null {
  const bar = bars[horizon - 1];
  return bar ? signedReturnPercent(entryPrice, bar.close, isShort) : null;
}

function getFutureBars(db: SqliteDatabase, label: TradeEventDto, horizonBars: number): OutcomeBarRow[] {
  return db
    .prepare(
      `select timestamp,
        high,
        low,
        close
      from aggregated_bars
      where ticker = ?
        and timeframe = ?
        and timestamp > ?
      order by timestamp asc
      limit ?`
    )
    .all(label.ticker, label.timeframe, label.timestamp, horizonBars) as OutcomeBarRow[];
}

function findActiveLabel(db: SqliteDatabase, labelId: string): TradeEventDto {
  const label = listTradeEvents(db).find((event) => event.id === labelId);

  if (!label) {
    throw new Error("Trade event not found");
  }

  return label;
}

export function calculateOutcomeForLabel(
  db: SqliteDatabase,
  labelId: string,
  options: OutcomeCalculationOptions = {}
): TradeEventDto {
  const horizonBars = options.horizonBars ?? 10;
  if (!Number.isInteger(horizonBars) || horizonBars < 1) {
    throw new Error("Invalid outcome horizon");
  }

  const label = findActiveLabel(db, labelId);
  const bars = getFutureBars(db, label, horizonBars);
  const isShort = label.tradeDirection === "short_ticker";
  const futureReturns = Object.fromEntries(
    returnHorizons.map((horizon) => [
      horizon,
      futureReturnForHorizon(bars, label.price, isShort, horizon)
    ])
  ) as Record<(typeof returnHorizons)[number], number | null>;
  const highReturns = bars.map((bar) =>
    signedReturnPercent(label.price, isShort ? bar.low : bar.high, isShort)
  );
  const lowReturns = bars.map((bar) =>
    signedReturnPercent(label.price, isShort ? bar.high : bar.low, isShort)
  );
  const targetBars = firstHitBar(bars, label.targetPrice, isShort, "target");
  const stopBars = firstHitBar(bars, label.invalidationPrice, isShort, "stop");

  return updateTradeEvent(db, label.id, {
    outcomeAvailable: bars.length > 0,
    outcomeHorizonBars: bars.length > 0 ? bars.length : null,
    outcomeStatus: bars.length > 0 ? "computed" : "insufficient_future_bars",
    outcomeRuleVersion: outcomeRuleVersion,
    outcomeFutureReturn1: futureReturns[1],
    outcomeFutureReturn3: futureReturns[3],
    outcomeFutureReturn5: futureReturns[5],
    outcomeFutureReturn10: futureReturns[10],
    outcomeFutureMaxFavorableExcursion:
      highReturns.length > 0 ? round6(Math.max(...highReturns)) : null,
    outcomeFutureMaxAdverseExcursion:
      lowReturns.length > 0 ? round6(Math.min(...lowReturns)) : null,
    outcomeFutureHitTarget: label.targetPrice === null ? null : targetBars !== null,
    outcomeFutureHitStop: label.invalidationPrice === null ? null : stopBars !== null,
    outcomeFutureBarsToTarget: targetBars,
    outcomeFutureBarsToStop: stopBars
  });
}
