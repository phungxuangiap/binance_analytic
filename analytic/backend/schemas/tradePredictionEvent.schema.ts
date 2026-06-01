export type TradePredictionEvent = {
  type: 'trade';
  news_id: string;
  symbol: string;
  prediction_direction: 'UP' | 'DOWN';
  predicted_time_horizon: string;
  impact_score: number;
  predicted_percent: number;
  position_side: 'LONG' | 'SHORT';
  entry_action: 'BUY' | 'SELL';
  exit_action: 'BUY' | 'SELL';
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  pnl: number;
  pnl_percent: number;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN';
  status: 'closed';
};

const REQUIRED_STRING_FIELDS = [
  'news_id',
  'symbol',
  'prediction_direction',
  'predicted_time_horizon',
  'position_side',
  'entry_action',
  'exit_action',
  'entry_time',
  'exit_time',
  'result',
] as const;

const REQUIRED_NUMBER_FIELDS = [
  'impact_score',
  'predicted_percent',
  'entry_price',
  'exit_price',
  'pnl',
  'pnl_percent',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isIsoDate(value: string) {
  return Number.isFinite(new Date(value).getTime());
}

export function validateTradePredictionEvent(value: unknown): TradePredictionEvent | null {
  if (!isRecord(value) || value.type !== 'trade' || value.status !== 'closed') {
    return null;
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof value[field] !== 'string' || value[field].length === 0) {
      return null;
    }
  }

  for (const field of REQUIRED_NUMBER_FIELDS) {
    if (typeof value[field] !== 'number' || !Number.isFinite(value[field])) {
      return null;
    }
  }

  if (value.prediction_direction !== 'UP' && value.prediction_direction !== 'DOWN') {
    return null;
  }

  if (value.position_side !== 'LONG' && value.position_side !== 'SHORT') {
    return null;
  }

  if ((value.entry_action !== 'BUY' && value.entry_action !== 'SELL') || (value.exit_action !== 'BUY' && value.exit_action !== 'SELL')) {
    return null;
  }

  if (value.result !== 'WIN' && value.result !== 'LOSS' && value.result !== 'BREAKEVEN') {
    return null;
  }

  if (!isIsoDate(String(value.entry_time)) || !isIsoDate(String(value.exit_time))) {
    return null;
  }

  return value as TradePredictionEvent;
}

export function getTradePredictionEventKey(event: TradePredictionEvent) {
  return `${event.symbol}:${event.news_id}:${event.entry_time}`;
}
