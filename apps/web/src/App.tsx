import { useEffect } from "react";

import { ChartGrid4H } from "./charts/ChartGrid4H";
import { CapturePanel } from "./components/CapturePanel";
import { ReplayToolbar } from "./components/ReplayToolbar";
import { useAppStore } from "./store/useAppStore";

export function App() {
  const loadChartData = useAppStore((state) => state.loadChartData);
  const chartDataError = useAppStore((state) => state.chartDataError);
  const importError = useAppStore((state) => state.importError);

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
        <ChartGrid4H />
        <div className="side-rail">
          <CapturePanel />
        </div>
      </div>
    </main>
  );
}
