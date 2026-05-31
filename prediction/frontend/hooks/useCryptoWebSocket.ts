'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandleMessage, ConnectionStatus, MarketMessage, MarketSymbol, NewsItem, PredictionItem, PredictionLifecycleStatus, TickerMessage, TradingEvent } from '../types/market';

const RECONNECT_DELAY_MS = 3000;
const CANDLE_LIMIT = 300;
const FEED_LIMIT = 200;
const SYMBOLS: MarketSymbol[] = ['BTCUSDT', 'SOLUSDT'];

function isMarketMessage(value: unknown): value is MarketMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Partial<MarketMessage>;

  if ((message.type === 'candle' || message.type === 'ticker' || message.type === 'news' || message.type === 'prediction' || message.type === 'prediction_deleted') && SYMBOLS.includes(message.symbol as MarketSymbol)) {
    return true;
  }

  return false;
}

function mergeCandleList(currentCandles: CandleMessage[], candle: CandleMessage) {
  const existingIndex = currentCandles.findIndex((item) => item.openTime === candle.openTime);

  if (existingIndex >= 0) {
    return [
      ...currentCandles.slice(0, existingIndex),
      candle,
      ...currentCandles.slice(existingIndex + 1),
    ].slice(-CANDLE_LIMIT);
  }

  return [...currentCandles, candle]
    .sort((a, b) => a.openTime - b.openTime)
    .slice(-CANDLE_LIMIT);
}

function mergePredictionList(currentPredictions: PredictionItem[], prediction: PredictionItem) {
  const existingIndex = currentPredictions.findIndex((item) => item.news_id === prediction.news_id);

  if (existingIndex >= 0) {
    return [
      ...currentPredictions.slice(0, existingIndex),
      prediction,
      ...currentPredictions.slice(existingIndex + 1),
    ].slice(-FEED_LIMIT);
  }

  return [...currentPredictions, prediction].slice(-FEED_LIMIT);
}

function markPredictionDeleted(currentPredictions: PredictionItem[], newsId: string, deletedPrediction?: PredictionItem, reason?: string) {
  const existingPrediction = currentPredictions.find((prediction) => prediction.news_id === newsId);
  const prediction = deletedPrediction || existingPrediction;

  if (!prediction) {
    return currentPredictions;
  }

  return mergePredictionList(currentPredictions, {
    ...prediction,
    status: 'deleted',
    reason: prediction.reason || reason,
  });
}

function getPredictionLifecycleStatus(prediction: PredictionItem, now: number): PredictionLifecycleStatus {
  const startTime = new Date(prediction.predicted_affect_start_time).getTime();
  const endTime = new Date(prediction.predicted_affect_end_time).getTime();

  if (now < startTime) {
    return 'unmount';
  }

  if (now < endTime) {
    return 'mounting';
  }

  return 'mounted';
}

function getTradingAction(prediction: PredictionItem, transition: TradingEvent['transition']) {
  if (transition === 'unmount->mounting') {
    return prediction.predicted_direction === 'UP' ? 'BUY' : 'SELL';
  }

  return prediction.predicted_direction === 'UP' ? 'SELL' : 'BUY';
}

function getCurrentSymbolPrice(symbol: MarketSymbol, tickers: Partial<Record<MarketSymbol, TickerMessage>>, candles: Record<MarketSymbol, CandleMessage[]>) {
  const tickerPrice = tickers[symbol]?.lastPrice;

  if (typeof tickerPrice === 'number' && Number.isFinite(tickerPrice)) {
    return tickerPrice;
  }

  const latestCandle = candles[symbol].at(-1);

  return latestCandle?.close;
}

function getProfitLoss(prediction: PredictionItem, entryPrice: number, exitPrice: number) {
  const pnl = prediction.predicted_direction === 'UP'
    ? exitPrice - entryPrice
    : entryPrice - exitPrice;

  return {
    pnl,
    pnlPercent: entryPrice === 0 ? 0 : (pnl / entryPrice) * 100,
  };
}

