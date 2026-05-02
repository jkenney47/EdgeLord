export async function fetchHealth(): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json() as Promise<{ ok: boolean }>;
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4317";

export type ChartTimeframe = "2H" | "4H" | "1D";

export type ChartCandle = {
  ticker: string;
  timeframe: ChartTimeframe;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sourceBarCount: number;
};

export type IndicatorSnapshot = {
  ticker: string;
  timeframe: ChartTimeframe;
  timestamp: string;
  volume: number;
  volumeSma20: number | null;
  ema25: number | null;
  sma100: number | null;
  monthlyVwap: number | null;
  atr14Rma: number | null;
  smio: {
    erg: number | null;
    signal: number | null;
    oscillator: number | null;
  };
  stochRsi: {
    rsi: number | null;
    stoch: number | null;
    k: number | null;
    d: number | null;
  };
  cmWvf: {
    wvf: number | null;
    plot: number | null;
    upperBand: number | null;
    rangeHigh: number | null;
    filtered: boolean;
    filteredAggressive: boolean;
    alert1: boolean;
    alert2: boolean;
    alert3: boolean;
    alert4: boolean;
  };
};

export type TickerChartSeries = {
  ticker: string;
  timeframe: ChartTimeframe;
  candles: ChartCandle[];
  indicators: IndicatorSnapshot[];
};

export type SyncChartResponse = {
  timeframe: ChartTimeframe;
  tickers: string[];
  timestamps: string[];
  series: Record<string, TickerChartSeries>;
  warnings: Array<{
    code: "large_price_discontinuity";
    severity: "review" | "warning";
    classification: "leveraged_etf_volatility" | "session_gap" | "possible_bad_source_data";
    ticker: string;
    timeframe: ChartTimeframe;
    timestamp: string;
    previousTimestamp: string;
    closeToCloseReturnPercent: number;
    openGapPercent: number;
    message: string;
  }>;
};

export type ImportMarketDataRequest = {
  tickers: string[];
  startDate: string;
  endDate: string;
  baseTimeframe: "1Min" | "5Min";
  chunkDelayMs?: number;
};

export type ImportMarketDataResult = {
  importRunId: string;
  provider: string;
  tickers: string[];
  baseBarsInserted: number;
  aggregatedBarsInserted: number;
  alignedTimestamps: string[];
  warnings: string[];
};

export type DataCoverageSummary = {
  ticker: string;
  timeframe: ChartTimeframe;
  barCount: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  gapCount: number;
  largestGapDays: number;
};

export type DataCoverageGap = {
  ticker: string;
  timeframe: ChartTimeframe;
  previousTimestamp: string;
  timestamp: string;
  gapDays: number;
};

export type DataCoverageReport = {
  tickers: string[];
  timeframes: ChartTimeframe[];
  summaries: DataCoverageSummary[];
  gaps: DataCoverageGap[];
};

