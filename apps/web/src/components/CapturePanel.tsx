import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { selectedCandleContext, useAppStore } from "../store/useAppStore";
import type { IndicatorSnapshot } from "../api/client";
import type { Bias, DecisionRole, LabelType, OutcomeStatus, ReasonCode, TradeDirection, TradeEvent } from "../api/client";

type UiLabelType = {
  label: string;
  value: LabelType;
  key: string;
};

type ReasonOption = {
  label: string;
  value: ReasonCode;
};

type SelectOption<T extends string> = {
  label: string;
  value: T;
};

const labelTypes: UiLabelType[] = [
  { label: "Entry", value: "ENTRY", key: "e" },
  { label: "Exit", value: "EXIT", key: "x" },
  { label: "Skip", value: "SKIP", key: "s" },
  { label: "Invalid", value: "INVALID", key: "i" }
];

const reasonCodes: ReasonOption[] = [
  { label: "Trendline break", value: "trendline_break" },
  { label: "Stoch RSI condition", value: "stoch_rsi_condition" },
  { label: "EMA alignment", value: "ema_alignment" },
  { label: "Volatility expansion", value: "volatility_expansion" },
  { label: "Inverse ETF confirmation", value: "inverse_etf_confirmation" },
  { label: "Other", value: "other" }
];

const decisionRoles: SelectOption<DecisionRole>[] = [
  { label: "Setup Start", value: "setup_start" },
  { label: "Trigger", value: "trigger" },
  { label: "Entry", value: "entry" },
  { label: "Management", value: "management" },
  { label: "Exit", value: "exit" },
  { label: "Skip", value: "skip" },
  { label: "Invalid", value: "invalid" }
];

const biasOptions: SelectOption<Bias>[] = [
  { label: "Unclear", value: "unclear" },
  { label: "Long", value: "long" },
  { label: "Short", value: "short" },
  { label: "Neutral", value: "neutral" }
];

const tradeDirections: SelectOption<TradeDirection>[] = [
  { label: "Observe Only", value: "observe_only" },
  { label: "Long Ticker", value: "long_ticker" },
  { label: "Short Ticker", value: "short_ticker" }
];

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

function formatNumber(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined ? "--" : value.toFixed(digits);
}

function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "--";
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toFixed(0);
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York"
  }).format(new Date(timestamp));
}

function formatCandleChange(candle: { open: number; close: number }): string {
  if (candle.open === 0) {
    return "+0.00%";
  }

  const change = ((candle.close - candle.open) / candle.open) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}

function labelProvenance(label: Pick<TradeEvent, "captureMode" | "potentialVisualLeakage">): {
  className: "regular" | "replay-safe" | "future-visible";
  label: "Regular" | "Replay-safe" | "Future-visible";
} {
  if (label.captureMode === "replay" && !label.potentialVisualLeakage) {
    return { className: "replay-safe", label: "Replay-safe" };
  }

  if (label.potentialVisualLeakage) {
    return { className: "future-visible", label: "Future-visible" };
  }

  return { className: "regular", label: "Regular" };
}

function outcomeStatusLabel(status: OutcomeStatus): string {
  const labels: Record<OutcomeStatus, string> = {
    not_computed: "Not computed",
    pending: "Pending",
    computed: "Computed",
    insufficient_future_bars: "Insufficient future bars",
    missing_exit: "Missing exit",
    invalidated: "Invalidated"
  };

  return labels[status];
}

function labelOutcomeStatus(label: TradeEvent | null): OutcomeStatus | "no_label" {
  if (!label) {
    return "no_label";
  }

  if (label.outcomeAvailable) {
    return "computed";
  }

  return label.outcomeStatus;
}

function modeProvenance(mode: "regular" | "replay") {
  return mode === "replay"
    ? { className: "replay-safe" as const, label: "Replay-safe" as const }
    : { className: "future-visible" as const, label: "Future-visible" as const };
}

function indicatorRows(indicator: IndicatorSnapshot | null) {
  return [
    ["EMA 25", formatNumber(indicator?.ema25)],
    ["SMA 100", formatNumber(indicator?.sma100)],
    ["VWAP M", formatNumber(indicator?.monthlyVwap)],
    ["SMIO", formatNumber(indicator?.smio.oscillator, 4)],
    ["Stoch K/D", `${formatNumber(indicator?.stochRsi.k)} / ${formatNumber(indicator?.stochRsi.d)}`],
    ["WVF", formatNumber(indicator?.cmWvf.plot)],
    ["ATR", formatNumber(indicator?.atr14Rma)]
  ];
}

