const pool = require('../db/connection');

const DEFAULT_COUNTRY = 'US';
const TTL_HOURS = Math.min(Math.max(Number(process.env.TIKTOK_CREATORS_CACHE_TTL_HOURS || 12), 1), 168);
const MIN_ITEMS_TO_CACHE = Math.min(Math.max(Number(process.env.TIKTOK_CREATORS_CACHE_MIN_ITEMS || 5), 1), 48);

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

function normalizeCacheKey(countryCode, sortKey, followerBand) {
  return {
    country: String(countryCode || DEFAULT_COUNTRY).trim().toUpperCase(),
    sort: String(sortKey || 'follower').trim().toLowerCase(),
    followerBand: String(followerBand || '').trim(),
  };
}

function isCacheFresh(fetchedAt) {
  if (!fetchedAt) return false;
  const fetched = new Date(fetchedAt);
  if (Number.isNaN(fetched.getTime())) return false;
  const ageMs = Date.now() - fetched.getTime();
  return ageMs >= 0 && ageMs < TTL_HOURS * 60 * 60 * 1000;
}

async function getTrendingCreatorsCache(countryCode, sortKey, followerBand = '') {
  const key = normalizeCacheKey(countryCode, sortKey, followerBand);
  const [rows] = await pool.query(
    `SELECT country_code, sort_key, follower_band, items_json, item_count, source, fetched_at, updated_at
     FROM tiktok_trending_creators_cache
     WHERE country_code = ? AND sort_key = ? AND follower_band = ?
     LIMIT 1`,
    [key.country, key.sort, key.followerBand]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    country: row.country_code,
    sort: row.sort_key,
    follower_band: row.follower_band,
    items: parseItemsJson(row.items_json),
    count: Number(row.item_count || 0),
    source: row.source,
    fetched_at: row.fetched_at,
    updated_at: row.updated_at,
    is_fresh: isCacheFresh(row.fetched_at),
    ttl_hours: TTL_HOURS,
  };
}

async function upsertTrendingCreatorsCache(countryCode, sortKey, followerBand, items = [], source = 'api') {
  const key = normalizeCacheKey(countryCode, sortKey, followerBand);
  const list = Array.isArray(items) ? items : [];

  if (list.length < MIN_ITEMS_TO_CACHE) {
    const existing = await getTrendingCreatorsCache(key.country, key.sort, key.followerBand);
    if (existing?.items?.length) {
      return { ...existing, skipped_write: true, stale: true };
    }
    return null;
  }

  const payload = JSON.stringify(list);

  await pool.query(
    `INSERT INTO tiktok_trending_creators_cache (country_code, sort_key, follower_band, items_json, item_count, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       items_json = VALUES(items_json),
       item_count = VALUES(item_count),
       source = VALUES(source),
       fetched_at = NOW(),
       updated_at = CURRENT_TIMESTAMP`,
    [key.country, key.sort, key.followerBand, payload, list.length, source]
  );

  return getTrendingCreatorsCache(key.country, key.sort, key.followerBand);
}

module.exports = {
  DEFAULT_COUNTRY,
  TTL_HOURS,
  MIN_ITEMS_TO_CACHE,
  getTrendingCreatorsCache,
  upsertTrendingCreatorsCache,
  isCacheFresh,
};
