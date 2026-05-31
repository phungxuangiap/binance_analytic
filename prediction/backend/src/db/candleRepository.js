const { pool } = require('./pool');

function mapRowToCandle(row) {
  return {
    type: 'candle',
    exchange: row.exchange,
    symbol: row.symbol,
    interval: row.interval,
    openTime: Number(row.open_time),
    closeTime: Number(row.close_time),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
    quoteVolume: Number(row.quote_volume),
    tradeCount: row.trade_count,
    isClosed: row.is_closed,
    eventTime: Number(row.event_time),
  };
}

async function upsertCandle(candle) {
  await pool.query(
    `
      INSERT INTO candles (
        exchange,
        symbol,
        interval,
        open_time,
        close_time,
        open,
        high,
        low,
        close,
        volume,
        quote_volume,
        trade_count,
        is_closed,
        event_time,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (exchange, symbol, interval, open_time)
      DO UPDATE SET
        close_time = EXCLUDED.close_time,
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume,
        quote_volume = EXCLUDED.quote_volume,
        trade_count = EXCLUDED.trade_count,
        is_closed = EXCLUDED.is_closed,
        event_time = EXCLUDED.event_time,
        updated_at = NOW()
    `,
    [
      candle.exchange,
      candle.symbol,
      candle.interval,
      candle.openTime,
      candle.closeTime,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      candle.quoteVolume,
      candle.tradeCount,
      candle.isClosed,
      candle.eventTime,
    ],
  );
}

async function getCandles({ symbol, interval, limit }) {
  const result = await pool.query(
    `
      SELECT *
      FROM (
        SELECT *
        FROM candles
        WHERE exchange = 'binance'
          AND symbol = $1
          AND interval = $2
        ORDER BY open_time DESC
        LIMIT $3
      ) recent
      ORDER BY open_time ASC
    `,
    [symbol, interval, limit],
  );

  return result.rows.map(mapRowToCandle);
}

module.exports = {
  getCandles,
  upsertCandle,
};