export type Session = {
  id: string;
  name: string;
  startTime: string;
  endTime: string | null;
  tickerFocus: string | null;
  timeframeFocus: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReasonCode =
  | "trendline_break"
  | "stoch_rsi_condition"
  | "ema_alignment"
  | "volatility_expansion"
  | "inverse_etf_confirmation"
  | "other";

export type LabelType = "ENTRY" | "EXIT" | "SKIP" | "INVALID";
export type DecisionPhase = "at_close" | "at_open" | "intrabar";
export type CaptureMode = "regular" | "replay";
export type LabelSource = "actual_trade" | "retrospective_replay" | "retrospective_hindsight";
export type DecisionRole = "setup_start" | "trigger" | "entry" | "management" | "exit" | "skip" | "invalid";
export type Bias = "long" | "short" | "neutral" | "unclear";
export type MarketBias = "bullish_semis" | "bearish_semis" | "neutral" | "unclear";
export type TradeDirection = "long_ticker" | "short_ticker" | "observe_only";
export type InstrumentRole = "primary" | "inverse_pair" | "confirmation";
export type PairedTickerRole = "confirmation" | "divergence" | "ignored" | "inverse_signal";
export type OutcomeStatus =
  | "not_computed"
  | "pending"
  | "computed"
  | "insufficient_future_bars"
  | "missing_exit"
  | "invalidated";

export type CreateSessionRequest = {
  name: string;
  tickerFocus?: string | null;
  timeframeFocus?: string | null;
  notes?: string | null;
};

export type CreateTradeEventRequest = {
  sessionId: string;
  timestamp: string;
  ticker: string;
  timeframe: ChartTimeframe;
  labelType: LabelType;
  price: number;
  confidence: number;
  setupQuality: number;
  reasonCodes: ReasonCode[];
  notes: string | null;
  decisionPhase?: DecisionPhase;
  captureMode?: CaptureMode;
  labelSource?: LabelSource;
  trainingEligible?: boolean;
  visibleUntilTimestamp?: string | null;
  potentialVisualLeakage?: boolean;
  selectedBarIndex?: number | null;
  setupId?: string | null;
  tradeId?: string | null;
  parentLabelId?: string | null;
  decisionRole?: DecisionRole;
  bias?: Bias;
  marketBias?: MarketBias;
  tradeDirection?: TradeDirection;
  instrumentRole?: InstrumentRole;
  pairedTickerRole?: PairedTickerRole;
  entryStyle?: string | null;
  exitStyle?: string | null;
  invalidationPrice?: number | null;
  targetPrice?: number | null;
  outcomeAvailable?: boolean;
  outcomeHorizonBars?: number | null;
  outcomeFutureReturn1?: number | null;
  outcomeFutureReturn3?: number | null;
  outcomeFutureReturn5?: number | null;
  outcomeFutureReturn10?: number | null;
  outcomeFutureMaxFavorableExcursion?: number | null;
  outcomeFutureMaxAdverseExcursion?: number | null;
  outcomeFutureHitTarget?: boolean | null;
  outcomeFutureHitStop?: boolean | null;
  outcomeFutureBarsToTarget?: number | null;
  outcomeFutureBarsToStop?: number | null;
  outcomeStatus?: OutcomeStatus;
  outcomeRuleVersion?: string | null;
  multiTimeframeContext?: unknown;
  indicatorSnapshot: unknown;
  structureSnapshot: unknown;
  drawingContext: unknown;
};

export type TradeEvent = CreateTradeEventRequest & {
  id: string;
  decisionPhase: DecisionPhase;
  captureMode: CaptureMode;
  labelSource: LabelSource;
  trainingEligible: boolean;
  visibleUntilTimestamp: string;
  potentialVisualLeakage: boolean;
  selectedBarIndex: number | null;
  setupId: string | null;
  tradeId: string | null;
  parentLabelId: string | null;
  decisionRole: DecisionRole;
  bias: Bias;
  marketBias: MarketBias;
  tradeDirection: TradeDirection;
  instrumentRole: InstrumentRole;
  pairedTickerRole: PairedTickerRole;
  entryStyle: string | null;
  exitStyle: string | null;
  invalidationPrice: number | null;
  targetPrice: number | null;
  outcomeAvailable: boolean;
  outcomeHorizonBars: number | null;
  outcomeFutureReturn1: number | null;
  outcomeFutureReturn3: number | null;
  outcomeFutureReturn5: number | null;
  outcomeFutureReturn10: number | null;
  outcomeFutureMaxFavorableExcursion: number | null;
  outcomeFutureMaxAdverseExcursion: number | null;
  outcomeFutureHitTarget: boolean | null;
  outcomeFutureHitStop: boolean | null;
  outcomeFutureBarsToTarget: number | null;
  outcomeFutureBarsToStop: number | null;
  outcomeStatus: OutcomeStatus;
  outcomeRuleVersion: string | null;
  multiTimeframeContext: unknown;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type UpdateTradeEventRequest = Partial<Omit<CreateTradeEventRequest, "sessionId">>;
export type CalculateOutcomeRequest = {
  horizonBars?: number;
};

export type DrawingAnchor = {
  timestamp: string;
  price: number;
};

export type Drawing = {
  id: string;
  sessionId: string | null;
  ticker: string;
  timeframe: ChartTimeframe;
  type: "trendline" | "horizontal_level" | "breakout_marker";
  anchors: DrawingAnchor[];
  style: unknown | null;
  slope: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateDrawingRequest = {
  sessionId?: string | null;
  ticker: string;
  timeframe: ChartTimeframe;
  type: "trendline" | "horizontal_level" | "breakout_marker";
  anchors: DrawingAnchor[];
  style?: unknown | null;
};

export type UpdateDrawingRequest = Partial<Omit<CreateDrawingRequest, "sessionId">>;

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
    pairs: Array<{
      entryId: string;
      exitId: string;
      ticker: string;
      entryTimestamp: string;
      exitTimestamp: string;
      entryPrice: number;
      exitPrice: number;
      returnPercent: number;
    }>;
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
  indicatorAverages: Record<
    "entries" | "profitableEntries" | "losingEntries" | "skipped",
    {
      count: number;
      smioOscillator: number | null;
      stochK: number | null;
      stochD: number | null;
      atr14Rma: number | null;
      ema25DistancePercent: number | null;
    }
  >;
  lossClusters: {
    reasonCodes: Record<string, number>;
    worstPairs: Array<{
      entryId: string;
      exitId: string;
      ticker: string;
      entryTimestamp: string;
      exitTimestamp: string;
      entryPrice: number;
      exitPrice: number;
      returnPercent: number;
    }>;
  };
};

export type ExportValidationIssue = {
  severity: "error" | "warning";
  code: string;
  labelId: string | null;
  message: string;
};

export type TradeEventsExportManifest = {
  schemaVersion: string;
  exportVersion: string;
  indicatorCalcVersion: string;
  structureCalcVersion: string;
  exportedAt: string;
  format: "json" | "csv";
  decisionFeatureExport: {
    outcomeFieldsIncluded: false;
  };
  outcomeFields: {
    classification: "evaluation_only";
    jsonIncluded: boolean;
    csvIncluded: boolean;
    ruleVersion: string;
  };
  filters: {
    sessionId: string | null;
  };
  qa: {
    status: "pass" | "warning" | "fail";
    blockers: number;
    warnings: number;
  };
  includedLabelTypes: Record<string, number>;
  rowCount: number;
};

export type ExportValidationReport = {
  status: "pass" | "warning" | "fail";
  summary: {
    totalLabels: number;
    errorCount: number;
    warningCount: number;
    labelsByTicker: Record<string, number>;
    labelsByTimeframe: Record<string, number>;
    labelsByLabelType: Record<string, number>;
    labelsByReplayMode: Record<string, number>;
    labelsByDecisionRole: Record<string, number>;
    labelsByBias: Record<string, number>;
    labelsByTradeDirection: Record<string, number>;
    labelsWithMissingPairedContext: number;
    labelsWithLeakageWarnings: number;
    labelsWithIncompleteIntent: number;
    labelsWithSetupId: number;
    labelsWithTradeId: number;
    labelsWithOutcomeAvailable: number;
    labelsByOutcomeStatus: Record<string, number>;
    outcomeRuleVersions: Record<string, number>;
    outcomeFieldsExcludedFromDecisionCsv: boolean;
  };
  issues: ExportValidationIssue[];
  manifest?: TradeEventsExportManifest;
};

export function tradeEventsExportUrl(format: "json" | "csv", sessionId?: string): string {
  const url = new URL(`${API_BASE_URL}/export/trade-events`);
  url.searchParams.set("format", format);

  if (sessionId) {
    url.searchParams.set("sessionId", sessionId);
  }

  return url.toString();
}

export function researchLabelsExportUrl(
  format: "csv" | "jsonl",
  sessionId?: string,
  includeFutureVisible = false
): string {
  const url = new URL(`${API_BASE_URL}/export/research-labels`);
  url.searchParams.set("format", format);

  if (sessionId) {
    url.searchParams.set("sessionId", sessionId);
  }

  if (includeFutureVisible) {
    url.searchParams.set("includeFutureVisible", "true");
  }

  return url.toString();
}

export function pairedTradesExportUrl(sessionId?: string, includeIneligible = false): string {
  const url = new URL(`${API_BASE_URL}/export/paired-trades`);

  if (sessionId) {
    url.searchParams.set("sessionId", sessionId);
  }

  if (includeIneligible) {
    url.searchParams.set("includeIneligible", "true");
  }

  return url.toString();
}

export function trainingFeaturesExportUrl(sessionId?: string): string {
  const url = new URL(`${API_BASE_URL}/export/training-features`);

  if (sessionId) {
    url.searchParams.set("sessionId", sessionId);
  }

  return url.toString();
}

export async function fetchExportValidationReport(
  sessionId?: string
): Promise<ExportValidationReport> {
  const url = new URL(`${API_BASE_URL}/export/trade-events/validation`);

  if (sessionId) {
    url.searchParams.set("sessionId", sessionId);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Export validation request failed: ${response.status}`);
  }

  return response.json() as Promise<ExportValidationReport>;
}

export async function fetchSynchronizedChartData(
  tickers = ["SOXL", "SOXS"],
  timeframe: ChartTimeframe = "4H"
): Promise<SyncChartResponse> {
  const url = new URL(`${API_BASE_URL}/chart/sync`);
  url.searchParams.set("timeframe", timeframe);
  url.searchParams.set("tickers", tickers.join(","));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Chart sync request failed: ${response.status}`);
  }

  return response.json() as Promise<SyncChartResponse>;
}

export async function fetchDataCoverage(
  tickers = ["SOXL", "SOXS"],
  timeframes: ChartTimeframe[] = ["1D", "4H", "2H"]
): Promise<DataCoverageReport> {
  const url = new URL(`${API_BASE_URL}/chart/coverage`);
  url.searchParams.set("tickers", tickers.join(","));
  url.searchParams.set("timeframes", timeframes.join(","));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Data coverage request failed: ${response.status}`);
  }

  return response.json() as Promise<DataCoverageReport>;
}

export async function importMarketData(
  request: ImportMarketDataRequest
): Promise<ImportMarketDataResult> {
  const response = await fetch(`${API_BASE_URL}/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Import request failed: ${response.status}`);
  }

  return response.json() as Promise<ImportMarketDataResult>;
}

export async function createSession(request: CreateSessionRequest): Promise<Session> {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Session create request failed: ${response.status}`);
  }

  return response.json() as Promise<Session>;
}

