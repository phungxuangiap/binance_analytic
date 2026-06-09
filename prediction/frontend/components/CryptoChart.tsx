'use client';

import { CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CandleMessage, MarketSymbol, PredictionItem } from '../types/market';
import { PredictionOverlay } from './PredictionOverlay';

type CryptoChartProps = {
  candles: CandleMessage[];
  predictions: PredictionItem[];
  selectedSymbol: MarketSymbol;
  highlightedNewsId?: string | null;
  onHoveredNewsChange?: (newsId: string | null) => void;
};

export function CryptoChart({ candles, predictions, selectedSymbol, highlightedNewsId, onHoveredNewsChange }: CryptoChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [series, setSeries] = useState<ISeriesApi<'Candlestick'> | null>(null);

  const chartData = useMemo(() => {
    const candleDataByTime = new Map<number, {
      time: UTCTimestamp;
      open: number;
      high: number;
      low: number;
      close: number;
    }>();

    for (const candle of candles) {
      const time = Math.floor(candle.openTime / 1000);
      candleDataByTime.set(time, {
        time: time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
    }

    return Array.from(candleDataByTime.values()).sort((a, b) => Number(a.time) - Number(b.time));
  }, [candles]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chartInstance = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#11141a' },
        fontFamily: 'Inter, Geist, system-ui, sans-serif',
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.06)', style: 2 },
        horzLines: { color: 'rgba(255, 255, 255, 0.06)', style: 2 },
      },
      rightPriceScale: {
        borderColor: '#2a2f3a',
      },
      timeScale: {
        borderColor: '#2a2f3a',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const seriesInstance = chartInstance.addSeries(CandlestickSeries, {
      upColor: 'rgba(34, 197, 94, 0.24)',
      downColor: 'rgba(239, 68, 68, 0.24)',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    setChart(chartInstance);
    setSeries(seriesInstance);

    return () => {
      chartInstance.remove();
      setChart(null);
      setSeries(null);
    };
  }, []);

  useEffect(() => {
    if (!series) {
      return;
    }

    series.setData(chartData);
  }, [chartData, series]);

  useEffect(() => {
    if (chartData.length > 0) {
      chart?.timeScale().fitContent();
    }
  }, [chart, selectedSymbol]);

  return (
    <div className="chartShell">
      <div className="chartContainer" ref={containerRef} />
      <PredictionOverlay
        candles={candles}
        chart={chart}
        predictions={predictions.filter((prediction) => prediction.status !== 'deleted')}
        selectedSymbol={selectedSymbol}
        series={series}
        highlightedNewsId={highlightedNewsId}
        onHoveredNewsChange={onHoveredNewsChange}
      />
    </div>
  );
}
