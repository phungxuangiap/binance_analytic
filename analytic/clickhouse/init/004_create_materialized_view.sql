-- Percent convention: predicted_percent, pnl_percent, and actual_percent are percent values.
-- Example: predicted_percent = 0.0435 means 0.0435%, not a 0.0435 ratio and not 4.35%.
CREATE MATERIALIZED VIEW IF NOT EXISTS binance_prediction.trade_prediction_events_mv
TO binance_prediction.fact_trade_predictions
AS
SELECT
  `type`,
  news_id,
  symbol,
  prediction_direction,
  predicted_time_horizon,
  impact_score,
  predicted_percent,
  position_side,
  entry_action,
  exit_action,
  parsed_entry_time AS entry_time,
  parsed_exit_time AS exit_time,
  entry_price,
  exit_price,
  pnl,
  pnl_percent,
  result,
  status,
  actual_percent,
  if(
    (prediction_direction = 'UP' AND exit_price > entry_price)
      OR (prediction_direction = 'DOWN' AND exit_price < entry_price),
    'CORRECT',
    'WRONG'
  ) AS direction_result,
  if(
    actual_percent = 0,
    0,
    greatest(
      0,
      100 - abs(abs(predicted_percent) - abs(actual_percent)) / nullIf(abs(actual_percent), 0) * 100
    )
  ) AS percent_accuracy,
  now() AS created_at
FROM
(
  SELECT
    `type`,
    news_id,
    symbol,
    prediction_direction,
    predicted_time_horizon,
    impact_score,
    predicted_percent,
    position_side,
    entry_action,
    exit_action,
    parseDateTime64BestEffort(entry_time, 3, 'UTC') AS parsed_entry_time,
    parseDateTime64BestEffort(exit_time, 3, 'UTC') AS parsed_exit_time,
    entry_price,
    exit_price,
    pnl,
    pnl_percent,
    result,
    status,
    if(entry_price = 0, 0, ((exit_price - entry_price) / entry_price) * 100) AS actual_percent
  FROM binance_prediction.trade_prediction_events_queue
  WHERE `type` = 'trade'
    AND status = 'closed'
);
