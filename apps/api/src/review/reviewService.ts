import { listTradeEvents } from "../labels/labelService.js";
import type { TradeEventDto } from "../labels/labelService.js";
import type { SqliteDatabase } from "../db/database.js";

type LabelType = TradeEventDto["labelType"];

type EntryExitPair = {
  entryId: string;
  exitId: string;
  ticker: string;
  entryTimestamp: string;
  exitTimestamp: string;
  entryPrice: number;
  exitPrice: number;
  returnPercent: number;
};

type IndicatorAverages = {
  count: number;
  smioOscillator: number | null;
  stochK: number | null;
  stochD: number | null;
  atr14Rma: number | null;
  ema25DistancePercent: number | null;
};

export type ReviewSummary = {
  totalLabels: number;
  counts: Record<LabelType, number>;
  confidenceDistribution: Record<string, number>;
  setupQualityDistribution: Record<string, number>;
  pairedTrades: {
    count: number;
    wins: number;
    losses: number;
    winRate: number | null;
    averageReturnPercent: number | null;
    pairs: EntryExitPair[];
  };
  conditionSummary: {
    entryReasonCodes: Record<string, number>;
    profitableReasonCodes: Record<string, number>;
    losingReasonCodes: Record<string, number>;
    skippedReasonCodes: Record<string, number>;
    invalidReasonCodes: Record<string, number>;
    entriesWithBreakoutMarker: number;
    entriesNearTrendline: number;
    entriesNearLevel: number;
  };
  indicatorAverages: {
    entries: IndicatorAverages;
    profitableEntries: IndicatorAverages;
    losingEntries: IndicatorAverages;
    skipped: IndicatorAverages;
  };
  lossClusters: {
    reasonCodes: Record<string, number>;
    worstPairs: EntryExitPair[];
  };
};

function emptyCounts(): Record<LabelType, number> {
  return {
    ENTRY: 0,
    EXIT: 0,
    SKIP: 0,
    INVALID: 0
  };
}

