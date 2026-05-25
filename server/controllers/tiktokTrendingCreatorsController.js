const {
  buildTrendsActorInput,
  normalizeTrendItem,
  runTrendsActor,
  TIKTOK_TRENDS_ACTOR_ID,
} = require('./tiktokTrendsController');
const {
  DEFAULT_COUNTRY,
  getTrendingCreatorsCache,
  upsertTrendingCreatorsCache,
  MIN_ITEMS_TO_CACHE,
} = require('../utils/tiktokTrendingCreatorsStore');
const { toUserFacingError } = require('../utils/userFacingError');

const DEFAULT_LIMIT = Math.min(
  Math.max(Number(process.env.TIKTOK_TRENDING_CREATORS_LIMIT || 48), 1),
  100
);

const VALID_SORT = new Set(['follower', 'engagement', 'avg_views']);

function normalizeSort(sort) {
  const key = String(sort || 'follower').trim().toLowerCase();
  return VALID_SORT.has(key) ? key : 'follower';
}

function normalizeFollowerBand(band) {
  const key = String(band || '').trim();
  return ['1', '2', '3', '4'].includes(key) ? key : '';
}

async function fetchTrendingCreatorsFromApify(
  country,
  sort = 'follower',
  followerBand = '',
  limit = DEFAULT_LIMIT
) {
  const countryCode = String(country || DEFAULT_COUNTRY).trim().toUpperCase();
  const sortKey = normalizeSort(sort);
  const band = normalizeFollowerBand(followerBand);

  const actorInput = buildTrendsActorInput({
    category: 'creators',
    country: countryCode,
    limit,
    creatorSort: sortKey,
    followerBand: band,
  });

  const { items: rawItems, runStatus, itemCount } = await runTrendsActor(actorInput, limit);
  const items = rawItems.map((item, index) => normalizeTrendItem(item, index, 'creators'));

  return {
    items,
    runStatus,
    itemCount,
    country: countryCode,
    sort: sortKey,
    follower_band: band,
    scrape_ok: items.length >= MIN_ITEMS_TO_CACHE,
  };
}

async function refreshTrendingCreatorsForCountry(
  country,
  { source = 'manual', sort = 'follower', followerBand = '', limit = DEFAULT_LIMIT } = {}
) {
  const sortKey = normalizeSort(sort);
  const band = normalizeFollowerBand(followerBand);
  const fetched = await fetchTrendingCreatorsFromApify(country, sortKey, band, limit);

  if (!fetched.scrape_ok) {
    const existing = await getTrendingCreatorsCache(country, sortKey, band);
    if (existing?.items?.length) {
      return {
        ...existing,
        stale: true,
        skipped_write: true,
        scrape_failed: true,
      };
    }
    const err = new Error(
      'Creator trends could not be loaded right now. TikTok may be unavailable for this market — try again later.'
    );
    err.statusCode = 502;
    throw err;
  }

  const cached = await upsertTrendingCreatorsCache(
    fetched.country,
    sortKey,
    band,
    fetched.items,
    source
  );

  return cached;
}

function buildTrendingCreatorsResponse(cached, { fromCache = true, manual = false, stale = false } = {}) {
  if (!cached?.items?.length) {
    return null;
  }

  return {
    source: 'tiktok_creative_center',
    actor: TIKTOK_TRENDS_ACTOR_ID,
    category: 'creators',
    country: cached.country,
    sort: cached.sort,
    follower_band: cached.follower_band || '',
    count: cached.items.length,
    items: cached.items,
    fetched_at: cached.fetched_at,
    cache_source: cached.source,
    from_cache: fromCache,
    manual_refresh: manual,
    is_fresh: cached.is_fresh,
    ttl_hours: cached.ttl_hours,
    stale: Boolean(stale || cached.skipped_write),
    note:
      'Trending creators from TikTok Creative Center. Cached by country, sort, and follower band. Refresh runs a live scrape.',
  };
}

async function getTrendingCreators(req, res) {
  try {
    const country = String(req.query?.country || DEFAULT_COUNTRY).trim().toUpperCase();
    const sort = normalizeSort(req.query?.sort);
    const followerBand = normalizeFollowerBand(req.query?.followerBand || req.query?.follower_band);

    const cached = await getTrendingCreatorsCache(country, sort, followerBand);

    if (!cached?.items?.length) {
      return res.json({
        source: 'tiktok_creative_center',
        actor: TIKTOK_TRENDS_ACTOR_ID,
        category: 'creators',
        country,
        sort,
        follower_band: followerBand,
        count: 0,
        items: [],
        from_cache: true,
        is_fresh: false,
      });
    }

    return res.json(
      buildTrendingCreatorsResponse(cached, {
        fromCache: true,
        stale: !cached.is_fresh,
      })
    );
  } catch (error) {
    console.error('getTrendingCreators error:', error);
    return res.status(500).json({
      error: toUserFacingError(error.message, 'Failed to load trending creators. Please try again.'),
    });
  }
}

async function refreshTrendingCreators(req, res) {
  try {
    const country = String(req.body?.country || DEFAULT_COUNTRY).trim().toUpperCase();
    const sort = normalizeSort(req.body?.sort);
    const followerBand = normalizeFollowerBand(req.body?.followerBand || req.body?.follower_band);
    const limit = Math.min(Math.max(Number(req.body?.limit || DEFAULT_LIMIT), 1), 100);

    const cached = await refreshTrendingCreatorsForCountry(country, {
      source: 'manual',
      sort,
      followerBand,
      limit,
    });

    return res.json(
      buildTrendingCreatorsResponse(cached, {
        fromCache: false,
        manual: true,
        stale: Boolean(cached?.stale),
      })
    );
  } catch (error) {
    console.error('refreshTrendingCreators error:', error);
    const status = error.statusCode === 502 ? 502 : 500;
    return res.status(status).json({
      error: toUserFacingError(
        error.message,
        'Failed to refresh trending creators. Please try again in a few minutes.'
      ),
    });
  }
}

module.exports = {
  getTrendingCreators,
  refreshTrendingCreators,
  refreshTrendingCreatorsForCountry,
  fetchTrendingCreatorsFromApify,
  DEFAULT_LIMIT,
};
