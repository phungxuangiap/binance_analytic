const { pool } = require('./pool');

function mapNewsRow(row) {
  return {
    type: 'news',
    id: row.id,
    symbol: row.symbol,
    title: row.title,
    source: row.source,
    time: new Date(row.time).toISOString(),
  };
}

async function insertNews(news) {
  const result = await pool.query(
    `
      INSERT INTO news (
        id,
        symbol,
        title,
        source,
        time
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id)
      DO UPDATE SET
        symbol = EXCLUDED.symbol,
        title = EXCLUDED.title,
        source = EXCLUDED.source,
        time = EXCLUDED.time
      RETURNING *
    `,
    [
      news.id,
      news.symbol,
      news.title,
      news.source,
      news.time,
    ],
  );

  return mapNewsRow(result.rows[0]);
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
  getNews,
  insertNews,
};
