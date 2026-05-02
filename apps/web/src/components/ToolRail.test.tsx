import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToolRail } from "./ToolRail";
import { createInitialState, useAppStore } from "../store/useAppStore";

describe("ToolRail", () => {
  beforeEach(() => {
    useAppStore.setState({
      ...createInitialState(),
      deleteDrawing: vi.fn().mockResolvedValue({
        id: "drawing-1",
        sessionId: null,
        ticker: "SOXL",
        timeframe: "4H",
        type: "trendline",
        anchors: [
          { timestamp: "2024-01-02T14:30:00.000Z", price: 11 },
          { timestamp: "2024-01-03T14:30:00.000Z", price: 12 }
        ],
        style: { color: "#f2d35e" },
        slope: 0,
        createdAt: "2024-01-02T14:30:00.000Z",
        updatedAt: "2024-01-02T14:30:00.000Z",
        deletedAt: "2024-01-02T14:31:00.000Z"
      }),
      fetchSynchronizedChartData: vi.fn(),
      listDrawings: vi.fn()
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("sets the active drawing tool for the target ticker", async () => {
    render(<ToolRail />);

    await userEvent.click(screen.getByRole("button", { name: "Draw SOXL 4H trendline" }));

    expect(useAppStore.getState().drawingMode).toEqual({
      ticker: "SOXL",
      timeframe: "4H",
      type: "trendline",
      firstAnchor: null
    });
    expect(screen.getByRole("button", { name: "Draw SOXL 4H trendline" })).toHaveClass("active");
    expect(screen.getByRole("status")).toHaveTextContent("Line tool active on SOXL 4H. Click two candles.");
  });

  it("uses the focused ticker as the chart and drawing target", async () => {
    render(<ToolRail />);

    await userEvent.click(screen.getByRole("button", { name: "Target SOXS" }));

    expect(useAppStore.getState().focusedTicker).toBe("SOXS");
    expect(screen.getByRole("button", { name: "Target SOXS" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "Draw SOXS 4H trendline" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Draw SOXS 4H horizontal level" })).not.toBeInTheDocument();
  });

  it("retargets drawing tools from focused ticker state", async () => {
    useAppStore.setState({
      focusedTicker: "SOXS"
    });

    render(<ToolRail />);
    await userEvent.click(screen.getByRole("button", { name: "Mark SOXS 4H breakout candle" }));

    expect(useAppStore.getState().drawingMode).toEqual({
      ticker: "SOXS",
      timeframe: "4H",
      type: "breakout_marker",
      firstAnchor: null
    });
  });

  it("uses the active timeframe for drawing tools", async () => {
    useAppStore.setState({
      activeTimeframe: "2H",
      focusedTicker: "SOXL"
    });

    render(<ToolRail />);

    expect(screen.getByLabelText("Target timeframe 2H")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Target timeframe 2H" })).toHaveClass("active");
    await userEvent.click(screen.getByRole("button", { name: "Mark SOXL 2H breakout candle" }));

    expect(useAppStore.getState().drawingMode).toEqual({
      ticker: "SOXL",
      timeframe: "2H",
      type: "breakout_marker",
      firstAnchor: null
    });
  });

  it("changes the active drawing timeframe from the rail", async () => {
    render(<ToolRail />);

    await userEvent.click(screen.getByRole("button", { name: "Target timeframe 1D" }));

    expect(useAppStore.getState().activeTimeframe).toBe("1D");
    expect(screen.getByRole("button", { name: "Target timeframe 1D" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "Draw SOXL 1D trendline" })).toBeInTheDocument();
  });

  it("toggles the focused chart layout from the rail", async () => {
    render(<ToolRail />);

    expect(screen.getByRole("button", { name: "Show all chart panels" })).toHaveClass("active");

    await userEvent.click(screen.getByRole("button", { name: "Show all chart panels" }));

    expect(useAppStore.getState().chartLayoutMode).toBe("grid");

    await userEvent.click(screen.getByRole("button", { name: "Focus SOXL 4H chart panel" }));

    expect(useAppStore.getState().chartLayoutMode).toBe("focused");
  });

  it("switches between cursor and pan chart interaction modes", async () => {
    render(<ToolRail />);

    await userEvent.click(screen.getByRole("button", { name: "Select pan tool" }));

    expect(useAppStore.getState().chartInteractionMode).toBe("pan");
    expect(screen.getByRole("button", { name: "Select pan tool" })).toHaveClass("active");
    expect(screen.getByRole("status")).toHaveTextContent("Pan mode active. Drag the chart to move it.");

    await userEvent.click(screen.getByRole("button", { name: "Select cursor tool" }));

    expect(useAppStore.getState().chartInteractionMode).toBe("cursor");
    expect(screen.getByRole("button", { name: "Select cursor tool" })).toHaveClass("active");
  });

  it("cancels drawing mode and deletes the selected drawing", async () => {
    useAppStore.setState({
      drawingMode: {
        ticker: "SOXL",
        timeframe: "4H",
        type: "trendline",
        firstAnchor: null
      },
      drawings: [
        {
          id: "drawing-1",
          sessionId: null,
          ticker: "SOXL",
          timeframe: "4H",
          type: "trendline",
          anchors: [
            { timestamp: "2024-01-02T14:30:00.000Z", price: 11 },
            { timestamp: "2024-01-03T14:30:00.000Z", price: 12 }
          ],
          style: { color: "#f2d35e" },
          slope: 0,
          createdAt: "2024-01-02T14:30:00.000Z",
          updatedAt: "2024-01-02T14:30:00.000Z",
          deletedAt: null
        }
      ],
      selectedDrawingId: "drawing-1"
    });

    render(<ToolRail />);

    expect(screen.getByRole("button", { name: "Delete selected drawing SOXL 4H trendline" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Selected SOXL 4H trendline");

    await userEvent.click(screen.getByRole("button", { name: "Select cursor tool" }));

    expect(useAppStore.getState().drawingMode).toBeNull();
    expect(useAppStore.getState().selectedDrawingId).toBeNull();

    useAppStore.getState().selectDrawing("drawing-1");
    await userEvent.click(await screen.findByRole("button", { name: "Delete selected drawing SOXL 4H trendline" }));

    expect(useAppStore.getState().deleteDrawing).toHaveBeenCalledWith("drawing-1");
    expect(useAppStore.getState().drawings).toEqual([]);
    expect(useAppStore.getState().drawingStatus).toBe("Deleted SOXL 4H trendline");
  });
});
