import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { runMigrations } from "../src/db/migrate.js";

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function tableNames(database: Database.Database): string[] {
  return database
    .prepare(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name"
    )
    .all()
    .map((row) => (row as { name: string }).name);
}

function indexNames(database: Database.Database): string[] {
  return database
    .prepare("select name from sqlite_master where type = 'index' order by name")
    .all()
    .map((row) => (row as { name: string }).name);
}

function tableColumns(database: Database.Database, table: string): string[] {
  return database
    .prepare(`pragma table_info(${table})`)
    .all()
    .map((row) => (row as { name: string }).name);
}

describe("database migrations", () => {
  it("creates the EdgeLord tables and unique indexes", () => {
    db = new Database(":memory:");

    runMigrations(db);

    expect(tableNames(db)).toEqual([
      "aggregated_bars",
      "audit_log",
      "base_bars",
      "drawings",
      "import_runs",
      "indicator_values",
      "sessions",
      "trade_events"
    ]);

    expect(indexNames(db)).toEqual(
      expect.arrayContaining([
        "base_bars_provider_ticker_timeframe_timestamp_idx",
        "aggregated_bars_ticker_timeframe_timestamp_idx",
        "indicator_values_ticker_timeframe_timestamp_name_idx"
      ])
    );
    expect(tableColumns(db, "trade_events")).toEqual(
      expect.arrayContaining([
        "decision_phase",
        "capture_mode",
        "visible_until_timestamp",
        "potential_visual_leakage",
        "selected_bar_index",
        "setup_id",
        "trade_id",
        "parent_label_id",
        "decision_role",
        "bias",
        "market_bias",
        "trade_direction",
        "instrument_role",
        "paired_ticker_role",
        "entry_style",
        "exit_style",
        "invalidation_price",
        "target_price",
        "outcome_available",
        "outcome_horizon_bars",
        "outcome_future_return_1",
        "outcome_future_return_3",
        "outcome_future_return_5",
        "outcome_future_return_10",
        "outcome_future_max_favorable_excursion",
        "outcome_future_max_adverse_excursion",
        "outcome_future_hit_target",
        "outcome_future_hit_stop",
        "outcome_future_bars_to_target",
        "outcome_future_bars_to_stop",
        "multi_timeframe_context_json"
      ])
    );
  });
});
