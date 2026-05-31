export type MarketSymbol = 'BTCUSDT' | 'SOLUSDT';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export type CandleMessage = {
  type: 'candle';
  exchange: 'binance';
  symbol: MarketSymbol;
  interval: '1m';
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  tradeCount: number;
  isClosed: boolean;
  eventTime: number;
};

export type TickerMessage = {
  type: 'ticker';
  exchange: 'binance';
  symbol: MarketSymbol;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  eventTime: number;
};

export type NewsItem = {
  type: 'news';
  id: string;
  symbol: MarketSymbol;
  title: string;
  source: string;
  time: string;
};

export type PredictionDirection = 'UP' | 'DOWN' | 'SIDEWAYS';

export type PredictionStatus = 'active' | 'edited' | 'deleted';
export type PredictionLifecycleStatus = 'unmount' | 'mounting' | 'mounted';

export type PredictionEditInfo = {
  field: 'predicted_time_horizon' | 'predicted_affect_end_time' | 'impact_score';
  from: string | number;
  to: string | number;
};

export type PredictionItem = {
  type: 'prediction';
  news_id: string;
  symbol: MarketSymbol;
  predicted_direction: PredictionDirection;
  predicted_time_horizon: string;
  impact_score: number;
  predicted_affect_start_time: string;
  predicted_affect_end_time: string;
  status?: PredictionStatus;
  lifecycleStatus?: PredictionLifecycleStatus;
  edit?: PredictionEditInfo;
  reason?: string;
};

export type PredictionDeletedMessage = {
  type: 'prediction_deleted';
  news_id: string;
  symbol: MarketSymbol;
  reason?: string;
  prediction?: PredictionItem;
};

export type PredictionRectangle = {
  prediction: PredictionItem;
  startTime: number;
  endTime: number;
  currentPrice: number;
  targetPrice: number;
  upperPrice: number;
  lowerPrice: number;
  expectedMovePercent: number;
};

export type TradingAction = 'BUY' | 'SELL';

export type TradingEvent = {
  id: string;
  news_id: string;
  symbol: MarketSymbol;
  action: TradingAction;
  prediction_direction: PredictionDirection;
  transition: 'unmount->mounting' | 'mounting->mounted';
  time: string;
  price?: number;
  entryPrice?: number;
  exitPrice?: number;
  pnl?: number;
  pnlPercent?: number;
};

export type MarketMessage = CandleMessage | TickerMessage | NewsItem | PredictionItem | PredictionDeletedMessage;

export type ChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};
