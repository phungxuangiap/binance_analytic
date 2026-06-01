CREATE TABLE IF NOT EXISTS binance_prediction.trade_prediction_events_queue
(
  `type` String,
  news_id String,
  symbol String,
  prediction_direction String,
  predicted_time_horizon String,
  impact_score Float32,
  predicted_percent Float64,
  position_side String,
  entry_action String,
  exit_action String,
  entry_time String,
  exit_time String,
  entry_price Float64,
  exit_price Float64,
  pnl Float64,
  pnl_percent Float64,
  result String,
  status String
)
ENGINE = Kafka
SETTINGS
  kafka_broker_list = 'redpanda:9092',
  kafka_topic_list = 'trade_prediction_events',
  kafka_group_name = 'clickhouse_trade_prediction_events',
  kafka_format = 'JSONEachRow',
  kafka_num_consumers = 1,
  kafka_handle_error_mode = 'stream';
