import { create } from "zustand";

import {
  calculateLabelOutcome,
  createSession,
  createTradeEvent,
  createDrawing,
  deleteDrawing,
  deleteTradeEvent,
  fetchDataCoverage,
  endSession,
  fetchExportValidationReport,
  fetchReviewSummary,
  fetchSynchronizedChartData,
  importMarketData,
  listSessions,
  listTradeEvents,
  listDrawings,
  updateDrawing,
  updateTradeEvent
} from "../api/client";
import type {
  Bias,
  ChartCandle,
  ChartTimeframe,
  CreateDrawingRequest,
  CreateSessionRequest,
  CreateTradeEventRequest,
  DataCoverageReport,
  DecisionRole,
  Drawing,
  DrawingAnchor,
  ImportMarketDataRequest,
  ImportMarketDataResult,
  ExportValidationReport,
  InstrumentRole,
  LabelSource,
  LabelType,
  MarketBias,
  PairedTickerRole,
  ReasonCode,
  ReviewSummary,
  Session,
  SyncChartResponse,
  TickerChartSeries,
  TradeDirection,
  TradeEvent,
  UpdateTradeEventRequest
} from "../api/client";

export type AppMode = "regular" | "replay";
export type ChartLayoutMode = "grid" | "focused";
export type ChartInteractionMode = "cursor" | "pan";

export type SelectedCandle = {
  ticker: string;
  timeframe?: ChartTimeframe;
  timestamp: string;
};

export type FocusedTicker = "SOXL" | "SOXS";

export type SubmitLabelInput = {
  labelType: LabelType;
  confidence: number;
  setupQuality: number;
  reasonCodes: ReasonCode[];
  notes: string | null;
  setupId?: string | null;
  tradeId?: string | null;
  parentLabelId?: string | null;
  labelSource?: LabelSource;
  trainingEligible?: boolean;
  decisionRole?: DecisionRole;
  bias?: Bias;
  tradeDirection?: TradeDirection;
};

function defaultDecisionRole(labelType: LabelType): DecisionRole {
  if (labelType === "ENTRY") {
    return "entry";
  }
  if (labelType === "EXIT") {
    return "exit";
  }
  if (labelType === "SKIP") {
    return "skip";
  }
  return "invalid";
}

export type DrawingTool = "trendline" | "horizontal_level" | "breakout_marker";

export type DrawingModeState = {
  ticker: string;
  timeframe: ChartTimeframe;
  type: DrawingTool;
  firstAnchor: DrawingAnchor | null;
} | null;

export const chartGridTimeframes: ChartTimeframe[] = ["1D", "4H", "2H"];
const activeSessionStorageKey = "edgelord.activeSessionId";

function readRememberedSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(activeSessionStorageKey);
  } catch {
    return null;
  }
}

function rememberActiveSession(sessionId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(activeSessionStorageKey, sessionId);
  } catch {
    // Local storage is a convenience only; labeling should still work if unavailable.
  }
}

function forgetActiveSession(sessionId?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const rememberedSessionId = window.localStorage.getItem(activeSessionStorageKey);
    if (!sessionId || rememberedSessionId === sessionId) {
      window.localStorage.removeItem(activeSessionStorageKey);
    }
  } catch {
    // Ignore unavailable storage.
  }
}

export type AppState = {
  mode: AppMode;
  replayIndex: number;
  replaySpeedMs: number;
  isReplayPlaying: boolean;
  replayStartDate: string;
  replayDateInput: string;
  replayDateError: string | null;
  chartLayoutMode: ChartLayoutMode;
  chartInteractionMode: ChartInteractionMode;
  activeTimeframe: ChartTimeframe;
  focusedTicker: FocusedTicker;
  selectedCandle: SelectedCandle | null;
  syncData: SyncChartResponse | null;
  syncDataByTimeframe: Partial<Record<ChartTimeframe, SyncChartResponse>>;
  activeSession: Session | null;
  drawings: Drawing[];
  drawingMode: DrawingModeState;
  selectedDrawingId: string | null;
  drawingStatus: string | null;
  isLoadingChartData: boolean;
  chartDataError: string | null;
  isImporting: boolean;
  importError: string | null;
  importStartDate: string;
  importEndDate: string;
  importBaseTimeframe: "1Min" | "5Min";
  dataCoverage: DataCoverageReport | null;
  isSavingLabel: boolean;
  labelError: string | null;
  labelStatus: string | null;
  sessions: Session[];
  sessionError: string | null;
  sessionLabels: TradeEvent[];
  selectedLabelId: string | null;
  reviewSummary: ReviewSummary | null;
  exportValidationReport: ExportValidationReport | null;
  reviewError: string | null;
  lastCreatedLabelId: string | null;
  lastImportResult: ImportMarketDataResult | null;
  fetchSynchronizedChartData: typeof fetchSynchronizedChartData;
  fetchDataCoverage: typeof fetchDataCoverage;
  importMarketData: typeof importMarketData;
  createSession: typeof createSession;
  listSessions: typeof listSessions;
  endSession: typeof endSession;
  createTradeEvent: typeof createTradeEvent;
  createDrawing: typeof createDrawing;
  listDrawings: typeof listDrawings;
  fetchExportValidationReport: typeof fetchExportValidationReport;
  fetchReviewSummary: typeof fetchReviewSummary;
  updateDrawing: typeof updateDrawing;
  deleteDrawing: typeof deleteDrawing;
  updateTradeEvent: typeof updateTradeEvent;
  deleteTradeEvent: typeof deleteTradeEvent;
  calculateLabelOutcome: typeof calculateLabelOutcome;
  listTradeEvents: typeof listTradeEvents;
  setMode: (mode: AppMode) => void;
  setActiveTimeframe: (timeframe: ChartTimeframe) => Promise<void>;
  stepForward: () => void;
  setReplayPlaying: (isPlaying: boolean) => void;
  setReplayStartDate: (date: string) => void;
  setReplaySpeedMs: (speedMs: number) => void;
  setChartLayoutMode: (mode: ChartLayoutMode) => void;
  setChartInteractionMode: (mode: ChartInteractionMode) => void;
  focusChartPanel: (ticker: FocusedTicker, timeframe: ChartTimeframe) => Promise<void>;
  setFocusedTicker: (ticker: FocusedTicker) => void;
  loadSessions: () => Promise<void>;
  startSession: (request?: Partial<CreateSessionRequest>) => Promise<void>;
  resumeSession: (session: Session) => Promise<void>;
  endActiveSession: () => Promise<void>;
  selectCandle: (selection: SelectedCandle | null) => void;
  moveSelectedCandle: (direction: -1 | 1) => void;
  focusLabel: (label: TradeEvent) => Promise<void>;
  focusAdjacentLabel: (direction: -1 | 1) => Promise<void>;
  focusNextValidationIssue: (direction: -1 | 1) => Promise<void>;
  clearSelectedLabel: () => void;
  selectDrawing: (drawingId: string | null) => void;
  cancelDrawingMode: () => void;
  startTrendline: (ticker: string) => void;
  startHorizontalLevel: (ticker: string) => void;
  startBreakoutMarker: (ticker: string) => void;
  handleChartCandleClick: (ticker: string, candle: ChartCandle) => Promise<void>;
  moveTrendlineAnchor: (drawingId: string, anchorIndex: 0 | 1, anchor: DrawingAnchor) => Promise<void>;
  deleteSelectedDrawing: () => Promise<void>;
  loadChartData: () => Promise<void>;
  loadReviewSummary: (sessionId?: string) => Promise<void>;
  loadExportValidationReport: (sessionId?: string) => Promise<void>;
  setImportStartDate: (date: string) => void;
  setImportEndDate: (date: string) => void;
  setImportBaseTimeframe: (timeframe: "1Min" | "5Min") => void;
  runImport: () => Promise<void>;
  submitLabel: (input: SubmitLabelInput) => Promise<void>;
  updateLabel: (labelId: string, input: UpdateTradeEventRequest) => Promise<boolean>;
  calculateOutcome: (labelId?: string) => Promise<boolean>;
  deleteLabel: (labelId: string) => Promise<boolean>;
};

