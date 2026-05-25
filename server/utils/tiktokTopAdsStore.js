const pool = require('../db/connection');

const DEFAULT_COUNTRY = 'US';
const TTL_HOURS = Math.min(Math.max(Number(process.env.TIKTOK_TOP_ADS_CACHE_TTL_HOURS || 12), 1), 168);
const MIN_ITEMS_TO_CACHE = Math.min(Math.max(Number(process.env.TIKTOK_TOP_ADS_CACHE_MIN_ITEMS || 5), 1), 48);

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

function normalizeCacheKey(filters = {}) {
  return {
    country: String(filters.country || DEFAULT_COUNTRY).trim().toUpperCase(),
    industry: String(filters.industry || '').trim().toLowerCase(),
    objective: String(filters.objective || '').trim().toLowerCase(),
    period: String(filters.period || '7').trim(),
    adFormat: String(filters.adFormat || '').trim().toLowerCase(),
    orderBy: String(filters.orderBy || 'for_you').trim().toLowerCase(),
  };
}

function isCacheFresh(fetchedAt) {
  if (!fetchedAt) return false;
  const fetched = new Date(fetchedAt);
  if (Number.isNaN(fetched.getTime())) return false;
  const ageMs = Date.now() - fetched.getTime();
  return ageMs >= 0 && ageMs < TTL_HOURS * 60 * 60 * 1000;
}

async function getTopAdsCache(filters = {}) {
  const key = normalizeCacheKey(filters);
  const [rows] = await pool.query(
    `SELECT country_code, industry_key, objective_key, period_key, ad_format, order_by,
            items_json, item_count, source, fetched_at, updated_at
     FROM tiktok_top_ads_cache
     WHERE country_code = ? AND industry_key = ? AND objective_key = ?
       AND period_key = ? AND ad_format = ? AND order_by = ?
     LIMIT 1`,
    [key.country, key.industry, key.objective, key.period, key.adFormat, key.orderBy]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    country: row.country_code,
    industry: row.industry_key,
    objective: row.objective_key,
    period: row.period_key,
    ad_format: row.ad_format,
    order_by: row.order_by,
    items: parseItemsJson(row.items_json),
    count: Number(row.item_count || 0),
    source: row.source,
    fetched_at: row.fetched_at,
    updated_at: row.updated_at,
    is_fresh: isCacheFresh(row.fetched_at),
    ttl_hours: TTL_HOURS,
  };
}

async function upsertTopAdsCache(filters = {}, items = [], source = 'api') {
  const key = normalizeCacheKey(filters);
  const list = Array.isArray(items) ? items : [];

  if (list.length < MIN_ITEMS_TO_CACHE) {
    const existing = await getTopAdsCache(key);
    if (existing?.items?.length) {
      return { ...existing, skipped_write: true, stale: true };
    }
    return null;
  }

  const payload = JSON.stringify(list);

  await pool.query(
    `INSERT INTO tiktok_top_ads_cache (
       country_code, industry_key, objective_key, period_key, ad_format, order_by,
       items_json, item_count, source, fetched_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       items_json = VALUES(items_json),
       item_count = VALUES(item_count),
       source = VALUES(source),
       fetched_at = NOW(),
       updated_at = CURRENT_TIMESTAMP`,
    [
      key.country,
      key.industry,
      key.objective,
      key.period,
      key.adFormat,
      key.orderBy,
      payload,
      list.length,
      source,
    ]
  );

  return getTopAdsCache(key);
}

module.exports = {
  DEFAULT_COUNTRY,
  TTL_HOURS,
  MIN_ITEMS_TO_CACHE,
  getTopAdsCache,
  upsertTopAdsCache,
  isCacheFresh,
  normalizeCacheKey,
};
