import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "../store/useAppStore";
import type {
  ExportValidationIssue,
  ExportValidationReport,
  ReviewSummary,
  SyncChartResponse,
  TradeEvent
} from "../api/client";

const labelTypes = ["ENTRY", "EXIT", "SKIP", "INVALID"] as const;

function formatPercent(value: number | null): string {
  return value === null ? "--" : `${(value * 100).toFixed(0)}%`;
}

function formatReturn(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatNumber(value: number | null, digits = 2): string {
  return value === null ? "--" : value.toFixed(digits);
}

function topEntries(values: Record<string, number>, limit = 3) {
  return Object.entries(values)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);
}

function topKey(values: Record<string, number> | undefined): string {
  return topEntries(values ?? {}, 1)[0]?.[0]?.replaceAll("_", " ") ?? "--";
}

function formatClassification(value: string): string {
  return value.replaceAll("_", " ").replace("ETF", "ETF").replace("etf", "ETF");
}

function dataReviewCounts(syncDataByTimeframe: Partial<Record<string, SyncChartResponse>>) {
  const counts: Record<string, number> = {};

  for (const data of Object.values(syncDataByTimeframe)) {
    for (const warning of data?.warnings ?? []) {
      if (warning.severity !== "review") {
        continue;
      }

      counts[warning.classification] = (counts[warning.classification] ?? 0) + 1;
    }
  }

  return counts;
}

function readinessStatus(validation: ExportValidationReport | null): {
  label: string;
  className: "blocked" | "limited" | "ready";
  blockers: string[];
} {
  const summary = validation?.summary;
  const blockers: string[] = [];

  if (!summary || summary.totalLabels < 25) {
    blockers.push("Need 25+ labels");
  }
  if ((summary?.labelsByLabelType.ENTRY ?? 0) < 10) {
    blockers.push("Need 10+ entries");
  }
  if ((summary?.labelsByLabelType.EXIT ?? 0) < 5) {
    blockers.push("Need 5+ exits");
  }
  if ((summary?.labelsWithSetupId ?? 0) < 10) {
    blockers.push("Need setup IDs");
  }
  if ((summary?.labelsWithOutcomeAvailable ?? 0) < 10) {
    blockers.push("Need outcomes");
  }
  if ((summary?.errorCount ?? 0) > 0) {
    blockers.push("Fix validation errors");
  }

  if (blockers.length === 0 && (summary?.warningCount ?? 0) === 0) {
    return { label: "Ready to explore", className: "ready", blockers };
  }
  if (blockers.length <= 2 && (summary?.totalLabels ?? 0) >= 25) {
    return { label: "Limited", className: "limited", blockers };
  }

  return { label: "Not ready", className: "blocked", blockers };
}

type IndicatorAverage = ReviewSummary["indicatorAverages"]["entries"];
type QaFilter = "all" | "errors" | "warnings" | "leakage" | "intent" | "outcome";
type QaQueueSeverity = "blocker" | "warning" | "info";

type QaQueueIssue = {
  issueId: string;
  severity: QaQueueSeverity;
  code: string;
  labelIds: string[];
  message: string;
  suggestedFix: string;
  label: TradeEvent | undefined;
};

type ProvenanceCounts = {
  futureVisible: number;
  regular: number;
  replaySafe: number;
};

function IndicatorAverageBlock({
  label,
  values
}: {
  label: string;
  values: IndicatorAverage | undefined;
}) {
  return (
    <div className="review-signal-card">
      <div className="label-history-header">
        <span>{label}</span>
        <strong>{values?.count ?? 0}</strong>
      </div>
      <p>
        <span>SMIO</span>
        <strong>{formatNumber(values?.smioOscillator ?? null, 4)}</strong>
      </p>
      <p>
        <span>Stoch K/D</span>
        <strong>{formatNumber(values?.stochK ?? null)} / {formatNumber(values?.stochD ?? null)}</strong>
      </p>
      <p>
        <span>ATR</span>
        <strong>{formatNumber(values?.atr14Rma ?? null)}</strong>
      </p>
      <p>
        <span>EMA25 Dist</span>
        <strong>{formatReturn(values?.ema25DistancePercent ?? null)}</strong>
      </p>
    </div>
  );
}