export function createInitialState(): Pick<
  AppState,
  | "mode"
  | "replayIndex"
  | "replaySpeedMs"
  | "isReplayPlaying"
  | "replayStartDate"
  | "replayDateInput"
  | "replayDateError"
  | "chartLayoutMode"
  | "chartInteractionMode"
  | "activeTimeframe"
  | "focusedTicker"
  | "selectedCandle"
  | "syncData"
  | "syncDataByTimeframe"
  | "activeSession"
  | "drawings"
  | "drawingMode"
  | "selectedDrawingId"
  | "drawingStatus"
  | "isLoadingChartData"
  | "chartDataError"
  | "isImporting"
  | "importError"
  | "importStartDate"
  | "importEndDate"
  | "importBaseTimeframe"
  | "dataCoverage"
  | "isSavingLabel"
  | "labelError"
  | "labelStatus"
  | "sessions"
  | "sessionError"
  | "sessionLabels"
  | "selectedLabelId"
  | "reviewSummary"
  | "exportValidationReport"
  | "reviewError"
  | "lastCreatedLabelId"
  | "lastImportResult"
> {
  return {
    mode: "replay",
    replayIndex: 0,
    replaySpeedMs: 500,
    isReplayPlaying: false,
    replayStartDate: "",
    replayDateInput: "",
    replayDateError: null,
    chartLayoutMode: "focused",
    chartInteractionMode: "cursor",
    activeTimeframe: "4H",
    focusedTicker: "SOXL",
    selectedCandle: null,
    syncData: null,
    syncDataByTimeframe: {},
    activeSession: null,
    drawings: [],
    drawingMode: null,
    selectedDrawingId: null,
    drawingStatus: null,
    isLoadingChartData: false,
    chartDataError: null,
    isImporting: false,
    importError: null,
    importStartDate: "2024-01-01",
    importEndDate: new Date().toISOString().slice(0, 10),
    importBaseTimeframe: "5Min",
    dataCoverage: null,
    isSavingLabel: false,
    labelError: null,
    labelStatus: null,
    sessions: [],
    sessionError: null,
    sessionLabels: [],
    selectedLabelId: null,
    reviewSummary: null,
    exportValidationReport: null,
    reviewError: null,
    lastCreatedLabelId: null,
    lastImportResult: null
  };
}

export function visibleCandlesForMode(
  candles: ChartCandle[],
  mode: AppMode,
  replayIndex: number
): ChartCandle[] {
  if (mode === "regular") {
    return candles;
  }

  return candles.slice(0, Math.min(replayIndex + 1, candles.length));
}

