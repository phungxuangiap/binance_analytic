CREATE TABLE IF NOT EXISTS binance_prediction.fact_trade_predictions
(
  `type` String,
  news_id String,
  symbol LowCardinality(String),
  prediction_direction LowCardinality(String),
  predicted_time_horizon LowCardinality(String),
  impact_score Float32,
  predicted_percent Float64,
  position_side LowCardinality(String),
  entry_action LowCardinality(String),
  exit_action LowCardinality(String),
  entry_time DateTime64(3, 'UTC'),
  exit_time DateTime64(3, 'UTC'),
  entry_price Float64,
  exit_price Float64,
  pnl Float64,
  pnl_percent Float64,
  result LowCardinality(String),
  status LowCardinality(String),
  actual_percent Float64,
  direction_result LowCardinality(String),
  percent_accuracy Float64,
  created_at DateTime DEFAULT now()
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(entry_time)
ORDER BY (symbol, entry_time, news_id);