function ReasonList({
  emptyLabel,
  reasons
}: {
  emptyLabel: string;
  reasons: Record<string, number> | undefined;
}) {
  const entries = topEntries(reasons ?? {}, 4);

  if (entries.length === 0) {
    return <p className="label-history-empty">{emptyLabel}</p>;
  }

  return entries.map(([reason, count]) => (
    <p key={reason}>
      <span>{reason.replaceAll("_", " ")}</span>
      <strong>{count}</strong>
    </p>
  ));
}

function validationIssueSeverity(issue: ExportValidationIssue): QaQueueSeverity {
  return issue.severity === "error" ? "blocker" : "warning";
}

function suggestedFixForIssue(issue: Pick<ExportValidationIssue, "code" | "message">): string {
  if (issue.code.includes("entry_intent")) {
    return "Open the label and fill setup, bias, and trade direction.";
  }
  if (issue.code.includes("exit_linkage") || issue.code.includes("parent")) {
    return "Link the exit to its entry, setup, or trade before research export.";
  }
  if (issue.code.includes("leakage") || issue.code.includes("visible_until")) {
    return "Prefer replay labels or confirm the visible boundary before using it for simulation.";
  }
  if (issue.code.includes("paired")) {
    return "Reload paired ETF context or mark this as unavailable before trusting the row.";
  }
  if (issue.code.includes("outcome")) {
    return "Calculate outcome when enough future bars exist; keep outcomes out of decision features.";
  }
  if (issue.code.includes("data_review")) {
    return "Review the imported bars; keep as info unless the source data is actually wrong.";
  }

  return issue.message;
}

function issueMatchesFilter(issue: QaQueueIssue, filter: QaFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "errors") {
    return issue.severity === "blocker";
  }
  if (filter === "warnings") {
    return issue.severity === "warning";
  }
  if (filter === "leakage") {
    return issue.code.includes("leakage") || issue.code.includes("visible_until");
  }
  if (filter === "intent") {
    return issue.code.includes("intent") || issue.code.includes("linkage");
  }

  return issue.code.includes("outcome");
}

function qaIssueContext(issue: ExportValidationIssue, label: TradeEvent | undefined): string {
  if (!issue.labelId) {
    return "Dataset issue";
  }

  if (!label) {
    return "Missing label context";
  }

  return `${label.labelType} ${label.ticker} ${label.timeframe} ${label.timestamp.slice(0, 10)}`;
}

function qaQueueContext(issue: QaQueueIssue): string {
  if (issue.label) {
    return qaIssueContext(
      {
        severity: issue.severity === "blocker" ? "error" : "warning",
        code: issue.code,
        labelId: issue.label.id,
        message: issue.message
      },
      issue.label
    );
  }

  return issue.labelIds.length > 0 ? "Missing label context" : "Dataset issue";
}

function exportReadinessLabel(blockers: number, warnings: number): string {
  if (blockers > 0) {
    return "Export blocked";
  }
  if (warnings > 0) {
    return "Export needs review";
  }

  return "Export ready";
}

function sessionSummaryStatus({
  activeSession,
  blockers,
  info,
  labelCount,
  warnings
}: {
  activeSession: boolean;
  blockers: number;
  info: number;
  labelCount: number;
  warnings: number;
}): string {
  if (blockers > 0) {
    return "Blocked";
  }
  if (warnings > 0) {
    return "Needs review";
  }
  if (!activeSession && labelCount === 0) {
    return "No session";
  }
  if (info > 0) {
    return "Info only";
  }
  if (labelCount > 0) {
    return "Clean";
  }

  return "No labels";
}