function oneToFiveDistribution(): Record<string, number> {
  return {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0
  };
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nestedNumber(value: unknown, path: string[]): number | null {
  let current: unknown = value;
  for (const key of path) {
    current = objectValue(current)[key];
  }

  return numberValue(current);
}

function average(values: number[]): number | null {
  return values.length === 0
    ? null
    : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function indicatorAverages(events: TradeEventDto[]): IndicatorAverages {
  const smioOscillator: number[] = [];
  const stochK: number[] = [];
  const stochD: number[] = [];
  const atr14Rma: number[] = [];
  const ema25DistancePercent: number[] = [];

  for (const event of events) {
    const indicator = objectValue(event.indicatorSnapshot);
    const smio = nestedNumber(indicator, ["smio", "oscillator"]);
    const k = nestedNumber(indicator, ["stochRsi", "k"]);
    const d = nestedNumber(indicator, ["stochRsi", "d"]);
    const atr = numberValue(indicator.atr14Rma);
    const ema25 = numberValue(indicator.ema25);

    if (smio !== null) {
      smioOscillator.push(smio);
    }
    if (k !== null) {
      stochK.push(k);
    }
    if (d !== null) {
      stochD.push(d);
    }
    if (atr !== null) {
      atr14Rma.push(atr);
    }
    if (ema25 !== null && event.price !== 0) {
      ema25DistancePercent.push(((event.price - ema25) / event.price) * 100);
    }
  }

  return {
    count: events.length,
    smioOscillator: average(smioOscillator),
    stochK: average(stochK),
    stochD: average(stochD),
    atr14Rma: average(atr14Rma),
    ema25DistancePercent: average(ema25DistancePercent)
  };
}

function buildPairs(events: TradeEventDto[]): EntryExitPair[] {
  const openEntriesByTradeId = new Map<string, TradeEventDto>();
  const openEntriesByTicker = new Map<string, TradeEventDto>();
  const pairs: EntryExitPair[] = [];

  for (const event of events) {
    if (event.labelType === "ENTRY") {
      openEntriesByTradeId.set(event.tradeId ?? event.id, event);
      openEntriesByTicker.set(event.ticker, event);
      continue;
    }

    if (event.labelType === "EXIT") {
      let entry = event.tradeId ? openEntriesByTradeId.get(event.tradeId) : undefined;
      if (!entry && event.parentLabelId) {
        entry = [...openEntriesByTradeId.values()].find((candidate) => candidate.id === event.parentLabelId);
      }
      if (!entry) {
        entry = openEntriesByTicker.get(event.ticker);
      }
      if (!entry) {
        continue;
      }

      pairs.push({
        entryId: entry.id,
        exitId: event.id,
        ticker: event.ticker,
        entryTimestamp: entry.timestamp,
        exitTimestamp: event.timestamp,
        entryPrice: entry.price,
        exitPrice: event.price,
        returnPercent: Number((((event.price - entry.price) / entry.price) * 100).toFixed(4))
      });
      for (const [key, candidate] of openEntriesByTradeId.entries()) {
        if (candidate.id === entry.id) {
          openEntriesByTradeId.delete(key);
        }
      }
      if (openEntriesByTicker.get(event.ticker)?.id === entry.id) {
        openEntriesByTicker.delete(event.ticker);
      }
    }
  }

  return pairs;
}

export function buildReviewSummary(db: SqliteDatabase, sessionId?: string): ReviewSummary {
  const events = listTradeEvents(db, { sessionId });
  const counts = emptyCounts();
  const confidenceDistribution = oneToFiveDistribution();
  const setupQualityDistribution = oneToFiveDistribution();
  const entryReasonCodes: Record<string, number> = {};
  const profitableReasonCodes: Record<string, number> = {};
  const losingReasonCodes: Record<string, number> = {};
  const skippedReasonCodes: Record<string, number> = {};
  const invalidReasonCodes: Record<string, number> = {};

  for (const event of events) {
    counts[event.labelType] += 1;
    increment(confidenceDistribution, String(event.confidence));
    increment(setupQualityDistribution, String(event.setupQuality));

    if (event.labelType === "ENTRY") {
      event.reasonCodes.forEach((reason) => increment(entryReasonCodes, reason));
    }

    if (event.labelType === "SKIP") {
      event.reasonCodes.forEach((reason) => increment(skippedReasonCodes, reason));
    }

    if (event.labelType === "INVALID") {
      event.reasonCodes.forEach((reason) => increment(invalidReasonCodes, reason));
    }
  }

  const pairs = buildPairs(events);
  const profitableEntryIds = new Set(
    pairs.filter((pair) => pair.returnPercent > 0).map((pair) => pair.entryId)
  );
  const losingPairs = pairs.filter((pair) => pair.returnPercent <= 0);
  const losingEntryIds = new Set(losingPairs.map((pair) => pair.entryId));

  let entriesWithBreakoutMarker = 0;
  let entriesNearTrendline = 0;
  let entriesNearLevel = 0;

  for (const event of events) {
    if (event.labelType !== "ENTRY") {
      continue;
    }

    if (profitableEntryIds.has(event.id)) {
      event.reasonCodes.forEach((reason) => increment(profitableReasonCodes, reason));
    }

    if (losingEntryIds.has(event.id)) {
      event.reasonCodes.forEach((reason) => increment(losingReasonCodes, reason));
    }

    const drawingContext = objectValue(event.drawingContext);
    if (objectValue(drawingContext.breakoutMarker).id) {
      entriesWithBreakoutMarker += 1;
    }

    const trendlineDistance = numberValue(objectValue(drawingContext.nearestTrendline).distance);
    if (trendlineDistance !== null && Math.abs(trendlineDistance) <= event.price * 0.02) {
      entriesNearTrendline += 1;
    }

    const levelDistance = numberValue(objectValue(drawingContext.nearestLevel).distance);
    if (levelDistance !== null && Math.abs(levelDistance) <= event.price * 0.02) {
      entriesNearLevel += 1;
    }
  }

  const wins = pairs.filter((pair) => pair.returnPercent > 0).length;
  const losses = pairs.filter((pair) => pair.returnPercent <= 0).length;
  const averageReturnPercent =
    pairs.length === 0
      ? null
      : Number(
          (pairs.reduce((sum, pair) => sum + pair.returnPercent, 0) / pairs.length).toFixed(4)
        );

  const entryEvents = events.filter((event) => event.labelType === "ENTRY");
  const profitableEntries = entryEvents.filter((event) => profitableEntryIds.has(event.id));
  const losingEntries = entryEvents.filter((event) => losingEntryIds.has(event.id));
  const skippedEvents = events.filter((event) => event.labelType === "SKIP");

  return {
    totalLabels: events.length,
    counts,
    confidenceDistribution,
    setupQualityDistribution,
    pairedTrades: {
      count: pairs.length,
      wins,
      losses,
      winRate: pairs.length === 0 ? null : Number((wins / pairs.length).toFixed(4)),
      averageReturnPercent,
      pairs
    },
    conditionSummary: {
      entryReasonCodes,
      profitableReasonCodes,
      losingReasonCodes,
      skippedReasonCodes,
      invalidReasonCodes,
      entriesWithBreakoutMarker,
      entriesNearTrendline,
      entriesNearLevel
    },
    indicatorAverages: {
      entries: indicatorAverages(entryEvents),
      profitableEntries: indicatorAverages(profitableEntries),
      losingEntries: indicatorAverages(losingEntries),
      skipped: indicatorAverages(skippedEvents)
    },
    lossClusters: {
      reasonCodes: losingReasonCodes,
      worstPairs: [...losingPairs].sort((left, right) => left.returnPercent - right.returnPercent).slice(0, 5)
    }
  };
}