function chronologicalLabels(labels: TradeEvent[]): TradeEvent[] {
  return [...labels].sort((left, right) => {
    const timestampDelta = Date.parse(left.timestamp) - Date.parse(right.timestamp);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    const tickerDelta = left.ticker.localeCompare(right.ticker);
    if (tickerDelta !== 0) {
      return tickerDelta;
    }

    const timeframeDelta = left.timeframe.localeCompare(right.timeframe);
    if (timeframeDelta !== 0) {
      return timeframeDelta;
    }

    const createdDelta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (createdDelta !== 0) {
      return createdDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function adjacentIndex(currentIndex: number, length: number, direction: -1 | 1): number {
  if (currentIndex < 0) {
    return direction > 0 ? 0 : length - 1;
  }

  return (currentIndex + direction + length) % length;
}

export function visibleCandlesForReplayBoundary(
  candles: ChartCandle[],
  mode: AppMode,
  replayBoundaryTimestamp: string | null
): ChartCandle[] {
  if (mode === "regular" || !replayBoundaryTimestamp) {
    return candles;
  }

  return candles.filter((candle) => candle.timestamp <= replayBoundaryTimestamp);
}

export type SelectedCandleContext = {
  candle: ChartCandle;
  candleIndex: number;
  indicator: TickerChartSeries["indicators"][number] | null;
  pairedTicker: {
    ticker: string;
    candle: ChartCandle | null;
    indicator: TickerChartSeries["indicators"][number] | null;
    structureSnapshot: SelectedCandleContext["structureSnapshot"] | null;
  } | null;
  structureSnapshot: {
    recentCandles: ChartCandle[];
    recentHigh: number;
    recentLow: number;
    distanceToRecentHigh: number;
    distanceToRecentLow: number;
  };
};

type MultiTimeframeSnapshotItem = {
  timeframe: ChartTimeframe;
  timestamp: string | null;
  contextAgeMinutes: number | null;
  candle: ChartCandle | null;
  indicator: TickerChartSeries["indicators"][number] | null;
  structureSnapshot: SelectedCandleContext["structureSnapshot"] | null;
};

export type MultiTimeframeContextSnapshot = {
  d1: MultiTimeframeSnapshotItem;
  h4: MultiTimeframeSnapshotItem;
  h2: MultiTimeframeSnapshotItem;
};

const multiTimeframeKeys: Array<{ key: keyof MultiTimeframeContextSnapshot; timeframe: ChartTimeframe }> = [
  { key: "d1", timeframe: "1D" },
  { key: "h4", timeframe: "4H" },
  { key: "h2", timeframe: "2H" }
];

export function selectedCandleContext(
  state: Pick<AppState, "selectedCandle" | "syncData"> &
    Partial<Pick<AppState, "activeTimeframe" | "syncDataByTimeframe">>
): SelectedCandleContext | null {
  if (!state.selectedCandle) {
    return null;
  }

  const timeframe =
    state.selectedCandle.timeframe ?? state.activeTimeframe ?? state.syncData?.timeframe ?? "4H";
  const syncData = state.syncDataByTimeframe?.[timeframe] ?? state.syncData;
  if (!syncData) {
    return null;
  }

  const series = syncData.series[state.selectedCandle.ticker];
  const candle = series?.candles.find((bar) => bar.timestamp === state.selectedCandle?.timestamp);

  if (!series || !candle) {
    return null;
  }

  const indicator = series.indicators.find((item) => item.timestamp === candle.timestamp) ?? null;
  const candleIndex = series.candles.findIndex((bar) => bar.timestamp === candle.timestamp);
  const recentCandles = series.candles.slice(Math.max(candleIndex - 19, 0), candleIndex + 1);
  const pairedTickerName =
    syncData.tickers.find((ticker) => ticker !== state.selectedCandle?.ticker) ?? null;
  const pairedSeries = pairedTickerName ? syncData.series[pairedTickerName] : null;
  const pairedCandle =
    pairedSeries?.candles.find((bar) => bar.timestamp === candle.timestamp) ?? null;
  const pairedIndicator =
    pairedSeries?.indicators.find((item) => item.timestamp === candle.timestamp) ?? null;
  const pairedCandleIndex =
    pairedSeries?.candles.findIndex((bar) => bar.timestamp === candle.timestamp) ?? -1;
  const recentHigh = Math.max(...recentCandles.map((bar) => bar.high));
  const recentLow = Math.min(...recentCandles.map((bar) => bar.low));

  return {
    candle,
    candleIndex,
    indicator,
    pairedTicker: pairedTickerName
      ? {
          ticker: pairedTickerName,
          candle: pairedCandle,
          indicator: pairedIndicator,
          structureSnapshot:
            pairedCandle && pairedSeries && pairedCandleIndex >= 0
              ? structureSnapshotForSeries(pairedCandle, pairedCandleIndex, pairedSeries)
              : null
        }
      : null,
    structureSnapshot: {
      recentCandles,
      recentHigh,
      recentLow,
      distanceToRecentHigh: Number((recentHigh - candle.close).toFixed(4)),
      distanceToRecentLow: Number((candle.close - recentLow).toFixed(4))
    }
  };
}

function structureSnapshotForSeries(
  candle: ChartCandle,
  candleIndex: number,
  series: TickerChartSeries
): SelectedCandleContext["structureSnapshot"] {
  const recentCandles = series.candles.slice(Math.max(candleIndex - 19, 0), candleIndex + 1);
  const recentHigh = Math.max(...recentCandles.map((bar) => bar.high));
  const recentLow = Math.min(...recentCandles.map((bar) => bar.low));

  return {
    recentCandles,
    recentHigh,
    recentLow,
    distanceToRecentHigh: Number((recentHigh - candle.close).toFixed(4)),
    distanceToRecentLow: Number((candle.close - recentLow).toFixed(4))
  };
}

function minutesBetween(leftTimestamp: string, rightTimestamp: string): number | null {
  const left = new Date(leftTimestamp).getTime();
  const right = new Date(rightTimestamp).getTime();

  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }

  return Math.max(0, Math.round((left - right) / 60_000));
}

export function multiTimeframeContextSnapshot(
  state: Pick<AppState, "syncData" | "syncDataByTimeframe">,
  ticker: string,
  visibleUntilTimestamp: string
): MultiTimeframeContextSnapshot {
  return multiTimeframeKeys.reduce((snapshot, { key, timeframe }) => {
    const syncData = state.syncDataByTimeframe[timeframe] ?? (state.syncData?.timeframe === timeframe ? state.syncData : null);
    const series = syncData?.series[ticker] ?? null;
    const candleIndex =
      series?.candles.reduce(
        (latestIndex, bar, index) => (bar.timestamp <= visibleUntilTimestamp ? index : latestIndex),
        -1
      ) ?? -1;
    const candle = candleIndex >= 0 ? (series?.candles[candleIndex] ?? null) : null;
    const indicator = candle
      ? (series?.indicators.find((item) => item.timestamp === candle.timestamp) ?? null)
      : null;

    snapshot[key] = {
      timeframe,
      timestamp: candle?.timestamp ?? null,
      contextAgeMinutes: candle ? minutesBetween(visibleUntilTimestamp, candle.timestamp) : null,
      candle,
      indicator,
      structureSnapshot: candle && series ? structureSnapshotForSeries(candle, candleIndex, series) : null
    };

    return snapshot;
  }, {} as MultiTimeframeContextSnapshot);
}

function trendlinePriceAt(drawing: Drawing, timestamp: string): number | null {
  if (drawing.type !== "trendline" || drawing.anchors.length < 2) {
    return null;
  }

  const [start, end] = drawing.anchors;
  const startTime = new Date(start.timestamp).getTime();
  const endTime = new Date(end.timestamp).getTime();
  const targetTime = new Date(timestamp).getTime();

  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    !Number.isFinite(targetTime) ||
    endTime === startTime
  ) {
    return null;
  }

  const progress = (targetTime - startTime) / (endTime - startTime);
  return start.price + (end.price - start.price) * progress;
}

function nearestByDistance<T extends { distance: number }>(items: T[]): T | null {
  return [...items].sort((left, right) => Math.abs(left.distance) - Math.abs(right.distance))[0] ?? null;
}

function defaultImportStartDate(): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

export function drawingContextForCandle(candle: ChartCandle, drawings: Drawing[]) {
  const scopedDrawings = drawings.filter(
    (drawing) => drawing.ticker === candle.ticker && drawing.timeframe === candle.timeframe
  );
  const trendlines = scopedDrawings
    .filter((drawing) => drawing.type === "trendline")
    .map((drawing) => {
      const linePrice = trendlinePriceAt(drawing, candle.timestamp);
      if (linePrice === null) {
        return null;
      }

      return {
        id: drawing.id,
        anchors: drawing.anchors,
        priceAtTimestamp: Number(linePrice.toFixed(4)),
        distance: Number((candle.close - linePrice).toFixed(4)),
        slope: drawing.slope
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const breakoutMarker =
    scopedDrawings.find(
      (drawing) =>
        drawing.type === "breakout_marker" &&
        drawing.anchors.some((anchor) => anchor.timestamp === candle.timestamp)
    ) ?? null;

  return {
    nearestTrendline: nearestByDistance(trendlines),
    nearestLevel: null,
    breakoutMarker: breakoutMarker
      ? {
          id: breakoutMarker.id,
          anchors: breakoutMarker.anchors
        }
      : null
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  ...createInitialState(),
  fetchSynchronizedChartData,
  fetchDataCoverage,
  importMarketData,
  createSession,
  listSessions,
  endSession,
  createTradeEvent,
  createDrawing,
  listDrawings,
  fetchExportValidationReport,
  fetchReviewSummary,
  updateDrawing,
  deleteDrawing,
  updateTradeEvent,
  deleteTradeEvent,
  calculateLabelOutcome,
  listTradeEvents,
  setMode: (mode) => {
    const { replayIndex, selectedCandle, syncData } = get();
    const replayTimestamp = syncData?.timestamps[replayIndex] ?? null;
    set({
      mode,
      selectedCandle:
        mode === "replay" && replayTimestamp && !selectedCandle
          ? {
              ticker: syncData?.tickers[0] ?? "SOXL",
              timeframe: syncData?.timeframe ?? get().activeTimeframe,
              timestamp: replayTimestamp
            }
          : selectedCandle,
      isReplayPlaying: mode === "replay" ? get().isReplayPlaying : false
    });
  },
  setActiveTimeframe: async (timeframe) => {
    set({
      activeTimeframe: timeframe,
      syncData: get().syncDataByTimeframe[timeframe] ?? get().syncData,
      selectedCandle: null,
      selectedDrawingId: null,
      selectedLabelId: null,
      labelStatus: null,
      drawingMode: null,
      drawingStatus: null
    });
    if (!get().syncDataByTimeframe[timeframe]) {
      await get().loadChartData();
    }
  },
  stepForward: () => {
    const { selectedCandle, syncData, replayIndex } = get();
    const maxIndex = Math.max((syncData?.timestamps.length ?? 1) - 1, 0);
    const nextIndex = Math.min(replayIndex + 1, maxIndex);
    const nextTimestamp = syncData?.timestamps[nextIndex] ?? null;
    set({
      replayIndex: nextIndex,
      selectedCandle:
        syncData && nextTimestamp
          ? {
              ticker: selectedCandle?.ticker ?? syncData.tickers[0],
              timeframe: syncData.timeframe,
              timestamp: nextTimestamp
            }
          : selectedCandle,
      selectedDrawingId: null,
      selectedLabelId: null,
      labelStatus: null,
      drawingStatus: null,
      isReplayPlaying: nextIndex < maxIndex ? get().isReplayPlaying : false
    });
  },
  setReplayPlaying: (isReplayPlaying) => {
    const { mode, replayIndex, syncData } = get();
    const maxIndex = Math.max((syncData?.timestamps.length ?? 1) - 1, 0);
    set({
      mode: isReplayPlaying ? "replay" : mode,
      isReplayPlaying: isReplayPlaying && replayIndex < maxIndex
    });
  },
  setReplayStartDate: (replayDateInput) => {
    const trimmed = replayDateInput.trim();
    const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const slashDateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    let replayStartDate = "";

    if (trimmed) {
      const year = isoDateMatch?.[1] ?? slashDateMatch?.[3];
      const month = isoDateMatch?.[2] ?? slashDateMatch?.[1]?.padStart(2, "0");
      const day = isoDateMatch?.[3] ?? slashDateMatch?.[2]?.padStart(2, "0");
      replayStartDate = year && month && day ? `${year}-${month}-${day}` : "";
      const parsedDate = replayStartDate ? new Date(`${replayStartDate}T00:00:00.000Z`) : null;
      const isValidDate =
        Boolean(parsedDate) &&
        !Number.isNaN(parsedDate?.getTime()) &&
        parsedDate?.toISOString().slice(0, 10) === replayStartDate;

      if (!isValidDate) {
        set({
          replayDateInput,
          replayDateError: "Enter a valid date as YYYY-MM-DD or MM/DD/YYYY.",
          isReplayPlaying: false
        });
        return;
      }
    }

    if (!trimmed) {
      set({
        replayStartDate: "",
        replayDateInput: "",
        replayDateError: null,
        isReplayPlaying: false
      });
      return;
    }

    const timestamps = get().syncData?.timestamps ?? [];
    const matchingIndex = timestamps.findIndex((timestamp) => timestamp.slice(0, 10) >= replayStartDate);

    if (matchingIndex < 0) {
      set({
        replayDateInput,
        replayDateError: "No candle exists on or after that replay start date.",
        isReplayPlaying: false
      });
      return;
    }

    set({
      replayStartDate,
      replayDateInput,
      replayDateError: null,
      replayIndex: matchingIndex,
      mode: replayStartDate ? "replay" : get().mode,
      isReplayPlaying: false,
      selectedCandle:
        timestamps[matchingIndex]
          ? {
              ticker: get().syncData?.tickers[0] ?? "SOXL",
              timeframe: get().syncData?.timeframe ?? get().activeTimeframe,
              timestamp: timestamps[matchingIndex]
            }
          : null,
      selectedDrawingId: null,
      selectedLabelId: null,
      labelStatus: null,
      drawingStatus: null
    });
  },
  setReplaySpeedMs: (speedMs) => {
    set({ replaySpeedMs: speedMs });
  },
  setChartLayoutMode: (chartLayoutMode) => {
    set({ chartLayoutMode });
  },
  setChartInteractionMode: (chartInteractionMode) => {
    set({
      chartInteractionMode,
      drawingMode: null,
      selectedDrawingId: null,
      drawingStatus:
        chartInteractionMode === "pan" ? "Pan mode active. Drag the chart to move it." : null
    });
  },
  focusChartPanel: async (ticker, timeframe) => {
    set({
      focusedTicker: ticker,
      activeTimeframe: timeframe,
      syncData: get().syncDataByTimeframe[timeframe] ?? get().syncData,
      drawingMode:
        get().drawingMode?.ticker === ticker && get().drawingMode?.timeframe === timeframe
          ? get().drawingMode
          : null,
      drawingStatus: null
    });
    if (!get().syncDataByTimeframe[timeframe]) {
      await get().loadChartData();
    }
  },
  setFocusedTicker: (focusedTicker) => {
    set({ focusedTicker });
  },
  loadSessions: async () => {
    try {
      const sessions = await get().listSessions();
      set({
        sessions,
        sessionError: null
      });
      if (!get().activeSession) {
        const rememberedSessionId = readRememberedSessionId();
        const resumableSession =
          sessions.find((session) => !session.endTime && session.id === rememberedSessionId) ??
          sessions.find((session) => !session.endTime);
        if (resumableSession) {
          await get().resumeSession(resumableSession);
        }
      }
    } catch (error) {
      set({
        sessionError: error instanceof Error ? error.message : "Unable to load sessions"
      });
    }
  },
  startSession: async (request = {}) => {
    try {
      const session = await get().createSession({
        name: request.name ?? `Session ${new Date().toLocaleString()}`,
        tickerFocus: request.tickerFocus ?? null,
        timeframeFocus: request.timeframeFocus ?? "4H",
        notes: request.notes ?? null
      });
      const sessions = await get().listSessions();
      const reviewSummary = await get().fetchReviewSummary(session.id);
      const exportValidationReport = await get().fetchExportValidationReport(session.id);
      rememberActiveSession(session.id);
      set({
        activeSession: session,
        sessions,
        sessionLabels: [],
        selectedLabelId: null,
        reviewSummary,
        exportValidationReport,
        sessionError: null,
        reviewError: null,
        lastCreatedLabelId: null,
        labelStatus: null,
        drawingStatus: null
      });
    } catch (error) {
      set({
        sessionError: error instanceof Error ? error.message : "Unable to start session"
      });
    }
  },
  resumeSession: async (session) => {
    try {
      const sessionLabels = await get().listTradeEvents(session.id);
      const reviewSummary = await get().fetchReviewSummary(session.id);
      const exportValidationReport = await get().fetchExportValidationReport(session.id);
      rememberActiveSession(session.id);
      set({
        activeSession: session,
        sessionLabels,
        selectedLabelId: null,
        reviewSummary,
        exportValidationReport,
        sessionError: null,
        reviewError: null,
        lastCreatedLabelId: null,
        labelStatus: null,
        drawingStatus: null
      });
    } catch (error) {
      set({
        sessionError: error instanceof Error ? error.message : "Unable to resume session"
      });
    }
  },
  endActiveSession: async () => {
    const session = get().activeSession;
    if (!session) {
      return;
    }

    try {
      await get().endSession(session.id);
      forgetActiveSession(session.id);
      const sessions = await get().listSessions();
      const reviewSummary = await get().fetchReviewSummary();
      const exportValidationReport = await get().fetchExportValidationReport();
      set({
        activeSession: null,
        sessions,
        sessionLabels: [],
        selectedLabelId: null,
        reviewSummary,
        exportValidationReport,
        sessionError: null,
        reviewError: null,
        lastCreatedLabelId: null,
        labelStatus: null,
        drawingStatus: null
      });
    } catch (error) {
      set({
        sessionError: error instanceof Error ? error.message : "Unable to end session"
      });
    }
  },
  selectCandle: (selection) => {
    set({
      selectedCandle: selection,
      activeTimeframe: selection?.timeframe ?? get().activeTimeframe,
      syncData:
        selection?.timeframe && get().syncDataByTimeframe[selection.timeframe]
          ? get().syncDataByTimeframe[selection.timeframe]
          : get().syncData,
      focusedTicker:
        selection?.ticker === "SOXL" || selection?.ticker === "SOXS"
          ? selection.ticker
          : get().focusedTicker,
      labelStatus: null,
      drawingStatus: null
    });
  },
  moveSelectedCandle: (direction) => {
    const {
      activeTimeframe,
      focusedTicker,
      mode,
      replayIndex,
      selectedCandle,
      syncData,
      syncDataByTimeframe
    } = get();
    if (!syncData || syncData.timestamps.length === 0) {
      return;
    }

    const targetTimeframe = selectedCandle?.timeframe ?? activeTimeframe;
    const targetData = syncDataByTimeframe[targetTimeframe] ?? syncData;
    const ticker = selectedCandle?.ticker ?? focusedTicker;
    const series = targetData.series[ticker];
    if (!series || series.candles.length === 0) {
      return;
    }

    const currentIndex =
      selectedCandle
        ? series.candles.findIndex((bar) => bar.timestamp === selectedCandle.timestamp)
        : mode === "replay"
          ? replayIndex
          : series.candles.length - 1;
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : mode === "replay" ? replayIndex : 0;
    const nextIndex = Math.max(0, Math.min(series.candles.length - 1, safeCurrentIndex + direction));
    const nextCandle = series.candles[nextIndex];
    const syncedReplayIndex = targetData.timestamps.findIndex(
      (timestamp) => timestamp === nextCandle.timestamp
    );

    set({
      selectedCandle: {
        ticker,
        timeframe: series.timeframe,
        timestamp: nextCandle.timestamp
      },
      activeTimeframe: series.timeframe,
      syncData: targetData,
      focusedTicker: ticker === "SOXL" || ticker === "SOXS" ? ticker : get().focusedTicker,
      selectedDrawingId: null,
      selectedLabelId: null,
      labelStatus: null,
      drawingMode: null,
      isReplayPlaying: false,
      replayIndex:
        mode === "replay" && syncedReplayIndex >= 0 ? syncedReplayIndex : get().replayIndex
    });
  },
  focusLabel: async (label) => {
    if (label.timeframe !== get().activeTimeframe) {
      set({
        activeTimeframe: label.timeframe,
        syncData: get().syncDataByTimeframe[label.timeframe] ?? get().syncData,
        selectedDrawingId: null,
        drawingMode: null,
        isReplayPlaying: false
      });
      await get().loadChartData();
    }

    const timestamps = get().syncData?.timestamps ?? [];
    const labelIndex = timestamps.findIndex((timestamp) => timestamp === label.timestamp);
    set({
      selectedCandle: {
        ticker: label.ticker,
        timeframe: label.timeframe,
        timestamp: label.timestamp
      },
      focusedTicker:
        label.ticker === "SOXL" || label.ticker === "SOXS" ? label.ticker : get().focusedTicker,
      selectedDrawingId: null,
      selectedLabelId: label.id,
      labelStatus: null,
      drawingStatus: null,
      drawingMode: null,
      isReplayPlaying: false,
      replayIndex: labelIndex >= 0 ? labelIndex : get().replayIndex
    });
  },
  focusAdjacentLabel: async (direction) => {
    const labels = chronologicalLabels(get().sessionLabels);
    if (labels.length === 0) {
      return;
    }

    const currentIndex = get().selectedLabelId
      ? labels.findIndex((label) => label.id === get().selectedLabelId)
      : -1;
    await get().focusLabel(labels[adjacentIndex(currentIndex, labels.length, direction)]);
  },
  focusNextValidationIssue: async (direction) => {
    const labelsById = new Map(get().sessionLabels.map((label) => [label.id, label]));
    const issueLabels = chronologicalLabels(
      (get().exportValidationReport?.issues ?? []).reduce<TradeEvent[]>((labels, issue) => {
        if (!issue.labelId) {
          return labels;
        }

        const label = labelsById.get(issue.labelId);
        if (label && !labels.some((item) => item.id === label.id)) {
          labels.push(label);
        }

        return labels;
      }, [])
    );
    if (issueLabels.length === 0) {
      return;
    }

    const currentIndex = get().selectedLabelId
      ? issueLabels.findIndex((label) => label.id === get().selectedLabelId)
      : -1;
    await get().focusLabel(issueLabels[adjacentIndex(currentIndex, issueLabels.length, direction)]);
  },
  selectDrawing: (drawingId) => {
    const drawing = get().drawings.find((item) => item.id === drawingId);
    if (!drawingId) {
      set({
        selectedDrawingId: null,
        selectedLabelId: null,
        drawingStatus: get().drawingMode ? get().drawingStatus : null
      });
      return;
    }

    set({
      selectedDrawingId: drawingId,
      selectedLabelId: null,
      drawingMode: drawing ? null : get().drawingMode,
      drawingStatus: drawing
        ? `Selected ${drawing.ticker} ${drawing.timeframe} ${drawing.type.replace("_", " ")}`
        : null,
      activeTimeframe: drawing?.timeframe ?? get().activeTimeframe,
      focusedTicker:
        drawing?.ticker === "SOXL" || drawing?.ticker === "SOXS"
          ? drawing.ticker
          : get().focusedTicker,
      syncData:
        drawing?.timeframe && get().syncDataByTimeframe[drawing.timeframe]
          ? get().syncDataByTimeframe[drawing.timeframe]
          : get().syncData
    });
  },
  clearSelectedLabel: () => {
    set({ selectedLabelId: null });
  },
  cancelDrawingMode: () => {
    set({
      chartInteractionMode: "cursor",
      drawingMode: null,
      selectedDrawingId: null,
      drawingStatus: null
    });
  },
  startTrendline: (ticker) => {
    const current = get().drawingMode;
    const timeframe = get().activeTimeframe;
    const isTogglingOff =
      current?.ticker === ticker && current.timeframe === timeframe && current.type === "trendline";
    set({
      focusedTicker: ticker === "SOXL" || ticker === "SOXS" ? ticker : get().focusedTicker,
      chartInteractionMode: "cursor",
      selectedDrawingId: null,
      drawingMode: isTogglingOff
        ? null
        : {
            ticker,
            timeframe,
            type: "trendline",
            firstAnchor: null
          },
      drawingStatus: isTogglingOff
        ? null
        : `Line tool active on ${ticker} ${timeframe}. Click two candles.`
    });
  },
  startHorizontalLevel: (ticker) => {
    const current = get().drawingMode;
    const timeframe = get().activeTimeframe;
    const isTogglingOff =
      current?.ticker === ticker &&
      current.timeframe === timeframe &&
      current.type === "horizontal_level";
    set({
      focusedTicker: ticker === "SOXL" || ticker === "SOXS" ? ticker : get().focusedTicker,
      chartInteractionMode: "cursor",
      selectedDrawingId: null,
      drawingMode: isTogglingOff
        ? null
        : {
            ticker,
            timeframe,
            type: "horizontal_level",
            firstAnchor: null
          },
      drawingStatus: isTogglingOff
        ? null
        : `Level tool active on ${ticker} ${timeframe}. Click one candle.`
    });
  },
  startBreakoutMarker: (ticker) => {
    const current = get().drawingMode;
    const timeframe = get().activeTimeframe;
    const isTogglingOff =
      current?.ticker === ticker &&
      current.timeframe === timeframe &&
      current.type === "breakout_marker";
    set({
      focusedTicker: ticker === "SOXL" || ticker === "SOXS" ? ticker : get().focusedTicker,
      chartInteractionMode: "cursor",
      selectedDrawingId: null,
      drawingMode: isTogglingOff
        ? null
        : {
            ticker,
            timeframe,
            type: "breakout_marker",
            firstAnchor: null
          },
      drawingStatus: isTogglingOff
        ? null
        : `Marker tool active on ${ticker} ${timeframe}. Click one candle.`
    });
  },
  handleChartCandleClick: async (ticker, candle) => {
    const mode = get().drawingMode;
    set({
      selectedCandle: { ticker, timeframe: candle.timeframe, timestamp: candle.timestamp },
      activeTimeframe: candle.timeframe,
      syncData: get().syncDataByTimeframe[candle.timeframe] ?? get().syncData,
      focusedTicker: ticker === "SOXL" || ticker === "SOXS" ? ticker : get().focusedTicker,
      labelStatus: null,
      drawingStatus: mode
        ? get().drawingStatus
        : null
    });

    if (!mode || mode.ticker !== ticker || mode.timeframe !== candle.timeframe) {
      return;
    }

    const anchor = {
      timestamp: candle.timestamp,
      price: candle.close
    };

    if (mode.type === "horizontal_level" || mode.type === "breakout_marker") {
      const request: CreateDrawingRequest = {
        sessionId: null,
        ticker,
        timeframe: mode.timeframe,
        type: mode.type,
        anchors: [anchor],
        style: { color: mode.type === "horizontal_level" ? "#6aa9ff" : "#ff9f43" }
      };

      try {
        const drawing = await get().createDrawing(request);
        set((state) => ({
          drawings: [...state.drawings.filter((item) => item.id !== drawing.id), drawing],
          drawingMode: null,
          selectedDrawingId: drawing.id,
          drawingStatus: `Created ${ticker} ${mode.timeframe} ${mode.type.replace("_", " ")}`
        }));
      } catch (error) {
        set({
          chartDataError: error instanceof Error ? error.message : "Unable to create drawing",
          drawingMode: null,
          drawingStatus: null
        });
      }
      return;
    }

    if (!mode.firstAnchor) {
      set({
        drawingMode: {
          ...mode,
          firstAnchor: anchor
        },
        drawingStatus: `Line anchor set on ${ticker} ${mode.timeframe}. Click the second candle.`
      });
      return;
    }

    if (mode.firstAnchor.timestamp === anchor.timestamp) {
      set({
        drawingMode: {
          ...mode,
          firstAnchor: anchor
        },
        drawingStatus: `Line anchor reset on ${ticker} ${mode.timeframe}. Click a different candle.`
      });
      return;
    }

    const request: CreateDrawingRequest = {
      sessionId: null,
      ticker,
      timeframe: mode.timeframe,
      type: "trendline",
      anchors: [mode.firstAnchor, anchor],
      style: { color: "#f2d35e" }
    };

    try {
      const drawing = await get().createDrawing(request);
      set((state) => ({
        drawings: [...state.drawings.filter((item) => item.id !== drawing.id), drawing],
        drawingMode: null,
        selectedDrawingId: drawing.id,
        drawingStatus: `Created ${ticker} ${mode.timeframe} trendline`
      }));
    } catch (error) {
      set({
        chartDataError: error instanceof Error ? error.message : "Unable to create drawing",
        drawingMode: null,
        drawingStatus: null
      });
    }
  },
  moveTrendlineAnchor: async (drawingId, anchorIndex, anchor) => {
    const drawing = get().drawings.find((item) => item.id === drawingId);

    if (!drawing || !drawing.anchors[anchorIndex]) {
      return;
    }

    const anchors = drawing.anchors.map((item, index) => (index === anchorIndex ? anchor : item));
    if (
      drawing.type === "trendline" &&
      anchors.length >= 2 &&
      anchors[0].timestamp === anchors[1].timestamp
    ) {
      return;
    }

    set((state) => ({
      drawings: state.drawings.map((item) =>
        item.id === drawingId ? { ...item, anchors } : item
      ),
      drawingStatus: "Updated drawing"
    }));

    try {
      const updated = await get().updateDrawing(drawingId, { anchors });
      set((state) => ({
        drawings: state.drawings.map((item) => (item.id === drawingId ? updated : item))
      }));
    } catch (error) {
      set({
        chartDataError: error instanceof Error ? error.message : "Unable to update drawing"
      });
    }
  },
  deleteSelectedDrawing: async () => {
    const drawingId = get().selectedDrawingId;

    if (!drawingId) {
      return;
    }

    const beforeDrawings = get().drawings;
    const drawing = beforeDrawings.find((item) => item.id === drawingId);
    set((state) => ({
      drawings: state.drawings.filter((item) => item.id !== drawingId),
      selectedDrawingId: null,
      drawingStatus: drawing
        ? `Deleted ${drawing.ticker} ${drawing.timeframe} ${drawing.type.replace("_", " ")}`
        : "Deleted drawing"
    }));

    try {
      await get().deleteDrawing(drawingId);
    } catch (error) {
      set({
        drawings: beforeDrawings,
        selectedDrawingId: drawingId,
        chartDataError: error instanceof Error ? error.message : "Unable to delete drawing",
        drawingStatus: null
      });
    }
  },
  loadChartData: async () => {
    set({ isLoadingChartData: true, chartDataError: null });

    try {
      const activeTimeframe = get().activeTimeframe;
      const responses = await Promise.all(
        chartGridTimeframes.map(async (timeframe) => [
          timeframe,
          await get().fetchSynchronizedChartData(["SOXL", "SOXS"], timeframe)
        ] as const)
      );
      const syncDataByTimeframe = Object.fromEntries(responses) as Partial<
        Record<ChartTimeframe, SyncChartResponse>
      >;
      const syncData = syncDataByTimeframe[activeTimeframe] ?? responses[0][1];
      const dataCoverage = await get().fetchDataCoverage(["SOXL", "SOXS"], chartGridTimeframes);
      const drawings = (
        await Promise.all(
          responses.flatMap(([timeframe, data]) =>
            data.tickers.map((ticker) => get().listDrawings(ticker, timeframe))
          )
        )
      ).flat();
      const nextReplayIndex =
        get().mode === "replay"
          ? Math.min(get().replayIndex, Math.max(syncData.timestamps.length - 1, 0))
          : Math.max(syncData.timestamps.length - 1, 0);
      const nextTimestamp = syncData.timestamps[nextReplayIndex] ?? null;
      set({
        syncData,
        syncDataByTimeframe,
        dataCoverage,
        drawings,
        replayIndex: nextReplayIndex,
        selectedCandle: nextTimestamp
          ? {
              ticker: get().focusedTicker,
              timeframe: syncData.timeframe,
              timestamp: nextTimestamp
            }
          : null,
        isLoadingChartData: false
      });
    } catch (error) {
      set({
        chartDataError: error instanceof Error ? error.message : "Unable to load chart data",
        isLoadingChartData: false
      });
    }
  },
  loadReviewSummary: async (sessionId) => {
    try {
      const reviewSummary = await get().fetchReviewSummary(sessionId);
      const exportValidationReport = await get().fetchExportValidationReport(sessionId);
      const sessionLabels = await get().listTradeEvents(sessionId);
      set({
        reviewSummary,
        exportValidationReport,
        sessionLabels,
        reviewError: null
      });
    } catch (error) {
      set({
        reviewError: error instanceof Error ? error.message : "Unable to load review summary"
      });
    }
  },
  loadExportValidationReport: async (sessionId) => {
    try {
      const exportValidationReport = await get().fetchExportValidationReport(sessionId);
      set({
        exportValidationReport,
        reviewError: null
      });
    } catch (error) {
      set({
        reviewError: error instanceof Error ? error.message : "Unable to load export validation"
      });
    }
  },
  setImportStartDate: (date) => {
    set({ importStartDate: date, importError: null, lastImportResult: null });
  },
  setImportEndDate: (date) => {
    set({ importEndDate: date, importError: null, lastImportResult: null });
  },
  setImportBaseTimeframe: (timeframe) => {
    set({ importBaseTimeframe: timeframe, importError: null, lastImportResult: null });
  },
  runImport: async () => {
    const request: ImportMarketDataRequest = {
      tickers: ["SOXL", "SOXS"],
      startDate: get().importStartDate || defaultImportStartDate(),
      endDate: get().importEndDate || new Date().toISOString().slice(0, 10),
      baseTimeframe: get().importBaseTimeframe
    };

    set({ isImporting: true, importError: null, lastImportResult: null });

    try {
      const result = await get().importMarketData(request);
      const activeTimeframe = get().activeTimeframe;
      const responses = await Promise.all(
        chartGridTimeframes.map(async (timeframe) => [
          timeframe,
          await get().fetchSynchronizedChartData(["SOXL", "SOXS"], timeframe)
        ] as const)
      );
      const syncDataByTimeframe = Object.fromEntries(responses) as Partial<
        Record<ChartTimeframe, SyncChartResponse>
      >;
      const syncData = syncDataByTimeframe[activeTimeframe] ?? responses[0][1];
      const dataCoverage = await get().fetchDataCoverage(["SOXL", "SOXS"], chartGridTimeframes);
      const drawings = (
        await Promise.all(
          responses.flatMap(([timeframe, data]) =>
            data.tickers.map((ticker) => get().listDrawings(ticker, timeframe))
          )
        )
      ).flat();
      const nextReplayIndex =
        get().mode === "replay"
          ? Math.min(get().replayIndex, Math.max(syncData.timestamps.length - 1, 0))
          : Math.max(syncData.timestamps.length - 1, 0);
      const nextTimestamp = syncData.timestamps[nextReplayIndex] ?? null;
      set({
        lastImportResult: result,
        syncData,
        syncDataByTimeframe,
        dataCoverage,
        drawings,
        replayIndex: nextReplayIndex,
        selectedCandle: nextTimestamp
          ? {
              ticker: get().focusedTicker,
              timeframe: syncData.timeframe,
              timestamp: nextTimestamp
            }
          : null,
        isImporting: false
      });
    } catch (error) {
      set({
        importError: error instanceof Error ? error.message : "Unable to import market data",
        lastImportResult: null,
        isImporting: false
      });
    }
  },
  submitLabel: async (input) => {
    const context = selectedCandleContext(get());

    if (!context) {
      set({ labelError: "Select a candle before labeling", labelStatus: null });
      return;
    }

    set({ isSavingLabel: true, labelError: null, labelStatus: null });

    try {
      let session = get().activeSession;

      if (!session) {
        const request: CreateSessionRequest = {
          name: "Quick capture",
          tickerFocus: context.candle.ticker,
          timeframeFocus: context.candle.timeframe,
          notes: null
        };
        session = await get().createSession(request);
        const sessions = await get().listSessions();
        rememberActiveSession(session.id);
        set({ activeSession: session, sessions });
      }

      const labelRequest: CreateTradeEventRequest = {
        sessionId: session.id,
        timestamp: context.candle.timestamp,
        ticker: context.candle.ticker,
        timeframe: context.candle.timeframe,
        labelType: input.labelType,
        decisionPhase: "at_close",
        captureMode: get().mode,
        labelSource: input.labelSource,
        trainingEligible: input.trainingEligible,
        visibleUntilTimestamp: context.candle.timestamp,
        potentialVisualLeakage: get().mode === "regular",
        selectedBarIndex: context.candleIndex,
        setupId: input.setupId ?? null,
        tradeId: input.tradeId ?? null,
        parentLabelId: input.parentLabelId ?? null,
        decisionRole: input.decisionRole ?? defaultDecisionRole(input.labelType),
        bias: input.bias ?? ("unclear" satisfies Bias),
        marketBias: "unclear" satisfies MarketBias,
        tradeDirection: input.tradeDirection ?? ("observe_only" satisfies TradeDirection),
        instrumentRole: "primary" satisfies InstrumentRole,
        pairedTickerRole: "ignored" satisfies PairedTickerRole,
        entryStyle: null,
        exitStyle: null,
        invalidationPrice: null,
        targetPrice: null,
        multiTimeframeContext: multiTimeframeContextSnapshot(
          {
            syncData: get().syncData,
            syncDataByTimeframe: get().syncDataByTimeframe
          },
          context.candle.ticker,
          context.candle.timestamp
        ),
        price: context.candle.close,
        confidence: input.confidence,
        setupQuality: input.setupQuality,
        reasonCodes: input.reasonCodes,
        notes: input.notes,
        indicatorSnapshot: context.indicator
          ? {
              ...context.indicator,
              pairedTicker: context.pairedTicker
            }
          : {
              pairedTicker: context.pairedTicker
            },
        structureSnapshot: context.structureSnapshot,
        drawingContext: {
          ...drawingContextForCandle(context.candle, get().drawings)
        }
      };
      const createdLabel = await get().createTradeEvent(labelRequest);
      const sessionLabels = await get().listTradeEvents(session.id);
      const reviewSummary = await get().fetchReviewSummary(session.id);
      const exportValidationReport = await get().fetchExportValidationReport(session.id);
      const replayAdvanceState: Partial<AppState> = {};
      if (get().mode === "replay") {
        const targetData =
          get().syncDataByTimeframe[context.candle.timeframe] ??
          (get().syncData?.timeframe === context.candle.timeframe ? get().syncData : null);
        const targetSeries = targetData?.series[context.candle.ticker] ?? null;
        const nextCandle = targetSeries?.candles[context.candleIndex + 1] ?? null;
        const nextReplayIndex = nextCandle
          ? (targetData?.timestamps.findIndex((timestamp) => timestamp === nextCandle.timestamp) ?? -1)
          : -1;

        if (nextCandle) {
          replayAdvanceState.selectedCandle = {
            ticker: context.candle.ticker,
            timeframe: context.candle.timeframe,
            timestamp: nextCandle.timestamp
          };
          replayAdvanceState.selectedDrawingId = null;
          replayAdvanceState.drawingStatus = null;
          replayAdvanceState.isReplayPlaying = false;
          if (nextReplayIndex >= 0) {
            replayAdvanceState.replayIndex = nextReplayIndex;
          }
        }
      }

      set({
        ...replayAdvanceState,
        isSavingLabel: false,
        lastCreatedLabelId: createdLabel.id,
        labelStatus: "Created label",
        selectedLabelId: null,
        sessionLabels,
        reviewSummary,
        exportValidationReport,
        reviewError: null
      });
    } catch (error) {
      set({
        labelError: error instanceof Error ? error.message : "Unable to save label",
        labelStatus: null,
        isSavingLabel: false
      });
    }
  },
  updateLabel: async (labelId, input) => {
    const session = get().activeSession;
    if (!session) {
      set({ labelError: "No active session selected", labelStatus: null });
      return false;
    }

    set({ isSavingLabel: true, labelError: null, labelStatus: null });

    try {
      await get().updateTradeEvent(labelId, input);
      const sessionLabels = await get().listTradeEvents(session.id);
      const reviewSummary = await get().fetchReviewSummary(session.id);
      const exportValidationReport = await get().fetchExportValidationReport(session.id);
      set({
        sessionLabels,
        reviewSummary,
        exportValidationReport,
        reviewError: null,
        isSavingLabel: false,
        lastCreatedLabelId: labelId,
        labelStatus: "Updated label",
        selectedLabelId: labelId
      });
      return true;
    } catch (error) {
      set({
        labelError: error instanceof Error ? error.message : "Unable to update label",
        labelStatus: null,
        isSavingLabel: false
      });
      return false;
    }
  },
  calculateOutcome: async (labelId) => {
    const session = get().activeSession;
    const targetLabelId = labelId ?? get().selectedLabelId ?? get().lastCreatedLabelId ?? get().sessionLabels.at(-1)?.id;
    if (!session) {
      set({ labelError: "No active session selected", labelStatus: null });
      return false;
    }
    if (!targetLabelId) {
      set({ labelError: "No label selected for outcome calculation", labelStatus: null });
      return false;
    }

    set({ isSavingLabel: true, labelError: null, labelStatus: null });

    try {
      await get().calculateLabelOutcome(targetLabelId, { horizonBars: 10 });
      const sessionLabels = await get().listTradeEvents(session.id);
      const reviewSummary = await get().fetchReviewSummary(session.id);
      const exportValidationReport = await get().fetchExportValidationReport(session.id);
      set({
        sessionLabels,
        reviewSummary,
        exportValidationReport,
        reviewError: null,
        isSavingLabel: false,
        lastCreatedLabelId: targetLabelId,
        labelStatus: "Calculated outcome",
        selectedLabelId: targetLabelId
      });
      return true;
    } catch (error) {
      set({
        labelError: error instanceof Error ? error.message : "Unable to calculate outcome",
        labelStatus: null,
        isSavingLabel: false
      });
      return false;
    }
  },
  deleteLabel: async (labelId) => {
    const session = get().activeSession;
    if (!session) {
      set({ labelError: "No active session selected", labelStatus: null });
      return false;
    }

    set({ isSavingLabel: true, labelError: null, labelStatus: null });

    try {
      await get().deleteTradeEvent(labelId);
      const sessionLabels = await get().listTradeEvents(session.id);
      const reviewSummary = await get().fetchReviewSummary(session.id);
      const exportValidationReport = await get().fetchExportValidationReport(session.id);
      set({
        sessionLabels,
        reviewSummary,
        exportValidationReport,
        reviewError: null,
        isSavingLabel: false,
        lastCreatedLabelId: null,
        labelStatus: "Deleted label",
        selectedLabelId: null
      });
      return true;
    } catch (error) {
      set({
        labelError: error instanceof Error ? error.message : "Unable to delete label",
        labelStatus: null,
        isSavingLabel: false
      });
      return false;
    }
  }
}));
