export const createTableStatements = [
  `create table if not exists sessions (
    id text primary key,
    name text not null,
    start_time text not null,
    end_time text,
    ticker_focus text,
    timeframe_focus text,
    notes text,
    created_at text not null,
    updated_at text not null
  )`,
  `create table if not exists base_bars (
    id integer primary key autoincrement,
    provider text not null,
    ticker text not null,
    timeframe text not null,
    timestamp text not null,
    open real not null,
    high real not null,
    low real not null,
    close real not null,
    volume real not null,
    created_at text not null
  )`,
  `create table if not exists aggregated_bars (
    id integer primary key autoincrement,
    ticker text not null,
    timeframe text not null,
    timestamp text not null,
    open real not null,
    high real not null,
    low real not null,
    close real not null,
    volume real not null,
    source_bar_count integer not null,
    created_at text not null
  )`,
  `create table if not exists indicator_values (
    id integer primary key autoincrement,
    ticker text not null,
    timeframe text not null,
    timestamp text not null,
    name text not null,
    values_json text not null,
    created_at text not null
  )`,
  `create table if not exists drawings (
    id text primary key,
    session_id text,
    ticker text not null,
    timeframe text not null,
    type text not null,
    anchors_json text not null,
    style_json text,
    slope real,
    created_at text not null,
    updated_at text not null,
    deleted_at text,
    foreign key (session_id) references sessions(id)
  )`,
  `create table if not exists trade_events (
    id text primary key,
    session_id text not null,
    timestamp text not null,
    ticker text not null,
    timeframe text not null,
    label_type text not null,
    price real not null,
    confidence integer not null,
    setup_quality integer not null,
    reason_codes_json text not null,
    notes text,
    decision_phase text,
    capture_mode text,
    visible_until_timestamp text,
    potential_visual_leakage integer,
    selected_bar_index integer,
    setup_id text,
    trade_id text,
    parent_label_id text,
    decision_role text,
    bias text,
    market_bias text,
    trade_direction text,
    instrument_role text,
    paired_ticker_role text,
    entry_style text,
    exit_style text,
    invalidation_price real,
    target_price real,
    outcome_available integer,
    outcome_horizon_bars integer,
    outcome_future_return_1 real,
    outcome_future_return_3 real,
    outcome_future_return_5 real,
    outcome_future_return_10 real,
    outcome_future_max_favorable_excursion real,
    outcome_future_max_adverse_excursion real,
    outcome_future_hit_target integer,
    outcome_future_hit_stop integer,
    outcome_future_bars_to_target integer,
    outcome_future_bars_to_stop integer,
    outcome_status text,
    outcome_rule_version text,
    multi_timeframe_context_json text,
    indicator_snapshot_json text not null,
    structure_snapshot_json text not null,
    drawing_context_json text not null,
    created_at text not null,
    updated_at text not null,
    deleted_at text,
    foreign key (session_id) references sessions(id)
  )`,
  `create table if not exists audit_log (
    id integer primary key autoincrement,
    entity_type text not null,
    entity_id text not null,
    action text not null,
    before_json text,
    after_json text,
    created_at text not null
  )`,
  `create table if not exists import_runs (
    id text primary key,
    provider text not null,
    tickers_json text not null,
    start_date text not null,
    end_date text not null,
    base_timeframe text not null,
    status text not null,
    result_json text,
    error text,
    created_at text not null,
    updated_at text not null
  )`
];