export async function listSessions(): Promise<Session[]> {
  const response = await fetch(`${API_BASE_URL}/sessions`);

  if (!response.ok) {
    throw new Error(`Session list request failed: ${response.status}`);
  }

  return response.json() as Promise<Session[]>;
}

export async function endSession(id: string): Promise<Session> {
  const response = await fetch(`${API_BASE_URL}/sessions/${id}/end`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Session end request failed: ${response.status}`);
  }

  return response.json() as Promise<Session>;
}

export async function createTradeEvent(request: CreateTradeEventRequest): Promise<TradeEvent> {
  const response = await fetch(`${API_BASE_URL}/labels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Label create request failed: ${response.status}`);
  }

  return response.json() as Promise<TradeEvent>;
}

export async function listTradeEvents(sessionId?: string): Promise<TradeEvent[]> {
  const url = new URL(`${API_BASE_URL}/labels`);
  if (sessionId) {
    url.searchParams.set("sessionId", sessionId);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Label list request failed: ${response.status}`);
  }

  return response.json() as Promise<TradeEvent[]>;
}

export async function updateTradeEvent(
  id: string,
  request: UpdateTradeEventRequest
): Promise<TradeEvent> {
  const response = await fetch(`${API_BASE_URL}/labels/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Label update request failed: ${response.status}`);
  }

  return response.json() as Promise<TradeEvent>;
}

