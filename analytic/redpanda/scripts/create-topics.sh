#!/bin/sh
set -eu

BROKERS="${REDPANDA_BROKERS:-redpanda:9092}"
TOPIC="${TRADE_PREDICTION_TOPIC:-trade_prediction_events}"

if rpk topic list --brokers "$BROKERS" | awk '{print $1}' | grep -Fxq "$TOPIC"; then
  echo "topic already exists: $TOPIC"
else
  rpk topic create "$TOPIC" --brokers "$BROKERS"
fi

rpk topic describe "$TOPIC" --brokers "$BROKERS"
