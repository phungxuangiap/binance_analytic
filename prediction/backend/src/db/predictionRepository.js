const { pool } = require('./pool');

function mapPredictionRow(row) {
  return {
    type: 'prediction',
    news_id: row.news_id,
    symbol: row.symbol,
    predicted_direction: row.predicted_direction,
    predicted_time_horizon: row.predicted_time_horizon,
    impact_score: Number(row.impact_score),
    predicted_affect_start_time: new Date(row.predicted_affect_start_time).toISOString(),
    predicted_affect_end_time: new Date(row.predicted_affect_end_time).toISOString(),
  };
}

async function findOverlappingActivePredictions({ symbol, startTime, endTime }) {
  const result = await pool.query(
    `
      SELECT *
      FROM predictions
      WHERE symbol = $1
        AND status = 'active'
        AND predicted_affect_start_time < $3
        AND $2 < predicted_affect_end_time
      ORDER BY predicted_affect_start_time ASC, created_at ASC
    `,
    [symbol, new Date(startTime * 1000).toISOString(), new Date(endTime * 1000).toISOString()],
  );

  return result.rows.map(mapPredictionRow);
}

async function insertPrediction(prediction, endTime) {
  const result = await pool.query(
    `
      INSERT INTO predictions (
        news_id,
        symbol,
        predicted_direction,
        predicted_time_horizon,
        impact_score,
        predicted_affect_start_time,
        predicted_affect_end_time,
        status,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
      ON CONFLICT (news_id)
      DO UPDATE SET
        symbol = EXCLUDED.symbol,
        predicted_direction = EXCLUDED.predicted_direction,
        predicted_time_horizon = EXCLUDED.predicted_time_horizon,
        impact_score = EXCLUDED.impact_score,
        predicted_affect_start_time = EXCLUDED.predicted_affect_start_time,
        predicted_affect_end_time = EXCLUDED.predicted_affect_end_time,
        status = 'active',
        updated_at = NOW()
      RETURNING *
    `,
    [
      prediction.news_id,
      prediction.symbol,
      prediction.predicted_direction,
      prediction.predicted_time_horizon,
      prediction.impact_score,
      prediction.predicted_affect_start_time,
      new Date(endTime * 1000).toISOString(),
    ],
  );

  return mapPredictionRow(result.rows[0]);
}

async function updatePrediction(newsId, patch) {
  const assignments = [];
  const values = [newsId];

  for (const [key, value] of Object.entries(patch)) {
    values.push(value);
    assignments.push(`${key} = $${values.length}`);
  }

  values.push(new Date().toISOString());
  assignments.push(`updated_at = $${values.length}`);

  const result = await pool.query(
    `
      UPDATE predictions
      SET ${assignments.join(', ')}
      WHERE news_id = $1
      RETURNING *
    `,
    values,
  );

  return result.rows[0] ? mapPredictionRow(result.rows[0]) : null;
}

async function deactivatePrediction(newsId) {
  await pool.query(
    `
      UPDATE predictions
      SET status = 'inactive', updated_at = NOW()
      WHERE news_id = $1
    `,
    [newsId],
  );
}

async function getActivePredictions({ symbol, limit }) {
  const result = await pool.query(
    `
      SELECT *
      FROM (
        SELECT *
        FROM predictions
        WHERE symbol = $1
          AND status = 'active'
        ORDER BY predicted_affect_start_time DESC
        LIMIT $2
      ) recent
      ORDER BY predicted_affect_start_time ASC
    `,
    [symbol, limit],
  );

  return result.rows.map(mapPredictionRow);
}

module.exports = {
  deactivatePrediction,
  findOverlappingActivePredictions,
  getActivePredictions,
  insertPrediction,
  updatePrediction,
};
