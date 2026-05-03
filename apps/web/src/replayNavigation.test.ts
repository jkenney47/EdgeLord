import { describe, expect, it } from "vitest";

import type { Bar, Label } from "./api";
import {
  findFirstIndexAfterTimestamp,
  findNextUnlabeledIndex,
  findNextUnlabeledIndexAfterTimestamp,
  findReplayResumeIndex
} from "./replayNavigation";

function bar(timestamp: string): Bar {
  return {
    ticker: "SOXL",
    timeframe: "4H",
    timestamp,
    open: 10,
    high: 11,
    low: 9,
    close: 10,
    volume: 100
  };
}

function label(timestamp: string, overrides: Partial<Label> = {}): Label {
  return {
    id: `label-${timestamp}`,
    label_source: "retrospective_replay",
    training_eligible: 1,
    action: "SKIP",
    ticker: "SOXL",
    timeframe: "4H",
    timestamp,
    bar_index: 0,
    chart_price: 10,
    execution_price: null,
    trade_id: null,
    parent_entry_label_id: null,
    capture_mode: "replay",
    visible_until_timestamp: timestamp,
    potential_visual_leakage: 0,
    created_at: timestamp,
    ...overrides
  };
}

describe("findReplayResumeIndex", () => {
  const bars = [
    bar("2024-01-02T14:30:00.000Z"),
    bar("2024-01-03T14:30:00.000Z"),
    bar("2024-01-04T14:30:00.000Z")
  ];

  it("starts at the first candle when no matching labels exist", () => {
    expect(findReplayResumeIndex(bars, [], "SOXL", "4H", "retrospective_replay")).toBe(0);
    expect(findReplayResumeIndex(bars, [label(bars[1].timestamp, { ticker: "SOXS" })], "SOXL", "4H", "retrospective_replay")).toBe(0);
  });

  it("resumes after the latest matching labeled candle", () => {
    expect(findReplayResumeIndex(bars, [label(bars[0].timestamp)], "SOXL", "4H", "retrospective_replay")).toBe(1);
    expect(findReplayResumeIndex(bars, [label(bars[0].timestamp), label(bars[1].timestamp)], "SOXL", "4H", "retrospective_replay")).toBe(2);
  });

  it("stays on the final candle when the latest label is final", () => {
    expect(findReplayResumeIndex(bars, [label(bars[2].timestamp)], "SOXL", "4H", "retrospective_replay")).toBe(2);
  });

  it("does not let other label sources advance replay resume", () => {
    expect(findReplayResumeIndex(bars, [
      label(bars[1].timestamp, { label_source: "retrospective_hindsight", training_eligible: 1 })
    ], "SOXL", "4H", "retrospective_replay")).toBe(0);
  });
});

describe("findNextUnlabeledIndex", () => {
  const bars = [
    bar("2024-01-02T14:30:00.000Z"),
    bar("2024-01-03T14:30:00.000Z"),
    bar("2024-01-04T14:30:00.000Z"),
    bar("2024-01-05T14:30:00.000Z")
  ];

  it("finds the next unlabeled candle after the current index", () => {
    expect(findNextUnlabeledIndex(bars, [label(bars[1].timestamp)], "SOXL", "4H", 0, "retrospective_replay")).toBe(2);
  });

  it("ignores labels from other ticker/timeframe combinations", () => {
    expect(findNextUnlabeledIndex(bars, [
      label(bars[1].timestamp, { ticker: "SOXS" }),
      label(bars[2].timestamp, { timeframe: "2H" })
    ], "SOXL", "4H", 0, "retrospective_replay")).toBe(1);
  });

  it("ignores labels from other sources", () => {
    expect(findNextUnlabeledIndex(bars, [
      label(bars[1].timestamp, { label_source: "actual_trade" })
    ], "SOXL", "4H", 0, "retrospective_replay")).toBe(1);
  });

  it("returns null when no later unlabeled candle exists", () => {
    expect(findNextUnlabeledIndex(bars, [
      label(bars[1].timestamp),
      label(bars[2].timestamp),
      label(bars[3].timestamp)
    ], "SOXL", "4H", 0, "retrospective_replay")).toBeNull();
  });

  it("can advance after a newly captured label and skip already labeled future candles", () => {
    expect(findNextUnlabeledIndex(bars, [
      label(bars[0].timestamp),
      label(bars[1].timestamp),
      label(bars[2].timestamp)
    ], "SOXL", "4H", 0, "retrospective_replay")).toBe(3);
  });
});

describe("findFirstIndexAfterTimestamp", () => {
  const bars = [
    bar("2024-01-02T14:30:00.000Z"),
    bar("2024-01-03T14:30:00.000Z"),
    bar("2024-01-04T14:30:00.000Z")
  ];

  it("finds the first candle after a timestamp", () => {
    expect(findFirstIndexAfterTimestamp(bars, bars[0].timestamp)).toBe(1);
    expect(findFirstIndexAfterTimestamp(bars, "2024-01-02T15:00:00.000Z")).toBe(1);
  });

  it("returns null when there is no later candle", () => {
    expect(findFirstIndexAfterTimestamp(bars, bars[2].timestamp)).toBeNull();
  });
});

describe("findNextUnlabeledIndexAfterTimestamp", () => {
  const bars = [
    bar("2024-01-02T14:30:00.000Z"),
    bar("2024-01-03T14:30:00.000Z"),
    bar("2024-01-04T14:30:00.000Z"),
    bar("2024-01-05T14:30:00.000Z")
  ];

  it("skips labeled candles after the entry timestamp", () => {
    expect(findNextUnlabeledIndexAfterTimestamp(
      bars,
      [label(bars[1].timestamp)],
      "SOXL",
      "4H",
      bars[0].timestamp,
      "retrospective_replay"
    )).toBe(2);
  });

  it("ignores labels from other ticker/timeframe combinations", () => {
    expect(findNextUnlabeledIndexAfterTimestamp(
      bars,
      [
        label(bars[1].timestamp, { ticker: "SOXS" }),
        label(bars[2].timestamp, { timeframe: "2H" })
      ],
      "SOXL",
      "4H",
      bars[0].timestamp,
      "retrospective_replay"
    )).toBe(1);
  });

  it("ignores later labels from other sources", () => {
    expect(findNextUnlabeledIndexAfterTimestamp(
      bars,
      [label(bars[1].timestamp, { label_source: "retrospective_hindsight", training_eligible: 1 })],
      "SOXL",
      "4H",
      bars[0].timestamp,
      "retrospective_replay"
    )).toBe(1);
  });

  it("returns null when all later candles are labeled", () => {
    expect(findNextUnlabeledIndexAfterTimestamp(
      bars,
      [label(bars[1].timestamp), label(bars[2].timestamp), label(bars[3].timestamp)],
      "SOXL",
      "4H",
      bars[0].timestamp,
      "retrospective_replay"
    )).toBeNull();
  });
});