export function useCryptoWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [candles, setCandles] = useState<Record<MarketSymbol, CandleMessage[]>>({
    BTCUSDT: [],
    SOLUSDT: [],
  });
  const [tickers, setTickers] = useState<Partial<Record<MarketSymbol, TickerMessage>>>({});
  const [news, setNews] = useState<NewsItem[]>([]);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [tradingEvents, setTradingEvents] = useState<TradingEvent[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manuallyClosedRef = useRef(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    const abortController = new AbortController();

    async function loadHistoricalCandles(symbol: MarketSymbol) {
      const response = await fetch(`${apiUrl}/api/candles?symbol=${symbol}&interval=1m&limit=${CANDLE_LIMIT}`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load ${symbol} candles: ${response.status}`);
      }

      const loadedCandles = await response.json() as CandleMessage[];
      setCandles((current) => ({
        ...current,
        [symbol]: loadedCandles,
      }));
    }

    async function loadActivePredictions(symbol: MarketSymbol) {
      const response = await fetch(`${apiUrl}/api/predictions?symbol=${symbol}&limit=${FEED_LIMIT}`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load ${symbol} predictions: ${response.status}`);
      }

      const loadedPredictions = await response.json() as PredictionItem[];
      setPredictions((current) => {
        const otherPredictions = current.filter((prediction) => prediction.symbol !== symbol);
        return [...otherPredictions, ...loadedPredictions].slice(-FEED_LIMIT);
      });
    }

    Promise.all([
      ...SYMBOLS.map(loadHistoricalCandles),
      ...SYMBOLS.map(loadActivePredictions),
    ]).catch((error) => {
      if (error.name !== 'AbortError') {
        console.error('Failed to load historical market data', error);
      }
    });

    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();

      setPredictions((currentPredictions) => {
        const nextTradingEvents: TradingEvent[] = [];
        const nextPredictions = currentPredictions.map((prediction) => {
          if (prediction.status === 'deleted') {
            return prediction;
          }

          const lifecycleStatus = getPredictionLifecycleStatus(prediction, now);
          const previousLifecycleStatus = prediction.lifecycleStatus;

          if (previousLifecycleStatus === 'unmount' && lifecycleStatus === 'mounting') {
            const price = getCurrentSymbolPrice(prediction.symbol, tickers, candles);

            nextTradingEvents.push({
              id: `${prediction.news_id}:unmount->mounting`,
              news_id: prediction.news_id,
              symbol: prediction.symbol,
              action: getTradingAction(prediction, 'unmount->mounting'),
              prediction_direction: prediction.predicted_direction,
              transition: 'unmount->mounting',
              time: new Date(now).toISOString(),
              price,
            });
          }

          if (previousLifecycleStatus === 'mounting' && lifecycleStatus === 'mounted') {
            const price = getCurrentSymbolPrice(prediction.symbol, tickers, candles);
            const entryEvent = tradingEvents.find((event) => event.news_id === prediction.news_id && event.transition === 'unmount->mounting');
            const entryPrice = entryEvent?.price;
            const profitLoss = typeof entryPrice === 'number' && typeof price === 'number' ? getProfitLoss(prediction, entryPrice, price) : undefined;

            nextTradingEvents.push({
              id: `${prediction.news_id}:mounting->mounted`,
              news_id: prediction.news_id,
              symbol: prediction.symbol,
              action: getTradingAction(prediction, 'mounting->mounted'),
              prediction_direction: prediction.predicted_direction,
              transition: 'mounting->mounted',
              time: new Date(now).toISOString(),
              price,
              entryPrice,
              exitPrice: price,
              pnl: profitLoss?.pnl,
              pnlPercent: profitLoss?.pnlPercent,
            });
          }

          return {
            ...prediction,
            lifecycleStatus,
          };
        });

        if (nextTradingEvents.length > 0) {
          setTradingEvents((currentEvents) => {
            const existingIds = new Set(currentEvents.map((event) => event.id));
            const newEvents = nextTradingEvents.filter((event) => !existingIds.has(event.id));
            return [...currentEvents, ...newEvents].slice(-FEED_LIMIT);
          });
        }

        return nextPredictions;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [candles, tickers, tradingEvents]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001';

    function connect() {
      setStatus((current) => (current === 'disconnected' ? 'reconnecting' : current));
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus('connected');
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);

          if (!isMarketMessage(parsed)) {
            return;
          }

          if (parsed.type === 'candle') {
            setCandles((current) => ({
              ...current,
              [parsed.symbol]: mergeCandleList(current[parsed.symbol], parsed),
            }));
          }

          if (parsed.type === 'ticker') {
            setTickers((current) => ({
              ...current,
              [parsed.symbol]: parsed,
            }));
          }

          if (parsed.type === 'news') {
            console.info('[news:item]', parsed);
            setNews((current) => [...current, parsed].slice(-FEED_LIMIT));
          }

          if (parsed.type === 'prediction') {
            console.info('[prediction:item]', parsed);
            setPredictions((current) => mergePredictionList(current, parsed));
          }

          if (parsed.type === 'prediction_deleted') {
            console.info('[prediction:deleted]', parsed);
            setPredictions((current) => markPredictionDeleted(current, parsed.news_id, parsed.prediction, parsed.reason));
          }
        } catch (error) {
          console.error('Failed to parse backend WebSocket message', error);
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
        if (manuallyClosedRef.current) {
          setStatus('disconnected');
          return;
        }

        setStatus('reconnecting');
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    manuallyClosedRef.current = false;
    connect();

    return () => {
      manuallyClosedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      socketRef.current?.close();
    };
  }, []);

  return {
    status,
    candles,
    tickers,
    news,
    predictions,
    tradingEvents,
  };
}
