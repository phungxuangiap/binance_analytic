#!/bin/sh
set -eu

BROKERS="${REDPANDA_BROKERS:-redpanda:9092}"
TOPIC="${TRADE_PREDICTION_TOPIC:-trade_prediction_events}"
KEY="BTCUSDT:news_sample_analytics:2026-06-01T10:00:00.000Z"

printf '%s\n' '{"type":"trade","news_id":"news_sample_analytics","symbol":"BTCUSDT","prediction_direction":"UP","predicted_time_horizon":"5m","impact_score":72.5,"predicted_percent":0.0435,"position_side":"LONG","entry_action":"BUY","exit_action":"SELL","entry_time":"2026-06-01T10:00:00.000Z","exit_time":"2026-06-01T10:05:00.000Z","entry_price":68000.25,"exit_price":68120.5,"pnl":120.25,"pnl_percent":0.176837,"result":"WIN","status":"closed"}' \
  | rpk topic produce "$TOPIC" --brokers "$BROKERS" --key "$KEY"
