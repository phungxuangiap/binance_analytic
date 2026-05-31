const { pool } = require('./pool');

const INIT_RETRY_COUNT = Number(process.env.DATABASE_INIT_RETRY_COUNT || 20);
const INIT_RETRY_DELAY_MS = Number(process.env.DATABASE_INIT_RETRY_DELAY_MS || 1000);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS candles (
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      open_time BIGINT NOT NULL,
      close_time BIGINT NOT NULL,
      open NUMERIC NOT NULL,
      high NUMERIC NOT NULL,
      low NUMERIC NOT NULL,
      close NUMERIC NOT NULL,
      volume NUMERIC NOT NULL,
      quote_volume NUMERIC NOT NULL,
      trade_count INTEGER NOT NULL,
      is_closed BOOLEAN NOT NULL,
      event_time BIGINT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (exchange, symbol, interval, open_time)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS candles_symbol_interval_open_time_idx
    ON candles (symbol, interval, open_time DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS predictions (
      news_id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      predicted_direction TEXT NOT NULL,
      predicted_time_horizon TEXT NOT NULL,
      impact_score NUMERIC NOT NULL,
      predicted_affect_start_time TIMESTAMPTZ NOT NULL,
      predicted_affect_end_time TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS predictions_symbol_status_time_idx
    ON predictions (symbol, status, predicted_affect_start_time, predicted_affect_end_time)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS news (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      time TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS news_symbol_time_idx
    ON news (symbol, time DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS trades (
      news_id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      prediction_direction TEXT NOT NULL,
      position_side TEXT NOT NULL,
      entry_action TEXT NOT NULL,
      exit_action TEXT,
      entry_time TIMESTAMPTZ NOT NULL,
      exit_time TIMESTAMPTZ,
      entry_price NUMERIC,
      exit_price NUMERIC,
      pnl NUMERIC,
      pnl_percent NUMERIC,
      result TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS trades_symbol_entry_time_idx
    ON trades (symbol, entry_time DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS trades_symbol_status_entry_time_idx
    ON trades (symbol, status, entry_time DESC)
  `);
}

async function initDb() {
  for (let attempt = 1; attempt <= INIT_RETRY_COUNT; attempt += 1) {
    try {
      await createSchema();
      console.log('[postgres] database initialized');
      return;
    } catch (error) {
      if (attempt === INIT_RETRY_COUNT) {
        throw error;
      }

      console.warn(`[postgres] database not ready, retrying ${attempt}/${INIT_RETRY_COUNT}: ${error.message}`);
      await wait(INIT_RETRY_DELAY_MS);
    }
  }
}

module.exports = {
  initDb,
};
