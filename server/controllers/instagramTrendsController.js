const { ApifyClient } = require('apify-client');
const { toUserFacingError } = require('../utils/userFacingError');
const {
  getInstagramTrendsCache,
  upsertInstagramTrendsCache,
  buildTrendsCacheKey,
} = require('../utils/instagramTrendsStore');

const INSTAGRAM_HASHTAG_ACTOR =
  process.env.APIFY_INSTAGRAM_HASHTAG_ACTOR || 'apify/instagram-hashtag-scraper';

const DEFAULT_HASHTAGS = String(
  process.env.INSTAGRAM_TRENDS_DEFAULT_HASHTAGS || 'viral,trending,reels,fyp'
)
  .split(',')
  .map((t) => t.trim().replace(/^#/, ''))
  .filter(Boolean);

const DEFAULT_LIMIT = Math.min(Math.max(Number(process.env.INSTAGRAM_TRENDS_LIMIT || 36), 1), 100);
const PER_HASHTAG_LIMIT = Math.min(
  Math.max(Number(process.env.INSTAGRAM_TRENDS_PER_HASHTAG || 12), 1),
  50
);

function pickFirst(...values) {
  for (const value of values) {
    if (value === 0) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return '';
}

function parseHashtagList(raw = '') {
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim().replace(/^#/, '')).filter(Boolean);
  }
  return String(raw || '')
    .split(/[,\s]+/)
    .map((t) => t.trim().replace(/^#/, ''))
    .filter(Boolean);
}

function slugifyBrand(name = '') {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48);
}

function parseTrendsFilters(input = {}) {
  const brandName = String(input.brandName || input.brand || '').trim();
  const hashtags = parseHashtagList(input.hashtags ?? input.hashtag ?? input.q);
  const searchMode = input.searchMode === 'keyword' ? 'keyword' : 'hashtag';
  const resultsType = input.resultsType === 'reels' ? 'reels' : 'posts';
  const limit = Math.min(Math.max(Number(input.limit || DEFAULT_LIMIT), 1), 100);
  const minLikes = Math.max(0, Number(input.minLikes) || 0);
  const minComments = Math.max(0, Number(input.minComments) || 0);
  const requireBrandMatch =
    input.requireBrandMatch === true ||
    input.requireBrandMatch === '1' ||
    input.requireBrandMatch === 'true';

  return {
    brandName,
    hashtags,
    searchMode,
    resultsType,
    limit,
    minLikes,
    minComments,
    requireBrandMatch: requireBrandMatch && Boolean(brandName),
  };
}

function buildScrapeTargets(filters) {
  const targets = [];
  const seen = new Set();

  const addTarget = (value) => {
    const raw = String(value || '').trim().replace(/^#/, '');
    if (!raw) return;
    const key = raw.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(raw);
  };

  if (filters.searchMode === 'keyword') {
    if (filters.brandName) addTarget(filters.brandName);
    filters.hashtags.forEach(addTarget);
  } else {
    filters.hashtags.forEach(addTarget);
    if (filters.brandName) {
      const slug = slugifyBrand(filters.brandName);
      if (slug) addTarget(slug);
    }
  }

  if (!targets.length) {
    DEFAULT_HASHTAGS.forEach(addTarget);
  }

  return targets.slice(0, 8);
}

function applyPostFilters(items, filters) {
  let list = Array.isArray(items) ? items : [];

  if (filters.requireBrandMatch && filters.brandName) {
    const needle = filters.brandName.toLowerCase();
    const slug = slugifyBrand(filters.brandName);
    list = list.filter((item) => {
      const haystack = [
        item.caption,
        item.name,
        item.author,
        item.hashtag,
        item.locationName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle) || (slug && haystack.includes(slug));
    });
  }

  if (filters.minLikes > 0) {
    list = list.filter((item) => Number(item.likes || 0) >= filters.minLikes);
  }
  if (filters.minComments > 0) {
    list = list.filter((item) => Number(item.comments || 0) >= filters.minComments);
  }

  return list;
}

function normalizeTrendPost(item, index, hashtag = '') {
  const shortCode = pickFirst(item.shortCode, item.code, item.id);
  const postUrl = pickFirst(
    item.url,
    item.postUrl,
    shortCode ? `https://www.instagram.com/p/${shortCode}/` : ''
  );

  return {
    id: pickFirst(item.id, shortCode) || `ig-trend-${index}`,
    type: 'instagram_trend',
    rank: index + 1,
    hashtag: pickFirst(item.hashtag, hashtag) || '',
    name: pickFirst(item.caption, item.text)?.slice(0, 120) || 'Instagram post',
    caption: pickFirst(item.caption, item.text) || '',
    url: postUrl,
    instagram_url: postUrl,
    author: pickFirst(item.ownerUsername, item.owner?.username, item.username) || '',
    likes: Number(item.likesCount || item.likes || 0) || 0,
    comments: Number(item.commentsCount || item.comments || 0) || 0,
    views: Number(item.videoViewCount || item.videoPlayCount || item.views || 0) || 0,
    thumbnail: pickFirst(
      item.displayUrl,
      item.thumbnailUrl,
      item.imageUrl,
      ...(Array.isArray(item.images) ? item.images : [])
    ),
    videoUrl: pickFirst(item.videoUrl, item.videoPlayUrl) || '',
    timestamp: pickFirst(item.timestamp, item.takenAt) || '',
    locationName: pickFirst(item.locationName, item.location?.name) || '',
  };
}

async function runHashtagActor(targets, limitPerTag, scrapeOptions = {}) {
  if (!process.env.APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN is not configured');
  }

  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const input = {
    hashtags: targets.map((h) => h.replace(/^#/, '')),
    resultsLimit: limitPerTag,
    resultsType: scrapeOptions.resultsType === 'reels' ? 'reels' : 'posts',
    keywordSearch: scrapeOptions.searchMode === 'keyword',
  };

  const run = await client.actor(INSTAGRAM_HASHTAG_ACTOR).call(input);
  const maxItems = targets.length * limitPerTag;
  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    limit: Math.max(maxItems, 24),
  });

  return Array.isArray(items) ? items : [];
}

async function fetchTrendsFromApify(filters) {
  const targets = buildScrapeTargets(filters);
  const perTag = Math.min(
    PER_HASHTAG_LIMIT,
    Math.max(3, Math.ceil(filters.limit / Math.max(targets.length, 1)))
  );
  const rawItems = await runHashtagActor(targets, perTag, filters);

  const deduped = [];
  const seen = new Set();

  rawItems.forEach((item, index) => {
    const key = pickFirst(item.url, item.shortCode, item.id);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const tag = pickFirst(
      ...(Array.isArray(item.hashtags) ? item.hashtags : []),
      item.hashtag,
      targets[index % targets.length]
    );
    deduped.push(normalizeTrendPost(item, deduped.length, tag));
  });

  deduped.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  const filtered = applyPostFilters(deduped, filters);

  return {
    filters,
    cache_key: buildTrendsCacheKey(filters),
    scrape_targets: targets,
    hashtags: filters.hashtags.length ? filters.hashtags : targets,
    items: filtered.slice(0, filters.limit),
    scraped_count: deduped.length,
    filtered_count: filtered.length,
  };
}

function buildTrendsResponse(cached, { fromCache = true, manual = false, filters = null } = {}) {
  if (!cached?.items?.length) return null;

  return {
    source: 'instagram_hashtag_scraper',
    actor: INSTAGRAM_HASHTAG_ACTOR,
    filters: filters || cached.filters || null,
    cache_key: cached.hashtag_key || (filters ? buildTrendsCacheKey(filters) : ''),
    hashtags: cached.hashtags || [],
    hashtag_key: cached.hashtag_key,
    count: cached.items.length,
    items: cached.items,
    fetched_at: cached.fetched_at,
    cache_source: cached.source,
    from_cache: fromCache,
    manual_refresh: manual,
    is_fresh: cached.is_fresh,
    ttl_hours: cached.ttl_hours,
    note: 'Instagram posts from Apify hashtag/keyword scrape. Cached by filter set.',
  };
}

function emptyTrendsPayload(filters) {
  return {
    source: 'instagram_hashtag_scraper',
    filters,
    cache_key: buildTrendsCacheKey(filters),
    hashtags: filters.hashtags,
    count: 0,
    items: [],
    from_cache: true,
    is_fresh: false,
    note: 'No cached trends for these filters. Click Refresh to scrape.',
  };
}

async function getTrends(req, res) {
  try {
    const filters = parseTrendsFilters(req.query);
    const cached = await getInstagramTrendsCache(filters);

    if (!cached?.items?.length) {
      return res.json(emptyTrendsPayload(filters));
    }

    const items = applyPostFilters(
      cached.items.map((item, index) => normalizeTrendPost(item, index, item.hashtag)),
      filters
    ).map((item, index) => ({ ...item, rank: index + 1 }));

    return res.json(
      buildTrendsResponse(
        { ...cached, items, filters },
        { fromCache: true, filters }
      )
    );
  } catch (error) {
    console.error('getInstagramTrends error:', error);
    return res.status(500).json({
      error: toUserFacingError(error.message, 'Failed to load Instagram trends.'),
    });
  }
}

async function refreshTrends(req, res) {
  try {
    const filters = parseTrendsFilters(req.body);

    const fetched = await fetchTrendsFromApify(filters);
    if (!fetched.items.length) {
      return res.status(502).json({
        error:
          fetched.scraped_count > 0
            ? 'Posts were scraped but none matched your filters (brand match, min likes, etc.). Try looser filters.'
            : 'No Instagram posts returned. Try different hashtags or a brand keyword.',
        filters,
        scraped_count: fetched.scraped_count,
      });
    }

    const cached = await upsertInstagramTrendsCache(
      filters,
      fetched.items,
      'manual'
    );
    return res.json(
      buildTrendsResponse(
        { ...cached, filters, scrape_targets: fetched.scrape_targets },
        { fromCache: false, manual: true, filters }
      )
    );
  } catch (error) {
    console.error('refreshInstagramTrends error:', error);
    return res.status(500).json({
      error: toUserFacingError(error.message, 'Failed to refresh Instagram trends.'),
    });
  }
}

module.exports = {
  getTrends,
  refreshTrends,
  fetchTrendsFromApify,
  parseTrendsFilters,
  DEFAULT_HASHTAGS,
};
