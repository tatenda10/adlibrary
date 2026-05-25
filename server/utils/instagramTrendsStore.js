const pool = require('../db/connection');

const TTL_HOURS = Math.min(Math.max(Number(process.env.INSTAGRAM_TRENDS_CACHE_TTL_HOURS || 12), 1), 168);

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

function parseTagList(hashtags = []) {
  const list = (Array.isArray(hashtags) ? hashtags : String(hashtags || '').split(/[,\s]+/))
    .map((tag) => String(tag || '').trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean);
  return [...new Set(list)].sort();
}

function slugifyBrand(name = '') {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48);
}

function normalizeHashtagKey(hashtags = []) {
  const list = parseTagList(hashtags);
  return list.join(',') || 'trending';
}

function buildTrendsCacheKey(filters = {}) {
  const tags = parseTagList(filters.hashtags);
  const brand = slugifyBrand(filters.brandName);
  const mode = filters.searchMode === 'keyword' ? 'keyword' : 'hashtag';
  const type = filters.resultsType === 'reels' ? 'reels' : 'posts';
  const minLikes = Math.max(0, Number(filters.minLikes) || 0);
  const minComments = Math.max(0, Number(filters.minComments) || 0);
  const requireBrand = filters.requireBrandMatch ? '1' : '0';

  const parts = [
    `mode:${mode}`,
    brand ? `brand:${brand}` : '',
    tags.length ? `tags:${tags.join('+')}` : '',
    `type:${type}`,
    minLikes ? `minLikes:${minLikes}` : '',
    minComments ? `minComments:${minComments}` : '',
    `brandMatch:${requireBrand}`,
  ].filter(Boolean);

  return parts.join('|') || 'trending';
}

function resolveCacheKey(hashtagsOrFilters) {
  if (hashtagsOrFilters && typeof hashtagsOrFilters === 'object' && !Array.isArray(hashtagsOrFilters)) {
    return buildTrendsCacheKey(hashtagsOrFilters);
  }
  if (typeof hashtagsOrFilters === 'string' && hashtagsOrFilters.includes('|')) {
    return hashtagsOrFilters;
  }
  return normalizeHashtagKey(hashtagsOrFilters);
}

function isCacheFresh(fetchedAt) {
  if (!fetchedAt) return false;
  const fetched = new Date(fetchedAt);
  if (Number.isNaN(fetched.getTime())) return false;
  const ageMs = Date.now() - fetched.getTime();
  return ageMs >= 0 && ageMs < TTL_HOURS * 60 * 60 * 1000;
}

async function getInstagramTrendsCache(hashtagsOrFilters) {
  const hashtag_key = resolveCacheKey(hashtagsOrFilters);
  const [rows] = await pool.query(
    `SELECT hashtag_key, items_json, item_count, source, fetched_at, updated_at
     FROM instagram_trends_cache
     WHERE hashtag_key = ?
     LIMIT 1`,
    [hashtag_key]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    hashtag_key: row.hashtag_key,
    hashtags: row.hashtag_key.split(',').filter(Boolean),
    items: parseItemsJson(row.items_json),
    count: Number(row.item_count || 0),
    source: row.source,
    fetched_at: row.fetched_at,
    updated_at: row.updated_at,
    is_fresh: isCacheFresh(row.fetched_at),
    ttl_hours: TTL_HOURS,
  };
}

async function upsertInstagramTrendsCache(hashtagsOrFilters, items = [], source = 'api') {
  const hashtag_key = resolveCacheKey(hashtagsOrFilters);
  const list = Array.isArray(items) ? items : [];
  const payload = JSON.stringify(list);

  await pool.query(
    `INSERT INTO instagram_trends_cache (hashtag_key, items_json, item_count, source, fetched_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       items_json = VALUES(items_json),
       item_count = VALUES(item_count),
       source = VALUES(source),
       fetched_at = NOW(),
       updated_at = CURRENT_TIMESTAMP`,
    [hashtag_key, payload, list.length, source]
  );

  return getInstagramTrendsCache(hashtag_key);
}

module.exports = {
  TTL_HOURS,
  normalizeHashtagKey,
  buildTrendsCacheKey,
  resolveCacheKey,
  getInstagramTrendsCache,
  upsertInstagramTrendsCache,
  isCacheFresh,
};
