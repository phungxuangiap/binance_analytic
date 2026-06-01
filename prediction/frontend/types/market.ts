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
export type PositionSide = 'LONG' | 'SHORT';
export type TradeStatus = 'open' | 'closed';
export type TradeResult = 'WIN' | 'LOSS' | 'BREAKEVEN';

export type TradeItem = {
  type: 'trade';
  news_id: string;
  symbol: MarketSymbol;
  prediction_direction: PredictionDirection;
  predicted_time_horizon: string;
  impact_score: number;
  predicted_percent: number;
  position_side: PositionSide;
  entry_action: TradingAction;
  exit_action?: TradingAction;
  entry_time: string;
  exit_time?: string;
  entry_price?: number;
  exit_price?: number;
  pnl?: number;
  pnl_percent?: number;
  result?: TradeResult;
  status: TradeStatus;
};

export type MarketMessage = CandleMessage | TickerMessage | NewsItem | PredictionItem | PredictionDeletedMessage | TradeItem;

export type ChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};