function sessionSummaryNextAction({
  activeSession,
  blockers,
  info,
  labelCount,
  warnings
}: {
  activeSession: boolean;
  blockers: number;
  info: number;
  labelCount: number;
  warnings: number;
}): string {
  if (blockers > 0) {
    return "Fix blockers";
  }
  if (warnings > 0) {
    return "Review warnings";
  }
  if (!activeSession && labelCount === 0) {
    return "Start session";
  }
  if (info > 0) {
    return "Review info";
  }
  if (labelCount > 0) {
    return "Continue labeling";
  }

  return "Select a candle";
}

function sessionSummaryActionIsClickable({
  activeSession,
  blockers,
  info,
  labelCount,
  warnings
}: {
  activeSession: boolean;
  blockers: number;
  info: number;
  labelCount: number;
  warnings: number;
}): boolean {
  return blockers > 0 || warnings > 0 || info > 0 || labelCount > 0 || !activeSession;
}

function provenanceCounts(labels: TradeEvent[]): ProvenanceCounts {
  return labels.reduce<ProvenanceCounts>(
    (counts, label) => {
      if (label.captureMode === "replay" && !label.potentialVisualLeakage) {
        counts.replaySafe += 1;
      } else if (label.potentialVisualLeakage) {
        counts.futureVisible += 1;
      } else {
        counts.regular += 1;
      }

      return counts;
    },
    { futureVisible: 0, regular: 0, replaySafe: 0 }
  );
}

function replayCoverageStatus(counts: ProvenanceCounts): {
  className: "blocked" | "limited" | "ready";
  label: string;
} {
  if (counts.replaySafe === 0 && counts.futureVisible > 0) {
    return { className: "blocked", label: "Regular only" };
  }
  if (counts.futureVisible > 0) {
    return { className: "limited", label: "Mixed provenance" };
  }
  if (counts.replaySafe > 0) {
    return { className: "ready", label: "Replay-clean" };
  }

  return { className: "blocked", label: "No labels" };
}

function buildQaQueueIssues({
  dataReviewClassificationCounts,
  labelsById,
  validation
}: {
  dataReviewClassificationCounts: Record<string, number>;
  labelsById: Map<string, TradeEvent>;
  validation: ExportValidationReport | null;
}): QaQueueIssue[] {
  const validationIssues = (validation?.issues ?? []).map((issue, index): QaQueueIssue => {
    const label = issue.labelId ? labelsById.get(issue.labelId) : undefined;

    return {
      issueId: `${issue.labelId ?? "dataset"}-${issue.code}-${index}`,
      severity: validationIssueSeverity(issue),
      code: issue.code,
      labelIds: issue.labelId ? [issue.labelId] : [],
      message: issue.message,
      suggestedFix: suggestedFixForIssue(issue),
      label
    };
  });

  const dataReviewIssues = topEntries(dataReviewClassificationCounts, 4).map(
    ([classification, count]): QaQueueIssue => ({
      issueId: `data-review-${classification}`,
      severity: "info",
      code: `data_review_${classification}`,
      labelIds: [],
      message: `${count} ${formatClassification(classification)} ${count === 1 ? "event" : "events"}`,
      suggestedFix: suggestedFixForIssue({
        code: "data_review",
        message: "Review the imported bars."
      }),
      label: undefined
    })
  );

  return [...validationIssues, ...dataReviewIssues].sort((left, right) => {
    const rank: Record<QaQueueSeverity, number> = { blocker: 0, warning: 1, info: 2 };
    return rank[left.severity] - rank[right.severity] || left.code.localeCompare(right.code);
  });
}

