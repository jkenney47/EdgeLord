import { useEffect } from "react";

import { ChartGrid4H } from "./charts/ChartGrid4H";
import { CapturePanel } from "./components/CapturePanel";
import { ReviewPanel } from "./components/ReviewPanel";
import { ReplayToolbar } from "./components/ReplayToolbar";
import { SessionPanel } from "./components/SessionPanel";
import { ToolRail } from "./components/ToolRail";
import { useAppStore } from "./store/useAppStore";

export function App() {
  const loadChartData = useAppStore((state) => state.loadChartData);
  const chartDataError = useAppStore((state) => state.chartDataError);
  const importError = useAppStore((state) => state.importError);
  const activeSession = useAppStore((state) => state.activeSession);
  const sessionLabels = useAppStore((state) => state.sessionLabels);
  const reviewSummary = useAppStore((state) => state.reviewSummary);
  const exportValidationReport = useAppStore((state) => state.exportValidationReport);
  const labelCount = activeSession ? sessionLabels.length : reviewSummary?.totalLabels ?? 0;
  const qaCount =
    (exportValidationReport?.summary.errorCount ?? 0) + (exportValidationReport?.summary.warningCount ?? 0);
  const workflowSummary = `${activeSession?.name ?? "No session"} · ${labelCount} labels${
    qaCount > 0 ? ` · ${qaCount} QA` : ""
  }`;

  useEffect(() => {
    void loadChartData();
  }, [loadChartData]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">E</span>
          <div>
            <h1>EdgeLord</h1>
            <p>SOXL / SOXS decision capture</p>
          </div>
        </div>
        <ReplayToolbar />
      </header>

      {chartDataError || importError ? (
        <div className="error-banner">{chartDataError ?? importError}</div>
      ) : null}

      <div className="workspace">
        <ToolRail />
        <ChartGrid4H />
        <div className="side-rail">
          <CapturePanel />
          <details className="side-tools secondary-panel">
            <summary>
              <span>Session / Review</span>
              <strong>{workflowSummary}</strong>
            </summary>
            <div className="side-tools-body">
              <SessionPanel />
              <ReviewPanel />
            </div>
          </details>
        </div>
      </div>
    </main>
  );
}