function labelSummary(label: TradeEvent | null): string {
  if (!label) {
    return "--";
  }

  return `${label.labelType} ${label.ticker} ${label.price.toFixed(2)} ${label.timeframe}`;
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function nextLifecycleId(prefix: "setup" | "trade", labels: TradeEvent[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const maxId = labels.reduce((max, label) => {
    const candidates = prefix === "setup" ? [label.setupId] : [label.tradeId];
    const values = candidates
      .map((candidate) => candidate?.match(pattern)?.[1])
      .map((candidate) => (candidate ? Number(candidate) : 0))
      .filter((candidate) => Number.isFinite(candidate));
    return Math.max(max, ...values);
  }, 0);

  return `${prefix}-${maxId + 1}`;
}

function previousLabelFor(label: TradeEvent | null, labels: TradeEvent[]): TradeEvent | null {
  if (!label) {
    return null;
  }

  const currentIndex = labels.findIndex((item) => item.id === label.id);
  if (currentIndex <= 0) {
    return null;
  }

  return labels[currentIndex - 1] ?? null;
}

function latestLinkedLabel(labels: TradeEvent[]): TradeEvent | null {
  return [...labels].reverse().find((label) => label.setupId || label.tradeId) ?? null;
}

function latestOpenTradeLabel(labels: TradeEvent[]): TradeEvent | null {
  const closedTradeIds = new Set(
    labels
      .filter((label) => label.tradeId && (label.labelType === "EXIT" || label.labelType === "INVALID"))
      .map((label) => label.tradeId as string)
  );

  return (
    [...labels]
      .reverse()
      .find(
        (label) =>
          Boolean(label.tradeId) &&
          !closedTradeIds.has(label.tradeId as string) &&
          (label.labelType === "ENTRY" || label.decisionRole === "entry" || label.decisionRole === "trigger")
      ) ?? null
  );
}

function lifecycleCards(labels: TradeEvent[]): Array<{
  id: string;
  outcome: OutcomeStatus;
  status: "exited" | "invalidated" | "open" | "unresolved";
  title: string;
}> {
  const grouped = new Map<string, TradeEvent[]>();

  for (const label of labels) {
    const key = label.tradeId ?? label.setupId;
    if (!key) {
      continue;
    }

    grouped.set(key, [...(grouped.get(key) ?? []), label]);
  }

  return [...grouped.entries()]
    .map(([id, group]) => {
      const hasExit = group.some((label) => label.labelType === "EXIT" || label.decisionRole === "exit");
      const hasInvalid = group.some((label) => label.labelType === "INVALID" || label.decisionRole === "invalid");
      const hasEntry = group.some((label) => label.labelType === "ENTRY" || label.decisionRole === "entry");
      const latest = group.at(-1);
      const hasOutcome = group.some((label) => label.outcomeAvailable || label.outcomeStatus === "computed");
      const latestOutcomeStatus = latest?.outcomeStatus ?? "not_computed";

      return {
        id,
        outcome: hasOutcome ? "computed" : latestOutcomeStatus,
        status: hasInvalid
          ? ("invalidated" as const)
          : hasExit
            ? ("exited" as const)
            : hasEntry
              ? ("open" as const)
              : ("unresolved" as const),
        title: `${id} · ${latest?.ticker ?? "--"} ${latest?.timeframe ?? ""}`.trim()
      };
    })
    .reverse()
    .slice(0, 4);
}

export function CapturePanel() {
  const selectedCandle = useAppStore((state) => state.selectedCandle);
  const mode = useAppStore((state) => state.mode);
  const activeTimeframe = useAppStore((state) => state.activeTimeframe);
  const focusedTicker = useAppStore((state) => state.focusedTicker);
  const activeSession = useAppStore((state) => state.activeSession);
  const exportValidationReport = useAppStore((state) => state.exportValidationReport);
  const syncData = useAppStore((state) => state.syncData);
  const syncDataByTimeframe = useAppStore((state) => state.syncDataByTimeframe);
  const focusLabel = useAppStore((state) => state.focusLabel);
  const startSession = useAppStore((state) => state.startSession);
  const submitLabel = useAppStore((state) => state.submitLabel);
  const updateLabel = useAppStore((state) => state.updateLabel);
  const deleteLabel = useAppStore((state) => state.deleteLabel);
  const calculateOutcome = useAppStore((state) => state.calculateOutcome);
  const isSavingLabel = useAppStore((state) => state.isSavingLabel);
  const labelError = useAppStore((state) => state.labelError);
  const labelStatus = useAppStore((state) => state.labelStatus);
  const selectedLabelId = useAppStore((state) => state.selectedLabelId);
  const lastCreatedLabelId = useAppStore((state) => state.lastCreatedLabelId);
  const clearSelectedLabel = useAppStore((state) => state.clearSelectedLabel);
  const sessionLabels = useAppStore((state) => state.sessionLabels);
  const [confidence, setConfidence] = useState(3);
  const [setupQuality, setSetupQuality] = useState(3);
  const [selectedReasons, setSelectedReasons] = useState<ReasonCode[]>([]);
  const [notes, setNotes] = useState("");
  const [setupId, setSetupId] = useState("");
  const [tradeId, setTradeId] = useState("");
  const [parentLabelId, setParentLabelId] = useState("");
  const [decisionRole, setDecisionRole] = useState<DecisionRole | "auto">("auto");
  const [bias, setBias] = useState<Bias>("unclear");
  const [tradeDirection, setTradeDirection] = useState<TradeDirection>("observe_only");
  const [editingLabel, setEditingLabel] = useState<TradeEvent | null>(null);
  const [editingLabelType, setEditingLabelType] = useState<LabelType>("ENTRY");
  const [pendingEditAction, setPendingEditAction] = useState<"save" | "delete" | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const pendingEditActionRef = useRef(false);
  const isDisabled = !selectedCandle || isSavingLabel;
  const isCaptureDisabled = isDisabled || Boolean(editingLabel);
  const disabledReason = !selectedCandle
    ? "Select a candle to label it."
    : editingLabel
      ? "Finish editing the saved label before capturing another."
      : null;
  const sessionHint = !activeSession && selectedCandle ? "First label starts a Quick capture session." : null;
  const context = useMemo(
    () =>
      selectedCandleContext({
        activeTimeframe,
        selectedCandle,
        syncData,
        syncDataByTimeframe
      }),
    [activeTimeframe, selectedCandle, syncData, syncDataByTimeframe]
  );

  const selectedReasonSet = useMemo(() => new Set(selectedReasons), [selectedReasons]);
  const notesSummary = notes.trim() ? "notes" : null;
  const reasonSummary = selectedReasons.length > 0 ? `${selectedReasons.length} reasons` : null;
  const lifecycleSummary =
    setupId.trim() || tradeId.trim() || bias !== "unclear" || tradeDirection !== "observe_only"
      ? "intent"
      : null;
  const detailSummary =
    [reasonSummary, notesSummary, lifecycleSummary].filter(Boolean).join(" + ") || "Optional";
  const statusLabel = selectedLabelId
    ? sessionLabels.find((label) => label.id === selectedLabelId)
    : null;
  const lastCreatedLabel = lastCreatedLabelId
    ? sessionLabels.find((label) => label.id === lastCreatedLabelId)
    : null;
  const statusDetailLabel = statusLabel ?? lastCreatedLabel;
  const statusDetail = statusDetailLabel
    ? `${statusDetailLabel.labelType} ${statusDetailLabel.ticker} ${statusDetailLabel.price.toFixed(2)} ${statusDetailLabel.timeframe}`
    : null;
  const lastLabel = sessionLabels.at(-1) ?? null;
  const outcomeTarget = editingLabel ?? statusLabel ?? lastCreatedLabel ?? lastLabel;
  const targetOutcomeStatus = labelOutcomeStatus(outcomeTarget);
  const recentLabels = sessionLabels.slice(-3).reverse();
  const lifecycleItems = lifecycleCards(sessionLabels);
  const linkedLabel = latestLinkedLabel(sessionLabels);
  const validationSummary = exportValidationReport?.summary;
  const selectedCandleProvenance = modeProvenance(mode);
  const trustStatus = (validationSummary?.errorCount ?? 0) > 0
    ? "Blocked"
    : (validationSummary?.warningCount ?? 0) > 0 || (validationSummary?.labelsWithIncompleteIntent ?? 0) > 0
      ? "Needs review"
      : "Ready";
  const showTrustStrip = trustStatus !== "Ready";
  const previousEditingLabel = previousLabelFor(editingLabel, sessionLabels);
  const canRepairEntryIntent =
    editingLabel?.labelType === "ENTRY" &&
    (!setupId.trim() || bias === "unclear" || tradeDirection === "observe_only");
  const canRepairExitLinkage =
    editingLabel?.labelType === "EXIT" &&
    !tradeId.trim() &&
    !parentLabelId.trim() &&
    Boolean(previousEditingLabel);

  const startQuickSession = async () => {
    await startSession({
      name: "Quick capture",
      tickerFocus: focusedTicker,
      timeframeFocus: activeTimeframe
    });
  };

  const resetDraft = useCallback(() => {
    setConfidence(3);
    setSetupQuality(3);
    setSelectedReasons([]);
    setNotes("");
    setSetupId("");
    setTradeId("");
    setParentLabelId("");
    setDecisionRole("auto");
    setBias("unclear");
    setTradeDirection("observe_only");
    setEditingLabelType("ENTRY");
  }, []);

  const cancelEditingLabel = useCallback(() => {
    setEditingLabel(null);
    clearSelectedLabel();
    resetDraft();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [clearSelectedLabel, resetDraft]);

  const toggleReason = (reason: ReasonCode) => {
    setSelectedReasons((current) =>
      current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]
    );
  };

  const startSetup = () => {
    setSetupId(nextLifecycleId("setup", sessionLabels));
    setTradeId("");
    setParentLabelId("");
    setDecisionRole("setup_start");
  };

  const startTrade = () => {
    const currentSetupId = optionalText(setupId) ?? nextLifecycleId("setup", sessionLabels);
    setSetupId(currentSetupId);
    setTradeId(nextLifecycleId("trade", sessionLabels));
    setParentLabelId("");
    setDecisionRole("trigger");
  };

  const startEntryTrade = () => {
    const currentSetupId = optionalText(setupId) ?? nextLifecycleId("setup", sessionLabels);
    setSetupId(currentSetupId);
    setTradeId(optionalText(tradeId) ?? nextLifecycleId("trade", sessionLabels));
    setParentLabelId("");
    setDecisionRole("entry");
  };

  const attachExitToOpenTrade = () => {
    const openTrade = latestOpenTradeLabel(sessionLabels);
    if (!openTrade) {
      return;
    }

    setSetupId(openTrade.setupId ?? setupId);
    setTradeId(openTrade.tradeId ?? tradeId);
    setParentLabelId(openTrade.id);
    setDecisionRole("exit");
    setBias(openTrade.bias);
    setTradeDirection(openTrade.tradeDirection);
  };

  const attachInvalidationToSetup = () => {
    const target = latestLinkedLabel(sessionLabels);
    const currentSetupId = target?.setupId ?? optionalText(setupId) ?? nextLifecycleId("setup", sessionLabels);
    setSetupId(currentSetupId);
    setTradeId("");
    setParentLabelId(target?.id ?? "");
    setDecisionRole("invalid");
    if (target) {
      setBias(target.bias);
      setTradeDirection(target.tradeDirection);
    }
  };

  const markSkipReview = () => {
    setTradeId("");
    setParentLabelId("");
    setDecisionRole("skip");
  };

  const continueLastLifecycle = () => {
    if (!lastLabel) {
      return;
    }

    setSetupId(lastLabel.setupId ?? "");
    setTradeId(lastLabel.tradeId ?? "");
    setParentLabelId(lastLabel.id);
    setDecisionRole("management");
    setBias(lastLabel.bias);
    setTradeDirection(lastLabel.tradeDirection);
  };

  const clearLifecycle = () => {
    setSetupId("");
    setTradeId("");
    setParentLabelId("");
    setDecisionRole("auto");
    setBias("unclear");
    setTradeDirection("observe_only");
  };

  const applyEntryIntentRepair = (direction: "long_ticker" | "short_ticker") => {
    if (!editingLabel) {
      return;
    }

    setSetupId((current) => optionalText(current) ?? nextLifecycleId("setup", sessionLabels));
    setDecisionRole("entry");
    setBias(direction === "long_ticker" ? "long" : "short");
    setTradeDirection(direction);
  };

  const applyExitLinkageRepair = () => {
    if (!previousEditingLabel) {
      return;
    }

    setSetupId(previousEditingLabel.setupId ?? setupId);
    setTradeId(previousEditingLabel.tradeId ?? tradeId);
    setParentLabelId(previousEditingLabel.id);
    setDecisionRole("exit");
    setBias(previousEditingLabel.bias);
    setTradeDirection(previousEditingLabel.tradeDirection);
  };

  const capture = useCallback(
    async (labelType: LabelType) => {
      await submitLabel({
        labelType,
        confidence,
        setupQuality,
        reasonCodes: selectedReasons,
        notes: optionalText(notes),
        setupId: optionalText(setupId),
        tradeId: optionalText(tradeId),
        parentLabelId: optionalText(parentLabelId),
        decisionRole: decisionRole === "auto" ? defaultDecisionRole(labelType) : decisionRole,
        bias,
        tradeDirection
      });
      setIsDetailsOpen(false);
    },
    [
      bias,
      confidence,
      decisionRole,
      notes,
      parentLabelId,
      selectedReasons,
      setupId,
      setupQuality,
      submitLabel,
      tradeDirection,
      tradeId
    ]
  );

  const startEditing = (label: TradeEvent) => {
    void focusLabel(label);
    setEditingLabel(label);
    setEditingLabelType(label.labelType);
    setConfidence(label.confidence);
    setSetupQuality(label.setupQuality);
    setSelectedReasons(label.reasonCodes);
    setNotes(label.notes ?? "");
    setSetupId(label.setupId ?? "");
    setTradeId(label.tradeId ?? "");
    setParentLabelId(label.parentLabelId ?? "");
    setDecisionRole(label.decisionRole);
    setBias(label.bias);
    setTradeDirection(label.tradeDirection);
    setIsDetailsOpen(true);
  };

  useEffect(() => {
    if (!selectedLabelId || editingLabel?.id === selectedLabelId) {
      return;
    }

    const label = sessionLabels.find((item) => item.id === selectedLabelId);
    if (!label) {
      clearSelectedLabel();
      return;
    }

    setEditingLabel(label);
    setEditingLabelType(label.labelType);
    setConfidence(label.confidence);
    setSetupQuality(label.setupQuality);
    setSelectedReasons(label.reasonCodes);
    setNotes(label.notes ?? "");
    setSetupId(label.setupId ?? "");
    setTradeId(label.tradeId ?? "");
    setParentLabelId(label.parentLabelId ?? "");
    setDecisionRole(label.decisionRole);
    setBias(label.bias);
    setTradeDirection(label.tradeDirection);
    setIsDetailsOpen(true);
  }, [clearSelectedLabel, editingLabel?.id, selectedLabelId, sessionLabels]);

  const saveEditingLabel = useCallback(async () => {
    if (!editingLabel || isSavingLabel || pendingEditActionRef.current) {
      return;
    }

    pendingEditActionRef.current = true;
    setPendingEditAction("save");
    try {
      const didSave = await updateLabel(editingLabel.id, {
        labelType: editingLabelType,
        timestamp: editingLabel.timestamp,
        ticker: editingLabel.ticker,
        timeframe: editingLabel.timeframe,
        price: editingLabel.price,
        confidence,
        setupQuality,
        reasonCodes: selectedReasons,
        notes: optionalText(notes),
        setupId: optionalText(setupId),
        tradeId: optionalText(tradeId),
        parentLabelId: optionalText(parentLabelId),
        decisionRole: decisionRole === "auto" ? defaultDecisionRole(editingLabelType) : decisionRole,
        bias,
        tradeDirection,
        indicatorSnapshot: editingLabel.indicatorSnapshot,
        structureSnapshot: editingLabel.structureSnapshot,
        drawingContext: editingLabel.drawingContext
      });
      if (!didSave) {
        return;
      }
      setEditingLabel(null);
      clearSelectedLabel();
      resetDraft();
      setIsDetailsOpen(false);
    } finally {
      pendingEditActionRef.current = false;
      setPendingEditAction(null);
    }
  }, [
    clearSelectedLabel,
    bias,
    confidence,
    decisionRole,
    editingLabel,
    editingLabelType,
    isSavingLabel,
    notes,
    parentLabelId,
    resetDraft,
    selectedReasons,
    setupId,
    setupQuality,
    tradeDirection,
    tradeId,
    updateLabel
  ]);

  const deleteEditingLabel = async () => {
    if (!editingLabel || isSavingLabel || pendingEditActionRef.current) {
      return;
    }

    pendingEditActionRef.current = true;
    setPendingEditAction("delete");
    try {
      const didDelete = await deleteLabel(editingLabel.id);
      if (!didDelete) {
        return;
      }
      setEditingLabel(null);
      clearSelectedLabel();
      resetDraft();
    } finally {
      pendingEditActionRef.current = false;
      setPendingEditAction(null);
    }
  };

  const undoLastLabel = useCallback(async () => {
    const targetLabel = lastCreatedLabel ?? lastLabel;
    if (!targetLabel || editingLabel || isSavingLabel || pendingEditActionRef.current) {
      return;
    }

    pendingEditActionRef.current = true;
    setPendingEditAction("delete");
    try {
      await deleteLabel(targetLabel.id);
    } finally {
      pendingEditActionRef.current = false;
      setPendingEditAction(null);
    }
  }, [deleteLabel, editingLabel, isSavingLabel, lastCreatedLabel, lastLabel]);

  const calculateOutcomeForTarget = async () => {
    if (!outcomeTarget || isSavingLabel) {
      return;
    }

    const didCalculate = await calculateOutcome(outcomeTarget.id);
    if (didCalculate && editingLabel?.id === outcomeTarget.id) {
      const refreshed = useAppStore.getState().sessionLabels.find((label) => label.id === outcomeTarget.id);
      if (refreshed) {
        setEditingLabel(refreshed);
      }
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && editingLabel) {
        event.preventDefault();
        cancelEditingLabel();
        return;
      }

      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      if (event.key === "Enter" && editingLabel && !isSavingLabel) {
        event.preventDefault();
        void saveEditingLabel();
        return;
      }

      if (event.key.toLowerCase() === "u") {
        event.preventDefault();
        void undoLastLabel();
        return;
      }

      const label = labelTypes.find((item) => item.key === event.key.toLowerCase());
      if (!label) {
        return;
      }

      event.preventDefault();
      if (editingLabel) {
        setEditingLabelType(label.value);
        return;
      }

      if (isDisabled) {
        return;
      }

      void capture(label.value);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [cancelEditingLabel, capture, editingLabel, isDisabled, isSavingLabel, saveEditingLabel, undoLastLabel]);

  return (
    <aside className={editingLabel ? "capture-panel is-editing" : "capture-panel"} aria-label="Decision capture panel">
      <header>
        <p>Capture</p>
        <strong>
          {selectedCandle
            ? `${selectedCandle.ticker} ${selectedCandle.timestamp.slice(0, 10)}`
            : "No candle selected"}
        </strong>
      </header>
      <section className="candle-context" aria-label="Selected candle context">
        {context ? (
          <>
            <div className="selected-candle-card" aria-label="Selected candle details">
              <div>
                <span>Selected Candle</span>
                <strong>
                  {context.candle.ticker} · {context.candle.timeframe}
                </strong>
              </div>
              <div>
                <span>{formatTimestamp(context.candle.timestamp)}</span>
                <strong>
                  {context.candle.close.toFixed(2)} {formatCandleChange(context.candle)}
                </strong>
              </div>
              <div className="selected-candle-meta">
                <span className={`provenance-badge ${selectedCandleProvenance.className}`}>
                  {selectedCandleProvenance.label}
                </span>
                <span>Bar {context.candleIndex + 1}</span>
              </div>
            </div>
            <div className="context-head">
              <span>{context.candle.timeframe}</span>
              <strong>{context.candle.close.toFixed(2)}</strong>
            </div>
            <div className="context-grid">
              <span>Open</span>
              <strong>{context.candle.open.toFixed(2)}</strong>
              <span>High</span>
              <strong>{context.candle.high.toFixed(2)}</strong>
              <span>Low</span>
              <strong>{context.candle.low.toFixed(2)}</strong>
              <span>Vol</span>
              <strong>{formatVolume(context.candle.volume)}</strong>
            </div>
            <details className="candle-data-details">
              <summary>
                <span>Market Context</span>
                <strong>Indicators + pair</strong>
              </summary>
              <div className="context-grid context-grid-wide">
                {indicatorRows(context.indicator).map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="context-grid">
                <span>Recent High</span>
                <strong>{context.structureSnapshot.recentHigh.toFixed(2)}</strong>
                <span>Dist High</span>
                <strong>{context.structureSnapshot.distanceToRecentHigh.toFixed(2)}</strong>
                <span>Recent Low</span>
                <strong>{context.structureSnapshot.recentLow.toFixed(2)}</strong>
                <span>Dist Low</span>
                <strong>{context.structureSnapshot.distanceToRecentLow.toFixed(2)}</strong>
              </div>
              <div className="paired-context">
                <span>{context.pairedTicker ? `${context.pairedTicker.ticker} same candle` : "Paired ETF"}</span>
                <strong>
                  {context.pairedTicker?.candle
                    ? `${context.pairedTicker.candle.close.toFixed(2)} / SMIO ${formatNumber(
                        context.pairedTicker.indicator?.smio.oscillator,
                        4
                      )}`
                    : "--"}
                </strong>
              </div>
            </details>
          </>
        ) : (
          <div className="capture-empty-state">
            <div className="capture-empty-head">
              <span>Target</span>
              <strong>{focusedTicker} {activeTimeframe}</strong>
            </div>
            <div className="capture-empty-grid">
              <div>
                <span>Session</span>
                <strong>{activeSession?.name ?? "No active session"}</strong>
              </div>
              <div>
                <span>Labels</span>
                <strong>{sessionLabels.length}</strong>
              </div>
              <div>
                <span>Last Label</span>
                <strong>{labelSummary(lastLabel)}</strong>
              </div>
            </div>
            {!activeSession ? (
              <div className="capture-session-gate" role="status">
                <span>Session required</span>
                <strong>Start or resume a session to label candles</strong>
                <button type="button" disabled={isSavingLabel} onClick={() => void startQuickSession()}>
                  Start Session
                </button>
              </div>
            ) : null}
            <div className="hotkey-strip" aria-label="Capture hotkeys">
              {labelTypes.map((label) => (
                <span key={label.value}>
                  <kbd>{label.key.toUpperCase()}</kbd>
                  {label.label}
                </span>
              ))}
            </div>
            {recentLabels.length > 0 ? (
              <ol className="capture-mini-history" aria-label="Recent captured labels">
                {recentLabels.map((label) => (
                  <li key={label.id}>
                    <button
                      type="button"
                      onClick={() => startEditing(label)}
                      aria-label={`Edit recent ${label.labelType} ${label.ticker} ${label.price.toFixed(2)} ${label.timeframe}`}
                    >
                      <strong>{label.labelType}</strong>
                      <span>{label.ticker} {label.timeframe}</span>
                      <span>{label.price.toFixed(2)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Select a candle to see OHLCV and indicator context.</p>
            )}
          </div>
        )}
      </section>
      <div className="capture-action-bar" role="group" aria-label="Compact label controls">
        <div className="label-grid" role="group" aria-label="Decision labels">
          {labelTypes.map((label) => (
            <button
              key={label.value}
              type="button"
              aria-label={label.label}
              disabled={isCaptureDisabled}
              onClick={() => void capture(label.value)}
            >
              <span>{label.label}</span>
              <kbd>{label.key.toUpperCase()}</kbd>
            </button>
          ))}
        </div>
        <button
          className="capture-undo-button"
          type="button"
          aria-label="Undo last label"
          disabled={isSavingLabel || Boolean(editingLabel) || !activeSession || !lastLabel}
          onClick={() => void undoLastLabel()}
        >
          <span>{pendingEditAction === "delete" && !editingLabel ? "Undoing..." : "Undo Last"}</span>
          <kbd>U</kbd>
        </button>
        {disabledReason ? (
          <p className="capture-disabled-reason" role="status">
            {disabledReason}
          </p>
        ) : null}
        {sessionHint ? (
          <p className="capture-disabled-reason" role="status">
            {sessionHint}
            <button type="button" disabled={isSavingLabel} onClick={() => void startQuickSession()}>
              Start Session
            </button>
          </p>
        ) : null}
        <div className="capture-control-row">
          <div className="control-group">
            <span>Confidence</span>
            <div className="segmented">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  className={confidence === value ? "active" : undefined}
                  key={value}
                  type="button"
                  aria-label={`Confidence ${value}`}
                  disabled={isDisabled}
                  onClick={() => setConfidence(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="control-group">
            <span>Setup Quality</span>
            <div className="segmented">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  className={setupQuality === value ? "active" : undefined}
                  key={value}
                  type="button"
                  aria-label={`Setup quality ${value}`}
                  disabled={isDisabled}
                  onClick={() => setSetupQuality(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
        <details
          className="capture-details"
          open={isDetailsOpen}
          onToggle={(event) => setIsDetailsOpen(event.currentTarget.open)}
        >
          <summary>
            <span>Details</span>
            <strong>{detailSummary}</strong>
          </summary>
          <div className="capture-details-body">
            <div className="capture-details-copy">
              <span>{editingLabel ? "Editing saved detail" : "Optional context"}</span>
              <strong>{detailSummary}</strong>
            </div>
            {canRepairEntryIntent || canRepairExitLinkage ? (
              <div className="qa-repair-panel" aria-label="QA repair" role="region">
                <div>
                  <span>QA repair</span>
                  <strong>
                    {canRepairEntryIntent
                      ? "Entry needs setup, bias, and direction"
                      : "Exit needs linkage"}
                  </strong>
                </div>
                {canRepairEntryIntent ? (
                  <>
                    <button type="button" disabled={isDisabled} onClick={() => applyEntryIntentRepair("long_ticker")}>
                      Long Ticker Setup
                    </button>
                    <button type="button" disabled={isDisabled} onClick={() => applyEntryIntentRepair("short_ticker")}>
                      Short Ticker Setup
                    </button>
                  </>
                ) : null}
                {canRepairExitLinkage ? (
                  <button type="button" disabled={isDisabled} onClick={applyExitLinkageRepair}>
                    Link Previous Label
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="lifecycle-workspace" aria-label="Lifecycle workspace">
              <div>
                <span>Lifecycle</span>
                <strong>{setupId || tradeId || lastLabel?.setupId || "No active idea"}</strong>
              </div>
              <button type="button" disabled={isDisabled} onClick={startSetup}>
                Start Setup
              </button>
              <button type="button" disabled={isDisabled} onClick={startTrade}>
                Start Trade
              </button>
              <button type="button" disabled={isDisabled || !lastLabel} onClick={continueLastLifecycle}>
                Continue Last
              </button>
              <button type="button" disabled={isDisabled} onClick={clearLifecycle}>
                Clear
              </button>
            </div>
            <div className="lifecycle-linkage-editor" aria-label="Trade linkage editor" role="region">
              <div>
                <span>Trade Linkage</span>
                <strong>{linkedLabel?.tradeId ?? linkedLabel?.setupId ?? "No linked trade"}</strong>
              </div>
              <button type="button" disabled={isDisabled} onClick={startEntryTrade}>
                Entry Trade
              </button>
              <button
                type="button"
                disabled={isDisabled || !latestOpenTradeLabel(sessionLabels)}
                onClick={attachExitToOpenTrade}
              >
                Attach Exit
              </button>
              <button type="button" disabled={isDisabled} onClick={attachInvalidationToSetup}>
                Invalidate Setup
              </button>
              <button type="button" disabled={isDisabled} onClick={markSkipReview}>
                Skip Review
              </button>
            </div>
            <div className="lifecycle-card-list" aria-label="Trade lifecycle cards" role="region">
              <div className="label-history-header">
                <span>Trade Cards</span>
                <strong>{lifecycleItems.length}</strong>
              </div>
              {lifecycleItems.length === 0 ? (
                <p className="label-history-empty">No linked trades yet</p>
              ) : (
                lifecycleItems.map((item) => (
                  <article className={`lifecycle-card ${item.status}`} key={item.id}>
                    <strong>{item.title}</strong>
                    <span>{item.status}</span>
                    <small>{outcomeStatusLabel(item.outcome)}</small>
                  </article>
                ))
              )}
            </div>
            <div className="lifecycle-fields" aria-label="Setup and trade metadata">
              <label>
                <span>Setup ID</span>
                <input
                  type="text"
                  value={setupId}
                  placeholder="setup-1"
                  disabled={isDisabled}
                  onChange={(event) => setSetupId(event.target.value)}
                />
              </label>
              <label>
                <span>Trade ID</span>
                <input
                  type="text"
                  value={tradeId}
                  placeholder="trade-1"
                  disabled={isDisabled}
                  onChange={(event) => setTradeId(event.target.value)}
                />
              </label>
              <label>
                <span>Parent Label</span>
                <input
                  type="text"
                  value={parentLabelId}
                  placeholder="label id"
                  disabled={isDisabled}
                  onChange={(event) => setParentLabelId(event.target.value)}
                />
              </label>
              <label>
                <span>Role</span>
                <select
                  value={decisionRole}
                  disabled={isDisabled}
                  onChange={(event) => setDecisionRole(event.target.value as DecisionRole | "auto")}
                >
                  <option value="auto">Auto</option>
                  {decisionRoles.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Bias</span>
                <select
                  value={bias}
                  disabled={isDisabled}
                  onChange={(event) => setBias(event.target.value as Bias)}
                >
                  {biasOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Direction</span>
                <select
                  value={tradeDirection}
                  disabled={isDisabled}
                  onChange={(event) => setTradeDirection(event.target.value as TradeDirection)}
                >
                  {tradeDirections.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="reason-list">
              {reasonCodes.map((reason) => (
                <label key={reason.value}>
                  <input
                    type="checkbox"
                    disabled={isDisabled}
                    checked={selectedReasonSet.has(reason.value)}
                    onChange={() => toggleReason(reason.value)}
                  />
                  {reason.label}
                </label>
              ))}
            </div>
            <textarea
              className="notes-input"
              aria-label="Label notes"
              placeholder="Notes"
              disabled={isDisabled}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </details>
      </div>
      {showTrustStrip ? (
        <section className="capture-review-strip" aria-label="Dataset trust compact summary">
          <div>
            <span>Data Review</span>
            <strong>{trustStatus}</strong>
          </div>
          <div>
            <span>Blockers</span>
            <strong>{validationSummary?.errorCount ?? 0}</strong>
          </div>
          <div>
            <span>Warnings</span>
            <strong>{validationSummary?.warningCount ?? 0}</strong>
          </div>
        </section>
      ) : null}
      {labelError ? (
        <p className="capture-status error" role="alert">
          <strong>Error</strong>
          <span>{labelError}</span>
        </p>
      ) : null}
      {labelStatus ? (
        <p className="capture-status" role="status">
          <strong>{labelStatus}</strong>
          {statusDetail ? <span>{statusDetail}</span> : null}
        </p>
      ) : null}
      {editingLabel ? (
        <section className="label-editor" aria-label="Edit captured label">
          <div className="label-editor-header">
            <span>Edit Label</span>
            <strong>{editingLabel.ticker} {editingLabel.timestamp.slice(0, 10)}</strong>
          </div>
          <div className="label-type-editor" aria-label="Edit label type">
            {labelTypes.map((label) => (
              <button
                className={editingLabelType === label.value ? "active" : undefined}
                key={label.value}
                type="button"
                aria-label={`Set label type ${label.label}`}
                disabled={isSavingLabel}
                onClick={() => setEditingLabelType(label.value)}
              >
                <span>{label.label}</span>
                <kbd>{label.key.toUpperCase()}</kbd>
              </button>
            ))}
          </div>
          <div className="label-editor-actions">
            <button type="button" disabled={isSavingLabel} onClick={() => void saveEditingLabel()}>
              {pendingEditAction === "save" ? "Saving..." : "Save Changes"}
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={isSavingLabel}
              onClick={() => void deleteEditingLabel()}
            >
              {pendingEditAction === "delete" ? "Deleting..." : "Delete Label"}
            </button>
          </div>
        </section>
      ) : null}
      <section className="outcome-action-panel" aria-label="Outcome calculation">
        <div>
          <span>Outcome</span>
          <strong>{targetOutcomeStatus === "no_label" ? "No label" : outcomeStatusLabel(targetOutcomeStatus)}</strong>
          {outcomeTarget?.outcomeHorizonBars ? <small>{outcomeTarget.outcomeHorizonBars} bars</small> : null}
          {outcomeTarget?.outcomeRuleVersion ? <small>{outcomeTarget.outcomeRuleVersion}</small> : null}
        </div>
        <button
          type="button"
          disabled={isSavingLabel || !outcomeTarget}
          onClick={() => void calculateOutcomeForTarget()}
        >
          {isSavingLabel ? "Working..." : "Calculate Outcome"}
        </button>
      </section>
      <section className="label-history" aria-label="Captured labels">
        <div className="label-history-header">
          <span>Labels</span>
          <strong>{sessionLabels.length}</strong>
        </div>
        {sessionLabels.length === 0 ? (
          <p className="label-history-empty">No labels yet</p>
        ) : (
          <ol>
            {sessionLabels.map((label) => (
              <li key={label.id}>
                <button
                  type="button"
                  aria-current={selectedLabelId === label.id ? "true" : undefined}
                  className={selectedLabelId === label.id ? "selected" : undefined}
                  onClick={() => startEditing(label)}
                  aria-label={`Edit ${label.labelType} ${label.ticker} ${label.price.toFixed(2)} ${label.timeframe}`}
                >
                  <strong>{label.labelType}</strong>
                  <span>{label.ticker}</span>
                  <span>{label.timeframe}</span>
                  <span>{label.price.toFixed(2)}</span>
                  <small className={`provenance-badge ${labelProvenance(label).className}`}>
                    {labelProvenance(label).label}
                  </small>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
}
