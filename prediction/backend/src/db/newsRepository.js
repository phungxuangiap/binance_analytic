const { pool } = require('./pool');

function mapNewsRow(row) {
  return {
    type: 'news',
    id: row.id,
    symbol: row.symbol,
    title: row.title,
    description: row.description,
    source: row.source,
    time: new Date(row.time).toISOString(),
    status: row.status,
  };
}

async function insertNews(news) {
  const result = await pool.query(
    `
      INSERT INTO news (
        id,
        symbol,
        title,
        description,
        source,
        time,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id)
      DO UPDATE SET
        symbol = EXCLUDED.symbol,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        source = EXCLUDED.source,
        time = EXCLUDED.time,
        status = EXCLUDED.status
      RETURNING *
    `,
    [
      news.id,
      news.symbol,
      news.title,
      news.description ?? null,
      news.source,
      news.time,
      news.status || 'under_predict',
    ],
  );

  return mapNewsRow(result.rows[0]);
}

async function getNewestNewsByStatus({ status, limit }) {
  const result = await pool.query(
    `
      SELECT *
      FROM news
      WHERE status = $1
      ORDER BY time DESC, created_at DESC
      LIMIT $2
    `,
    [status, limit],
  );

  return result.rows.map(mapNewsRow);
}

async function updateNewsStatus(id, status, symbol = null) {
  const result = await pool.query(
    `
      UPDATE news
      SET
        status = $2,
        symbol = COALESCE($3, symbol)
      WHERE id = $1
      RETURNING *
    `,
    [id, status, symbol],
  );

  return result.rows[0] ? mapNewsRow(result.rows[0]) : null;
}

async function getNews({ symbol, limit }) {
  const result = await pool.query(
    `
      SELECT *
      FROM (
        SELECT *
        FROM news
        WHERE symbol = $1
        ORDER BY time DESC
        LIMIT $2
      ) recent
      ORDER BY time ASC
    `,
    [symbol, limit],
  );

  return result.rows.map(mapNewsRow);
}

module.exports = {
  getNewestNewsByStatus,
  getNews,
  insertNews,
  updateNewsStatus,
};
