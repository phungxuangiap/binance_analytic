const { pool } = require('./pool');

const MAX_MOVE_PERCENT_BY_SYMBOL = {
  BTCUSDT: 0.06,
  SOLUSDT: 0.09,
};

function impactScoreToPredictedPercent(impactScore, symbol) {
  const safeImpact = Number.isFinite(impactScore) ? impactScore : 0;
  const clampedImpact = Math.min(Math.max(safeImpact, 0), 100);
  const maxMovePercent = MAX_MOVE_PERCENT_BY_SYMBOL[symbol] ?? 0.06;

  return (clampedImpact / 100) * maxMovePercent;
}

function mapTradeRow(row) {
  return {
    type: 'trade',
    news_id: row.news_id,
    symbol: row.symbol,
    prediction_direction: row.prediction_direction,
    predicted_time_horizon: row.predicted_time_horizon,
    impact_score: Number(row.impact_score),
    predicted_percent: Number(row.predicted_percent),
    position_side: row.position_side,
    entry_action: row.entry_action,
    exit_action: row.exit_action,
    entry_time: new Date(row.entry_time).toISOString(),
    exit_time: row.exit_time ? new Date(row.exit_time).toISOString() : undefined,
    entry_price: row.entry_price === null ? undefined : Number(row.entry_price),
    exit_price: row.exit_price === null ? undefined : Number(row.exit_price),
    pnl: row.pnl === null ? undefined : Number(row.pnl),
    pnl_percent: row.pnl_percent === null ? undefined : Number(row.pnl_percent),
    result: row.result || undefined,
    status: row.status,
  };
}

function getTradeSide(prediction) {
  return prediction.predicted_direction === 'UP' ? 'LONG' : 'SHORT';
}

function getEntryAction(prediction) {
  return prediction.predicted_direction === 'UP' ? 'BUY' : 'SELL';
}

function getExitAction(predictionDirection) {
  return predictionDirection === 'UP' ? 'SELL' : 'BUY';
}

function getProfitLoss(predictionDirection, entryPrice, exitPrice) {
  const pnl = predictionDirection === 'UP'
    ? exitPrice - entryPrice
    : entryPrice - exitPrice;

  return {
    pnl,
    pnlPercent: entryPrice === 0 ? 0 : (pnl / entryPrice) * 100,
    result: pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN',
  };
}

async function openTradeFromPrediction({ prediction, entryTime, entryPrice }) {
  const result = await pool.query(
    `
      INSERT INTO trades (
        news_id,
        symbol,
        prediction_direction,
        predicted_time_horizon,
        impact_score,
        predicted_percent,
        position_side,
        entry_action,
        entry_time,
        entry_price,
        status,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open', NOW())
      ON CONFLICT (news_id) DO NOTHING
      RETURNING *
    `,
    [
      prediction.news_id,
      prediction.symbol,
      prediction.predicted_direction,
      prediction.predicted_time_horizon,
      prediction.impact_score,
      impactScoreToPredictedPercent(prediction.impact_score, prediction.symbol),
      getTradeSide(prediction),
      getEntryAction(prediction),
      entryTime,
      entryPrice,
    ],
  );

  return result.rows[0] ? mapTradeRow(result.rows[0]) : null;
}

async function closeTrade({ newsId, exitTime, exitPrice }) {
  const existingResult = await pool.query(
    `
      SELECT *
      FROM trades
      WHERE news_id = $1
        AND status = 'open'
    `,
    [newsId],
  );

  const existingTrade = existingResult.rows[0];

  if (!existingTrade || existingTrade.entry_price === null || exitPrice === undefined) {
    return null;
  }

  const entryPrice = Number(existingTrade.entry_price);
  const profitLoss = getProfitLoss(existingTrade.prediction_direction, entryPrice, exitPrice);
  const result = await pool.query(
    `
      UPDATE trades
      SET
        exit_action = $2,
        exit_time = $3,
        exit_price = $4,
        pnl = $5,
        pnl_percent = $6,
        result = $7,
        status = 'closed',
        updated_at = NOW()
      WHERE news_id = $1
        AND status = 'open'
      RETURNING *
    `,
    [
      newsId,
      getExitAction(existingTrade.prediction_direction),
      exitTime,
      exitPrice,
      profitLoss.pnl,
      profitLoss.pnlPercent,
      profitLoss.result,
    ],
  );

  return result.rows[0] ? mapTradeRow(result.rows[0]) : null;
}

async function getTrades({ symbol, limit }) {
  const result = await pool.query(
    `
      SELECT *
      FROM (
        SELECT *
        FROM trades
        WHERE symbol = $1
        ORDER BY entry_time DESC
        LIMIT $2
      ) recent
      ORDER BY entry_time ASC
    `,
    [symbol, limit],
  );

  return result.rows.map(mapTradeRow);
}

module.exports = {
  closeTrade,
  getTrades,
  openTradeFromPrediction,
};
