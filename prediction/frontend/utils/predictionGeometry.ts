import type { CandleMessage, PredictionItem, PredictionRectangle } from '../types/market';

export function parseTimeHorizonToSeconds(horizon: string): number {
  const match = horizon.match(/^(\d+)(m|h)$/);

  if (!match) {
    return 15 * 60;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(value) || value <= 0) {
    return 15 * 60;
  }

  return unit === 'h' ? value * 3600 : value * 60;
}

export function impactScoreToPriceMovePercent(impactScore: number): number {
  const safeImpact = Number.isFinite(impactScore) ? impactScore : 0;
  return Math.max(safeImpact, 0) / 100;
}

export function findNearestCandlePrice(candles: CandleMessage[], timestamp: number): number | null {
  if (candles.length === 0) {
    return null;
  }

  const sortedCandles = [...candles].sort((a, b) => a.openTime - b.openTime);
  const timestampMs = timestamp * 1000;
  const nextCandle = sortedCandles.find((candle) => Math.floor(candle.openTime / 1000) >= timestamp);

  if (nextCandle) {
    return nextCandle.close;
  }

  let nearestCandle = sortedCandles[0];
  let nearestDistance = Math.abs(nearestCandle.openTime - timestampMs);

  for (const candle of sortedCandles) {
    const distance = Math.abs(candle.openTime - timestampMs);
    if (distance < nearestDistance) {
      nearestCandle = candle;
      nearestDistance = distance;
    }
  }

  return nearestCandle.close;
}

export function buildPredictionRectangle(prediction: PredictionItem, candles: CandleMessage[]): PredictionRectangle | null {
  const startTime = Math.floor(new Date(prediction.predicted_affect_start_time).getTime() / 1000);
  const endTime = Math.floor(new Date(prediction.predicted_affect_end_time).getTime() / 1000);

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return null;
  }
  const currentPrice = findNearestCandlePrice(candles, startTime);

  if (!currentPrice) {
    return null;
  }

  const expectedMovePercent = impactScoreToPriceMovePercent(prediction.impact_score);

  if (prediction.predicted_direction === 'UP') {
    const targetPrice = currentPrice * (1 + expectedMovePercent / 100);
    return {
      prediction,
      startTime,
      endTime,
      currentPrice,
      targetPrice,
      upperPrice: targetPrice,
      lowerPrice: currentPrice,
      expectedMovePercent,
    };
  }

  if (prediction.predicted_direction === 'DOWN') {
    const targetPrice = currentPrice * (1 - expectedMovePercent / 100);
    return {
      prediction,
      startTime,
      endTime,
      currentPrice,
      targetPrice,
      upperPrice: currentPrice,
      lowerPrice: targetPrice,
      expectedMovePercent,
    };
  }

  const upperPrice = currentPrice * (1 + expectedMovePercent / 200);
  const lowerPrice = currentPrice * (1 - expectedMovePercent / 200);

  return {
    prediction,
    startTime,
    endTime,
    currentPrice,
    targetPrice: currentPrice,
    upperPrice,
    lowerPrice,
    expectedMovePercent,
  };
}