export function ReviewPanel() {
  const activeSession = useAppStore((state) => state.activeSession);
  const reviewSummary = useAppStore((state) => state.reviewSummary);
  const exportValidationReport = useAppStore((state) => state.exportValidationReport);
  const syncDataByTimeframe = useAppStore((state) => state.syncDataByTimeframe);
  const reviewError = useAppStore((state) => state.reviewError);
  const sessionLabels = useAppStore((state) => state.sessionLabels);
  const focusLabel = useAppStore((state) => state.focusLabel);
  const loadReviewSummary = useAppStore((state) => state.loadReviewSummary);
  const startSession = useAppStore((state) => state.startSession);
  const [qaFilter, setQaFilter] = useState<QaFilter>("all");
  const [isOpen, setIsOpen] = useState(false);
  const openTrustPanel = () => {
    setIsOpen(true);
  };

  useEffect(() => {
    void loadReviewSummary(activeSession?.id);
  }, [activeSession?.id, loadReviewSummary]);

  const summary = reviewSummary;
  const validation = exportValidationReport;
  const validationLabel =
    validation?.status === "pass" ? "Ready" : validation?.status === "fail" ? "Failing" : "Needs Review";
  const researchReadiness = readinessStatus(validation);
  const dataReviewClassificationCounts = useMemo(
    () => dataReviewCounts(syncDataByTimeframe),
    [syncDataByTimeframe]
  );
  const dataReviewTotal = Object.values(dataReviewClassificationCounts).reduce(
    (total, count) => total + count,
    0
  );
  const labelsById = useMemo(
    () => new Map(sessionLabels.map((label) => [label.id, label])),
    [sessionLabels]
  );
  const qaIssues = useMemo(
    () =>
      buildQaQueueIssues({
        dataReviewClassificationCounts,
        labelsById,
        validation
      }).filter((issue) => issueMatchesFilter(issue, qaFilter)),
    [dataReviewClassificationCounts, labelsById, qaFilter, validation]
  );
  const qaIssueCounts = useMemo(() => {
    const issues = buildQaQueueIssues({
      dataReviewClassificationCounts,
      labelsById,
      validation
    });

    return {
      blocker: issues.filter((issue) => issue.severity === "blocker").length,
      warning: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length,
      total: issues.length
    };
  }, [dataReviewClassificationCounts, labelsById, validation]);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const replayCoverageCounts = useMemo(() => provenanceCounts(sessionLabels), [sessionLabels]);
  const replayCoverage = replayCoverageStatus(replayCoverageCounts);
  const validationSummary = validation?.summary;
  const dashboardLabelCount = validationSummary?.totalLabels ?? summary?.totalLabels ?? sessionLabels.length;
  const dashboardStatus = sessionSummaryStatus({
    activeSession: Boolean(activeSession),
    blockers: validationSummary?.errorCount ?? qaIssueCounts.blocker,
    info: qaIssueCounts.info,
    labelCount: dashboardLabelCount,
    warnings: validationSummary?.warningCount ?? qaIssueCounts.warning
  });
  const dashboardNextAction = sessionSummaryNextAction({
    activeSession: Boolean(activeSession),
    blockers: validationSummary?.errorCount ?? qaIssueCounts.blocker,
    info: qaIssueCounts.info,
    labelCount: dashboardLabelCount,
    warnings: validationSummary?.warningCount ?? qaIssueCounts.warning
  });
  const dashboardActionIsClickable = sessionSummaryActionIsClickable({
    activeSession: Boolean(activeSession),
    blockers: validationSummary?.errorCount ?? qaIssueCounts.blocker,
    info: qaIssueCounts.info,
    labelCount: dashboardLabelCount,
    warnings: validationSummary?.warningCount ?? qaIssueCounts.warning
  });
  useEffect(() => {
    if (qaFilter === "errors" && qaIssueCounts.blocker === 0) {
      setQaFilter("all");
    }
    if (qaFilter === "warnings" && qaIssueCounts.warning === 0) {
      setQaFilter("all");
    }
  }, [qaFilter, qaIssueCounts.blocker, qaIssueCounts.warning]);
  const handleDashboardAction = () => {
    const blockers = validationSummary?.errorCount ?? qaIssueCounts.blocker;
    const warnings = validationSummary?.warningCount ?? qaIssueCounts.warning;

    if (blockers > 0) {
      setQaFilter("errors");
      openTrustPanel();
      return;
    }

    if (warnings > 0) {
      setQaFilter("warnings");
      openTrustPanel();
      return;
    }

    if (!activeSession && dashboardLabelCount === 0) {
      void startSession({
        name: "Quick capture",
        tickerFocus: "SOXL",
        timeframeFocus: "4H"
      });
      return;
    }

    if (qaIssueCounts.info > 0) {
      setQaFilter("all");
      openTrustPanel();
      return;
    }

    if (dashboardLabelCount > 0) {
      setQaFilter("all");
      openTrustPanel();
      return;
    }
  };

  return (
    <aside className="review-panel" aria-label="Review dashboard">
      <details
        className="secondary-panel"
        open={isOpen}
        onToggle={(event) => setIsOpen(event.currentTarget.open)}
      >
        <summary>
          <span>Review Data</span>
          <strong>
            {dashboardStatus} · {dashboardLabelCount} labels
          </strong>
        </summary>
        <div className="secondary-panel-body">
          {reviewError ? <p className="capture-status error">{reviewError}</p> : null}
          <section className="session-summary-dashboard" aria-label="Session summary dashboard">
            <div className="session-summary-head">
              <span>{activeSession ? "Active Session" : "All Labels"}</span>
              <strong>{dashboardStatus}</strong>
            </div>
            <div className="session-summary-grid">
              <div>
                <span>Labels</span>
                <strong>{dashboardLabelCount}</strong>
              </div>
              <div>
                <span>Top Type</span>
                <strong>{topKey(validationSummary?.labelsByLabelType)}</strong>
              </div>
              <div>
                <span>Ticker</span>
                <strong>{topKey(validationSummary?.labelsByTicker)}</strong>
              </div>
              <div>
                <span>Timeframe</span>
                <strong>{topKey(validationSummary?.labelsByTimeframe)}</strong>
              </div>
              <div>
                <span>Replay-safe</span>
                <strong>{replayCoverageCounts.replaySafe}</strong>
              </div>
              <div>
                <span>Linked</span>
                <strong>{validationSummary?.labelsWithTradeId ?? 0}</strong>
              </div>
              <div>
                <span>Outcomes</span>
                <strong>{validationSummary?.labelsWithOutcomeAvailable ?? 0}</strong>
              </div>
              <div>
                <span>QA B/W/I</span>
                <strong>{qaIssueCounts.blocker}/{qaIssueCounts.warning}/{qaIssueCounts.info}</strong>
              </div>
            </div>
            {dashboardActionIsClickable ? (
              <button
                aria-label="Session summary next action"
                className="session-summary-action"
                type="button"
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    handleDashboardAction();
                  }
                }}
                onMouseDown={handleDashboardAction}
              >
                <span>Next Review</span>
                <strong>{dashboardNextAction}</strong>
              </button>
            ) : (
              <p className="session-summary-action passive" aria-label="Session summary next step">
                <span>Next Review</span>
                <strong>{dashboardNextAction}</strong>
              </p>
            )}
          </section>
          <div className="review-scope">
            <span>{activeSession ? "Active session" : "All labels"}</span>
          </div>
          <section
            className={`validation-health ${validation?.status ?? "warning"}`}
            aria-label="Dataset health summary"
          >
            <div className="validation-health-head">
              <span>Dataset Health</span>
              <strong>{validationLabel}</strong>
            </div>
            <div className="validation-health-grid">
              <div>
                <span>Errors</span>
                <strong>{validation?.summary.errorCount ?? 0}</strong>
              </div>
              <div>
                <span>Warnings</span>
                <strong>{validation?.summary.warningCount ?? 0}</strong>
              </div>
              <div>
                <span>Paired Missing</span>
                <strong>{validation?.summary.labelsWithMissingPairedContext ?? 0}</strong>
              </div>
              <div>
                <span>Leakage</span>
                <strong>{validation?.summary.labelsWithLeakageWarnings ?? 0}</strong>
              </div>
              <div>
                <span>Intent Gaps</span>
                <strong>{validation?.summary.labelsWithIncompleteIntent ?? 0}</strong>
              </div>
            </div>
            <div className="lifecycle-health-grid" aria-label="Lifecycle coverage summary">
              <div>
                <span>Setup IDs</span>
                <strong>{validation?.summary.labelsWithSetupId ?? 0}</strong>
              </div>
              <div>
                <span>Trade IDs</span>
                <strong>{validation?.summary.labelsWithTradeId ?? 0}</strong>
              </div>
              <div>
                <span>Top Role</span>
                <strong>{topKey(validation?.summary.labelsByDecisionRole)}</strong>
              </div>
              <div>
                <span>Top Bias</span>
                <strong>{topKey(validation?.summary.labelsByBias)}</strong>
              </div>
              <div>
                <span>Direction</span>
                <strong>{topKey(validation?.summary.labelsByTradeDirection)}</strong>
              </div>
            </div>
            <div className="outcome-health-grid" aria-label="Outcome export summary">
              <div>
                <span>Outcome Rows</span>
                <strong>{validation?.summary.labelsWithOutcomeAvailable ?? 0}</strong>
              </div>
              <div>
                <span>Computed</span>
                <strong>{validation?.summary.labelsByOutcomeStatus.computed ?? 0}</strong>
              </div>
              <div>
                <span>Pending</span>
                <strong>{validation?.summary.labelsByOutcomeStatus.pending ?? 0}</strong>
              </div>
              <div>
                <span>Insufficient</span>
                <strong>{validation?.summary.labelsByOutcomeStatus.insufficient_future_bars ?? 0}</strong>
              </div>
              <div>
                <span>Missing Exit</span>
                <strong>{validation?.summary.labelsByOutcomeStatus.missing_exit ?? 0}</strong>
              </div>
              <div>
                <span>Invalidated</span>
                <strong>{validation?.summary.labelsByOutcomeStatus.invalidated ?? 0}</strong>
              </div>
              <div>
                <span>Decision CSV</span>
                <strong>
                  {validation?.summary.outcomeFieldsExcludedFromDecisionCsv === false
                    ? "Includes outcomes"
                    : "No outcomes"}
                </strong>
              </div>
              <div>
                <span>Rule</span>
                <strong>{topKey(validation?.summary.outcomeRuleVersions) === "--" ? "Not run" : topKey(validation?.summary.outcomeRuleVersions)}</strong>
              </div>
            </div>
            <div
              className={`research-readiness ${researchReadiness.className}`}
              aria-label="Research readiness summary"
            >
              <div className="research-readiness-head">
                <span>Research Readiness</span>
                <strong>{researchReadiness.label}</strong>
              </div>
              <div className="research-readiness-grid">
                <div>
                  <span>Labels</span>
                  <strong>{validation?.summary.totalLabels ?? 0}</strong>
                </div>
                <div>
                  <span>Replay</span>
                  <strong>{validation?.summary.labelsByReplayMode.replay ?? 0}</strong>
                </div>
                <div>
                  <span>Entries</span>
                  <strong>{validation?.summary.labelsByLabelType.ENTRY ?? 0}</strong>
                </div>
                <div>
                  <span>Exits</span>
                  <strong>{validation?.summary.labelsByLabelType.EXIT ?? 0}</strong>
                </div>
                <div>
                  <span>Outcomes</span>
                  <strong>{validation?.summary.labelsWithOutcomeAvailable ?? 0}</strong>
                </div>
              </div>
              <p>
                <span>Next Gate</span>
                <strong>{researchReadiness.blockers[0] ?? "Review candidates manually"}</strong>
              </p>
            </div>
            <div
              className={`research-readiness ${replayCoverage.className}`}
              aria-label="Replay-clean coverage summary"
            >
              <div className="research-readiness-head">
                <span>Replay Clean</span>
                <strong>{replayCoverage.label}</strong>
              </div>
              <div className="research-readiness-grid">
                <div>
                  <span>Replay-safe</span>
                  <strong>{replayCoverageCounts.replaySafe}</strong>
                </div>
                <div>
                  <span>Future-visible</span>
                  <strong>{replayCoverageCounts.futureVisible}</strong>
                </div>
                <div>
                  <span>Regular</span>
                  <strong>{replayCoverageCounts.regular}</strong>
                </div>
                <div>
                  <span>Simulation</span>
                  <strong>{replayCoverageCounts.replaySafe}</strong>
                </div>
                <div>
                  <span>All Labels</span>
                  <strong>{sessionLabels.length || (validation?.summary.totalLabels ?? 0)}</strong>
                </div>
              </div>
              <p>
                <span>Training Set</span>
                <strong>
                  {replayCoverageCounts.replaySafe > 0
                    ? "Use replay-safe only"
                    : "Collect replay labels"}
                </strong>
              </p>
            </div>
            {dataReviewTotal > 0 ? (
              <div className="outcome-health-grid" aria-label="Data review classification summary">
                <div>
                  <span>Data Review</span>
                  <strong>{dataReviewTotal}</strong>
                </div>
                {topEntries(dataReviewClassificationCounts, 4).map(([classification, count]) => (
                  <div key={classification}>
                    <span>{formatClassification(classification)}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="qa-readiness-strip" aria-label="Export readiness by issue severity">
              <div>
                <span>Blockers</span>
                <strong>{qaIssueCounts.blocker}</strong>
              </div>
              <div>
                <span>Warnings</span>
                <strong>{qaIssueCounts.warning}</strong>
              </div>
              <div>
                <span>Info</span>
                <strong>{qaIssueCounts.info}</strong>
              </div>
              <p>
                <span>{exportReadinessLabel(qaIssueCounts.blocker, qaIssueCounts.warning)}</span>
                <strong>{qaIssueCounts.total}</strong>
              </p>
            </div>
          </section>
          <section className="review-metrics" aria-label="Label counts">
            {labelTypes.map((type) => (
              <div className="review-metric" key={type}>
                <span>{type}</span>
                <strong>{summary?.counts[type] ?? 0}</strong>
              </div>
            ))}
          </section>
          <section className="qa-review-panel" aria-label="Actionable QA issue queue">
            <div className="label-history-header">
              <span>Issue Queue</span>
              <strong>{qaIssueCounts.total}</strong>
            </div>
            <div className="qa-filter-row" role="group" aria-label="QA filters">
              {([
                ["all", "All"],
                ["errors", "Errors"],
                ["warnings", "Warnings"],
                ["leakage", "Leakage"],
                ["intent", "Intent"],
                ["outcome", "Outcome"]
              ] as const).map(([value, label]) => (
                <button
                  className={qaFilter === value ? "active" : undefined}
                  key={value}
                  type="button"
                  onClick={() => setQaFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {qaIssues.length === 0 ? (
              <p className="label-history-empty">
                {qaIssueCounts.total ? "No issues match this filter" : "No QA issues"}
              </p>
            ) : (
              <ol className="qa-issue-list">
                {qaIssues.slice(0, 8).map((issue) => {
                  return (
                    <li key={issue.issueId}>
                      <button
                        className={`${issue.severity}${activeIssueId === issue.issueId ? " active" : ""}`}
                        type="button"
                        onClick={() => {
                          setActiveIssueId(issue.issueId);
                          if (issue.label) {
                            void focusLabel(issue.label);
                          }
                        }}
                      >
                        <strong>{issue.severity}</strong>
                        <span>{issue.code.replaceAll("_", " ")}</span>
                        <small>{qaQueueContext(issue)}</small>
                        <em>{issue.suggestedFix}</em>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          <section className="review-row" aria-label="Trade pair summary">
            <div>
              <span>Pairs</span>
              <strong>{summary?.pairedTrades.count ?? 0}</strong>
            </div>
            <div>
              <span>Win Rate</span>
              <strong>{formatPercent(summary?.pairedTrades.winRate ?? null)}</strong>
            </div>
            <div>
              <span>Avg Return</span>
              <strong>{formatReturn(summary?.pairedTrades.averageReturnPercent ?? null)}</strong>
            </div>
          </section>
          <section className="review-distribution" aria-label="Confidence distribution">
            <span>Confidence</span>
            <div>
              {[1, 2, 3, 4, 5].map((value) => (
                <strong key={value}>
                  {value}:{summary?.confidenceDistribution[String(value)] ?? 0}
                </strong>
              ))}
            </div>
          </section>
          <section className="review-distribution" aria-label="Setup quality distribution">
            <span>Setup Quality</span>
            <div>
              {[1, 2, 3, 4, 5].map((value) => (
                <strong key={value}>
                  {value}:{summary?.setupQualityDistribution[String(value)] ?? 0}
                </strong>
              ))}
            </div>
          </section>
          <section className="review-list" aria-label="Condition summary">
            <div className="label-history-header">
              <span>Conditions</span>
              <strong>{summary?.totalLabels ?? 0}</strong>
            </div>
            <p>
              <span>Entries with marker</span>
              <strong>{summary?.conditionSummary.entriesWithBreakoutMarker ?? 0}</strong>
            </p>
            <p>
              <span>Near trendline</span>
              <strong>{summary?.conditionSummary.entriesNearTrendline ?? 0}</strong>
            </p>
            <p>
              <span>Near level</span>
              <strong>{summary?.conditionSummary.entriesNearLevel ?? 0}</strong>
            </p>
          </section>
          <section className="review-list" aria-label="Reason code summary">
            <div className="label-history-header">
              <span>Top Reasons</span>
              <strong>{topEntries(summary?.conditionSummary.entryReasonCodes ?? {}).length}</strong>
            </div>
            <ReasonList
              emptyLabel="No reason codes yet"
              reasons={summary?.conditionSummary.entryReasonCodes}
            />
          </section>
          <section className="review-signal-grid" aria-label="Indicator extraction summary">
            <IndicatorAverageBlock label="Profitable Entries" values={summary?.indicatorAverages?.profitableEntries} />
            <IndicatorAverageBlock label="Skipped Trades" values={summary?.indicatorAverages?.skipped} />
          </section>
          <section className="review-list" aria-label="Loss cluster summary">
            <div className="label-history-header">
              <span>Loss Clusters</span>
              <strong>{summary?.pairedTrades.losses ?? 0}</strong>
            </div>
            <ReasonList
              emptyLabel="No losing pairs yet"
              reasons={summary?.lossClusters?.reasonCodes}
            />
            {summary?.lossClusters?.worstPairs.slice(0, 3).map((pair) => (
              <p key={`${pair.entryId}-${pair.exitId}`}>
                <span>{pair.ticker} {pair.entryTimestamp.slice(0, 10)}</span>
                <strong>{formatReturn(pair.returnPercent)}</strong>
              </p>
            ))}
          </section>
          <section className="review-list" aria-label="Skipped trade summary">
            <div className="label-history-header">
              <span>Skipped Setups</span>
              <strong>{summary?.counts.SKIP ?? 0}</strong>
            </div>
            <ReasonList
              emptyLabel="No skipped setup reasons yet"
              reasons={summary?.conditionSummary.skippedReasonCodes}
            />
          </section>
        </div>
      </details>
    </aside>
  );
}
