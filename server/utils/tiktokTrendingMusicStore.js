const pool = require('../db/connection');

const DEFAULT_COUNTRY = String(process.env.TIKTOK_TRENDING_MUSIC_DEFAULT_COUNTRY || 'US')
  .trim()
  .toUpperCase();

function parseItemsJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isCacheFreshForToday(fetchedAt) {
  if (!fetchedAt) return false;
  const fetched = new Date(fetchedAt);
  if (Number.isNaN(fetched.getTime())) return false;
  const now = new Date();
  return fetched.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
}

async function getTrendingMusicCache(countryCode) {
  const code = String(countryCode || DEFAULT_COUNTRY).trim().toUpperCase();
  const [rows] = await pool.query(
    `SELECT country_code, items_json, item_count, source, fetched_at, updated_at
     FROM tiktok_trending_music_cache
     WHERE country_code = ?
     LIMIT 1`,
    [code]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    country: row.country_code,
    items: parseItemsJson(row.items_json),
    count: Number(row.item_count || 0),
    source: row.source,
    fetched_at: row.fetched_at,
    updated_at: row.updated_at,
    is_fresh_today: isCacheFreshForToday(row.fetched_at),
  };
}

async function upsertTrendingMusicCache(countryCode, items = [], source = 'daily_job') {
  const code = String(countryCode || DEFAULT_COUNTRY).trim().toUpperCase();
  const list = Array.isArray(items) ? items : [];
  const payload = JSON.stringify(list);

  await pool.query(
    `INSERT INTO tiktok_trending_music_cache (country_code, items_json, item_count, source, fetched_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       items_json = VALUES(items_json),
       item_count = VALUES(item_count),
       source = VALUES(source),
       fetched_at = NOW(),
       updated_at = CURRENT_TIMESTAMP`,
    [code, payload, list.length, source]
  );

  return getTrendingMusicCache(code);
}

async function cacheNeedsDailyRefresh(countryCode) {
  const cached = await getTrendingMusicCache(countryCode);
  if (!cached?.items?.length) return true;
  return !cached.is_fresh_today;
}

module.exports = {
  DEFAULT_COUNTRY,
  getTrendingMusicCache,
  upsertTrendingMusicCache,
  cacheNeedsDailyRefresh,
  isCacheFreshForToday,
};
