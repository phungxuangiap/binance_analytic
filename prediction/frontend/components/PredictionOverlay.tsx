'use client';

import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { useEffect, useMemo, useRef } from 'react';
import type { CandleMessage, MarketSymbol, PredictionDirection, PredictionItem, PredictionRectangle } from '../types/market';
import { buildPredictionRectangle } from '../utils/predictionGeometry';

type PredictionOverlayProps = {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  selectedSymbol: MarketSymbol;
  predictions: PredictionItem[];
  candles: CandleMessage[];
  highlightedNewsId?: string | null;
  onHoveredNewsChange?: (newsId: string | null) => void;
};

const COLORS: Record<PredictionDirection, { fill: string; stroke: string }> = {
  UP: { fill: 'rgba(22, 199, 132, 0.16)', stroke: '#16a365' },
  DOWN: { fill: 'rgba(234, 57, 67, 0.15)', stroke: '#c72530' },
  SIDEWAYS: { fill: 'rgba(180, 180, 180, 0.18)', stroke: '#6f6f6f' },
};

function drawArrowHead(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const size = 9;

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function drawLabel(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, maxWidth: number) {
  ctx.font = '12px Courier New, monospace';
  const width = Math.min(ctx.measureText(label).width + 8, Math.max(maxWidth - 8, 80));

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillRect(x, y, width, 18);
  ctx.strokeStyle = '#000000';
  ctx.strokeRect(x, y, width, 18);
  ctx.fillStyle = '#000000';
  ctx.fillText(label, x + 4, y + 13, width - 8);
}

function timeToOverlayCoordinate(chart: IChartApi, candles: CandleMessage[], timestamp: number): number | null {
  const directCoordinate = chart.timeScale().timeToCoordinate(timestamp as UTCTimestamp);
  if (directCoordinate !== null) {
    return Number(directCoordinate);
  }

  const points = Array.from(new Set(candles.map((candle) => Math.floor(candle.openTime / 1000))))
    .sort((a, b) => a - b)
    .map((time) => {
      const coordinate = chart.timeScale().timeToCoordinate(time as UTCTimestamp);
      return coordinate === null ? null : { time, coordinate: Number(coordinate) };
    })
    .filter((point) => point !== null);

  if (points.length < 2) {
    return null;
  }

  let firstPoint = points[0];
  let secondPoint = points[1];

  if (timestamp >= points[points.length - 1].time) {
    firstPoint = points[points.length - 2];
    secondPoint = points[points.length - 1];
  } else if (timestamp <= points[0].time) {
    firstPoint = points[0];
    secondPoint = points[1];
  } else {
    for (let index = 1; index < points.length; index += 1) {
      if (points[index].time >= timestamp) {
        firstPoint = points[index - 1];
        secondPoint = points[index];
        break;
      }
    }
  }

  const secondsDelta = secondPoint.time - firstPoint.time;
  if (secondsDelta === 0) {
    return null;
  }

  const pixelsPerSecond = (secondPoint.coordinate - firstPoint.coordinate) / secondsDelta;
  return firstPoint.coordinate + (timestamp - firstPoint.time) * pixelsPerSecond;
}

export function PredictionOverlay({ chart, series, selectedSymbol, predictions, candles, highlightedNewsId, onHoveredNewsChange }: PredictionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fixedRectanglesRef = useRef<Map<string, PredictionRectangle>>(new Map());
  const hoveredNewsIdRef = useRef<string | null>(null);

  useEffect(() => {
    hoveredNewsIdRef.current = highlightedNewsId || null;
  }, [highlightedNewsId]);

  const rectangles = useMemo(() => {
    const selectedPredictions = predictions
      .filter((prediction) => prediction.symbol === selectedSymbol)
      .slice(-30);

    const activeNewsIds = new Set(predictions.map((prediction) => prediction.news_id));
    for (const newsId of fixedRectanglesRef.current.keys()) {
      if (!activeNewsIds.has(newsId)) {
        fixedRectanglesRef.current.delete(newsId);
      }
    }

    return selectedPredictions
      .map((prediction) => {
        const fixedRectangle = fixedRectanglesRef.current.get(prediction.news_id);
        if (fixedRectangle) {
          const fixedPrediction = fixedRectangle.prediction;
          const isSameGeometry = fixedPrediction.predicted_affect_start_time === prediction.predicted_affect_start_time
            && fixedPrediction.predicted_affect_end_time === prediction.predicted_affect_end_time
            && fixedPrediction.predicted_time_horizon === prediction.predicted_time_horizon
            && fixedPrediction.impact_score === prediction.impact_score;

          if (isSameGeometry) {
            return fixedRectangle;
          }

          fixedRectanglesRef.current.delete(prediction.news_id);
        }

        const rectangle = buildPredictionRectangle(prediction, candles);
        if (!rectangle) {
          return null;
        }

        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime >= rectangle.startTime) {
          fixedRectanglesRef.current.set(prediction.news_id, rectangle);
        }

        return rectangle;
      })
      .filter((rectangle) => rectangle !== null);
  }, [candles, predictions, selectedSymbol]);

  useEffect(() => {
    if (!chart || !series || !canvasRef.current) {
      return;
    }

    const activeChart = chart;
    const activeSeries = series;
    const canvas = canvasRef.current;
    const parentElement = canvas.parentElement;

    if (!parentElement) {
      return;
    }

    const container = parentElement;

    function getDrawableRectangles() {
      return rectangles.flatMap((rectangle) => {
        const x1 = timeToOverlayCoordinate(activeChart, candles, rectangle.startTime);
        const x2 = timeToOverlayCoordinate(activeChart, candles, rectangle.endTime);
        const yTop = activeSeries.priceToCoordinate(rectangle.upperPrice);
        const yBottom = activeSeries.priceToCoordinate(rectangle.lowerPrice);

        if (x1 === null || x2 === null || yTop === null || yBottom === null) {
          return [];
        }

        const x1Number = Number(x1);
        const x2Number = Number(x2);
        const yTopNumber = Number(yTop);
        const yBottomNumber = Number(yBottom);
        const left = Math.min(x1Number, x2Number);
        const width = Math.abs(x2Number - x1Number);
        const top = Math.min(yTopNumber, yBottomNumber);
        const height = Math.max(Math.abs(yBottomNumber - yTopNumber), 8);

        return [{ rectangle, x1Number, x2Number, yTopNumber, yBottomNumber, left, width, top, height }];
      });
    }

    function render() {
      const rect = container.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = rect.width * pixelRatio;
      canvas.height = rect.height * pixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      for (const drawableRectangle of getDrawableRectangles()) {
        const { rectangle, x1Number, x2Number, yTopNumber, yBottomNumber, left, width, top, height } = drawableRectangle;
        const colors = COLORS[rectangle.prediction.predicted_direction];
        const isHighlighted = hoveredNewsIdRef.current === rectangle.prediction.news_id;

        ctx.fillStyle = colors.fill;
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = isHighlighted ? 4 : 2;
        ctx.fillRect(left, top, width, height);
        ctx.strokeRect(left, top, width, height);

        if (isHighlighted) {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(left - 3, top - 3, width + 6, height + 6);
        }

        let arrowStartX = x1Number;
        let arrowStartY = yBottomNumber;
        let arrowEndX = x2Number;
        let arrowEndY = yTopNumber;

        if (rectangle.prediction.predicted_direction === 'DOWN') {
          arrowStartY = yTopNumber;
          arrowEndY = yBottomNumber;
        }

        if (rectangle.prediction.predicted_direction === 'SIDEWAYS') {
          const midY = top + height / 2;
          arrowStartY = midY;
          arrowEndY = midY;
        }

        ctx.strokeStyle = colors.stroke;
        ctx.fillStyle = colors.stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(arrowStartX, arrowStartY);
        ctx.lineTo(arrowEndX, arrowEndY);
        ctx.stroke();
        drawArrowHead(ctx, arrowStartX, arrowStartY, arrowEndX, arrowEndY);

        if (isHighlighted) {
          const sign = rectangle.prediction.predicted_direction === 'DOWN' ? '-' : rectangle.prediction.predicted_direction === 'UP' ? '+' : '±';
          const label = `${rectangle.prediction.predicted_direction} ${rectangle.prediction.predicted_time_horizon} | impact ${rectangle.prediction.impact_score.toFixed(2)} | ${sign}${rectangle.expectedMovePercent.toFixed(2)}%`;
          drawLabel(ctx, label, left + 4, top + 4, width);
        }
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hoveredRectangle = getDrawableRectangles()
        .reverse()
        .find(({ left, width, top, height }) => x >= left && x <= left + width && y >= top && y <= top + height);
      const nextHoveredNewsId = hoveredRectangle?.rectangle.prediction.news_id || null;

      if (hoveredNewsIdRef.current !== nextHoveredNewsId) {
        hoveredNewsIdRef.current = nextHoveredNewsId;
        onHoveredNewsChange?.(nextHoveredNewsId);
        render();
      }
    }

    function handlePointerLeave() {
      if (hoveredNewsIdRef.current !== null) {
        hoveredNewsIdRef.current = null;
        onHoveredNewsChange?.(null);
        render();
      }
    }

    render();

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerleave', handlePointerLeave);

    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(container);
    activeChart.timeScale().subscribeVisibleTimeRangeChange(render);
    activeChart.timeScale().subscribeVisibleLogicalRangeChange(render);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
      activeChart.timeScale().unsubscribeVisibleTimeRangeChange(render);
      activeChart.timeScale().unsubscribeVisibleLogicalRangeChange(render);
    };
  }, [candles, chart, highlightedNewsId, onHoveredNewsChange, rectangles, selectedSymbol, series]);

  return <canvas className="predictionOverlay" ref={canvasRef} />;
}