export const additiveMigrationStatements = [
  {
    table: "trade_events",
    column: "decision_phase",
    statement: "alter table trade_events add column decision_phase text"
  },
  {
    table: "trade_events",
    column: "capture_mode",
    statement: "alter table trade_events add column capture_mode text"
  },
  {
    table: "trade_events",
    column: "visible_until_timestamp",
    statement: "alter table trade_events add column visible_until_timestamp text"
  },
  {
    table: "trade_events",
    column: "potential_visual_leakage",
    statement: "alter table trade_events add column potential_visual_leakage integer"
  },
  {
    table: "trade_events",
    column: "selected_bar_index",
    statement: "alter table trade_events add column selected_bar_index integer"
  },
  {
    table: "trade_events",
    column: "setup_id",
    statement: "alter table trade_events add column setup_id text"
  },
  {
    table: "trade_events",
    column: "trade_id",
    statement: "alter table trade_events add column trade_id text"
  },
  {
    table: "trade_events",
    column: "parent_label_id",
    statement: "alter table trade_events add column parent_label_id text"
  },
  {
    table: "trade_events",
    column: "decision_role",
    statement: "alter table trade_events add column decision_role text"
  },
  {
    table: "trade_events",
    column: "bias",
    statement: "alter table trade_events add column bias text"
  },
  {
    table: "trade_events",
    column: "market_bias",
    statement: "alter table trade_events add column market_bias text"
  },
  {
    table: "trade_events",
    column: "trade_direction",
    statement: "alter table trade_events add column trade_direction text"
  },
  {
    table: "trade_events",
    column: "instrument_role",
    statement: "alter table trade_events add column instrument_role text"
  },
  {
    table: "trade_events",
    column: "paired_ticker_role",
    statement: "alter table trade_events add column paired_ticker_role text"
  },
  {
    table: "trade_events",
    column: "entry_style",
    statement: "alter table trade_events add column entry_style text"
  },
  {
    table: "trade_events",
    column: "exit_style",
    statement: "alter table trade_events add column exit_style text"
  },
  {
    table: "trade_events",
    column: "invalidation_price",
    statement: "alter table trade_events add column invalidation_price real"
  },
  {
    table: "trade_events",
    column: "target_price",
    statement: "alter table trade_events add column target_price real"
  },
  {
    table: "trade_events",
    column: "outcome_available",
    statement: "alter table trade_events add column outcome_available integer"
  },
  {
    table: "trade_events",
    column: "outcome_horizon_bars",
    statement: "alter table trade_events add column outcome_horizon_bars integer"
  },
  {
    table: "trade_events",
    column: "outcome_future_return_1",
    statement: "alter table trade_events add column outcome_future_return_1 real"
  },
  {
    table: "trade_events",
    column: "outcome_future_return_3",
    statement: "alter table trade_events add column outcome_future_return_3 real"
  },
  {
    table: "trade_events",
    column: "outcome_future_return_5",
    statement: "alter table trade_events add column outcome_future_return_5 real"
  },
  {
    table: "trade_events",
    column: "outcome_future_return_10",
    statement: "alter table trade_events add column outcome_future_return_10 real"
  },
  {
    table: "trade_events",
    column: "outcome_future_max_favorable_excursion",
    statement: "alter table trade_events add column outcome_future_max_favorable_excursion real"
  },
  {
    table: "trade_events",
    column: "outcome_future_max_adverse_excursion",
    statement: "alter table trade_events add column outcome_future_max_adverse_excursion real"
  },
  {
    table: "trade_events",
    column: "outcome_future_hit_target",
    statement: "alter table trade_events add column outcome_future_hit_target integer"
  },
  {
    table: "trade_events",
    column: "outcome_future_hit_stop",
    statement: "alter table trade_events add column outcome_future_hit_stop integer"
  },
  {
    table: "trade_events",
    column: "outcome_future_bars_to_target",
    statement: "alter table trade_events add column outcome_future_bars_to_target integer"
  },
  {
    table: "trade_events",
    column: "outcome_future_bars_to_stop",
    statement: "alter table trade_events add column outcome_future_bars_to_stop integer"
  },
  {
    table: "trade_events",
    column: "outcome_status",
    statement: "alter table trade_events add column outcome_status text"
  },
  {
    table: "trade_events",
    column: "outcome_rule_version",
    statement: "alter table trade_events add column outcome_rule_version text"
  },
  {
    table: "trade_events",
    column: "multi_timeframe_context_json",
    statement: "alter table trade_events add column multi_timeframe_context_json text"
  }
];

export const createIndexStatements = [
  `create unique index if not exists base_bars_provider_ticker_timeframe_timestamp_idx
    on base_bars(provider, ticker, timeframe, timestamp)`,
  `create unique index if not exists aggregated_bars_ticker_timeframe_timestamp_idx
    on aggregated_bars(ticker, timeframe, timestamp)`,
  `create unique index if not exists indicator_values_ticker_timeframe_timestamp_name_idx
    on indicator_values(ticker, timeframe, timestamp, name)`,
  `create index if not exists trade_events_session_timestamp_idx
    on trade_events(session_id, timestamp)`,
  `create index if not exists drawings_session_ticker_timeframe_idx
    on drawings(session_id, ticker, timeframe)`,
  `create index if not exists audit_log_entity_idx
    on audit_log(entity_type, entity_id, created_at)`
];
