'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandleMessage, ConnectionStatus, MarketMessage, MarketSymbol, NewsItem, PredictionItem, PredictionLifecycleStatus, TickerMessage, TradeItem } from '../types/market';

const RECONNECT_DELAY_MS = 3000;
const CANDLE_LIMIT = 300;
const FEED_LIMIT = 200;
const SYMBOLS: MarketSymbol[] = ['BTCUSDT', 'SOLUSDT'];

function isMarketMessage(value: unknown): value is MarketMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Partial<MarketMessage>;

  if ((message.type === 'candle' || message.type === 'ticker' || message.type === 'news' || message.type === 'prediction' || message.type === 'prediction_deleted' || message.type === 'trade') && SYMBOLS.includes(message.symbol as MarketSymbol)) {
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

function mergeNewsList(currentNews: NewsItem[], newsItem: NewsItem) {
  const existingIndex = currentNews.findIndex((item) => item.id === newsItem.id);

  if (existingIndex >= 0) {
    return [
      ...currentNews.slice(0, existingIndex),
      newsItem,
      ...currentNews.slice(existingIndex + 1),
    ].slice(-FEED_LIMIT);
  }

  return [...currentNews, newsItem].slice(-FEED_LIMIT);
}

function mergeTradeList(currentTrades: TradeItem[], trade: TradeItem) {
  const existingIndex = currentTrades.findIndex((item) => item.news_id === trade.news_id);

  if (existingIndex >= 0) {
    return [
      ...currentTrades.slice(0, existingIndex),
      trade,
      ...currentTrades.slice(existingIndex + 1),
    ].slice(-FEED_LIMIT);
  }

  return [...currentTrades, trade].slice(-FEED_LIMIT);
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
  const [trades, setTrades] = useState<TradeItem[]>([]);
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

    async function loadNews(symbol: MarketSymbol) {
      const response = await fetch(`${apiUrl}/api/news?symbol=${symbol}&limit=${FEED_LIMIT}`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load ${symbol} news: ${response.status}`);
      }

      const loadedNews = await response.json() as NewsItem[];
      setNews((current) => {
        const otherNews = current.filter((newsItem) => newsItem.symbol !== symbol);
        return [...otherNews, ...loadedNews].slice(-FEED_LIMIT);
      });
    }

    async function loadTrades(symbol: MarketSymbol) {
      const response = await fetch(`${apiUrl}/api/trades?symbol=${symbol}&limit=${FEED_LIMIT}`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load ${symbol} trades: ${response.status}`);
      }

      const loadedTrades = await response.json() as TradeItem[];
      setTrades((current) => {
        const otherTrades = current.filter((trade) => trade.symbol !== symbol);
        return [...otherTrades, ...loadedTrades].slice(-FEED_LIMIT);
      });
    }

    Promise.all([
      ...SYMBOLS.map(loadHistoricalCandles),
      ...SYMBOLS.map(loadActivePredictions),
      ...SYMBOLS.map(loadNews),
      ...SYMBOLS.map(loadTrades),
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

      setPredictions((currentPredictions) => currentPredictions.map((prediction) => {
        if (prediction.status === 'deleted') {
          return prediction;
        }

        return {
          ...prediction,
          lifecycleStatus: getPredictionLifecycleStatus(prediction, now),
        };
      }));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

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
            setNews((current) => mergeNewsList(current, parsed));
          }

          if (parsed.type === 'prediction') {
            console.info('[prediction:item]', parsed);
            setPredictions((current) => mergePredictionList(current, parsed));
          }

          if (parsed.type === 'prediction_deleted') {
            console.info('[prediction:deleted]', parsed);
            setPredictions((current) => markPredictionDeleted(current, parsed.news_id, parsed.prediction, parsed.reason));
          }

          if (parsed.type === 'trade') {
            console.info('[trade:item]', parsed);
            setTrades((current) => mergeTradeList(current, parsed));
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
    tradingEvents: trades,
  };
}