export async function deleteTradeEvent(id: string): Promise<TradeEvent> {
  const response = await fetch(`${API_BASE_URL}/labels/${id}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(`Label delete request failed: ${response.status}`);
  }

  return response.json() as Promise<TradeEvent>;
}

export async function calculateLabelOutcome(
  id: string,
  request: CalculateOutcomeRequest = {}
): Promise<TradeEvent> {
  const response = await fetch(`${API_BASE_URL}/labels/${id}/outcome`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Outcome calculation failed: ${response.status}`);
  }

  return response.json() as Promise<TradeEvent>;
}

export async function fetchReviewSummary(sessionId?: string): Promise<ReviewSummary> {
  const url = new URL(`${API_BASE_URL}/review/summary`);

  if (sessionId) {
    url.searchParams.set("sessionId", sessionId);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Review summary request failed: ${response.status}`);
  }

  return response.json() as Promise<ReviewSummary>;
}

export async function createDrawing(request: CreateDrawingRequest): Promise<Drawing> {
  const response = await fetch(`${API_BASE_URL}/drawings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Drawing create request failed: ${response.status}`);
  }

  return response.json() as Promise<Drawing>;
}

export async function listDrawings(ticker: string, timeframe: ChartTimeframe = "4H"): Promise<Drawing[]> {
  const url = new URL(`${API_BASE_URL}/drawings`);
  url.searchParams.set("ticker", ticker);
  url.searchParams.set("timeframe", timeframe);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Drawing list request failed: ${response.status}`);
  }

  return response.json() as Promise<Drawing[]>;
}

export async function updateDrawing(id: string, request: UpdateDrawingRequest): Promise<Drawing> {
  const response = await fetch(`${API_BASE_URL}/drawings/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Drawing update request failed: ${response.status}`);
  }

  return response.json() as Promise<Drawing>;
}

export async function deleteDrawing(id: string): Promise<Drawing> {
  const response = await fetch(`${API_BASE_URL}/drawings/${id}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(`Drawing delete request failed: ${response.status}`);
  }

  return response.json() as Promise<Drawing>;
}
