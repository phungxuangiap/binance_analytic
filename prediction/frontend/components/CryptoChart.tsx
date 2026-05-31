'use client';

import { CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CandleMessage, MarketSymbol, PredictionItem } from '../types/market';
import { PredictionOverlay } from './PredictionOverlay';

type CryptoChartProps = {
  candles: CandleMessage[];
  predictions: PredictionItem[];
  selectedSymbol: MarketSymbol;
};

export function CryptoChart({ candles, predictions, selectedSymbol }: CryptoChartProps) {
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
        background: { type: ColorType.Solid, color: '#ffffff' },
        fontFamily: 'Courier New, monospace',
        textColor: '#000000',
      },
      grid: {
        vertLines: { color: '#d0d0d0', style: 2 },
        horzLines: { color: '#d0d0d0', style: 2 },
      },
      rightPriceScale: {
        borderColor: '#000000',
      },
      timeScale: {
        borderColor: '#000000',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const seriesInstance = chartInstance.addSeries(CandlestickSeries, {
      upColor: '#ffffff',
      downColor: '#000000',
      borderUpColor: '#000000',
      borderDownColor: '#000000',
      wickUpColor: '#000000',
      wickDownColor: '#000000',
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
      />
    </div>
  );
}
