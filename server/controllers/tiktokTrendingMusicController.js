const {
  buildTrendsActorInput,
  normalizeTrendItem,
  runTrendsActor,
  TIKTOK_TRENDS_ACTOR_ID,
} = require('./tiktokTrendsController');
const {
  DEFAULT_COUNTRY,
  getTrendingMusicCache,
  upsertTrendingMusicCache,
} = require('../utils/tiktokTrendingMusicStore');
const { toUserFacingError } = require('../utils/userFacingError');

const DEFAULT_LIMIT = Math.min(
  Math.max(Number(process.env.TIKTOK_TRENDING_MUSIC_LIMIT || 48), 1),
  100
);

async function fetchTrendingSoundsFromApify(country, limit = DEFAULT_LIMIT) {
  const countryCode = String(country || DEFAULT_COUNTRY).trim().toUpperCase();
  const actorInput = buildTrendsActorInput({
    category: 'sounds',
    country: countryCode,
    limit,
  });
  const { items: rawItems } = await runTrendsActor(actorInput, limit);
  return rawItems.map((item, index) => normalizeTrendItem(item, index, 'sounds'));
}

async function refreshTrendingMusicForCountry(country, { source = 'manual', limit = DEFAULT_LIMIT } = {}) {
  const items = await fetchTrendingSoundsFromApify(country, limit);
  const cached = await upsertTrendingMusicCache(country, items, source);
  return cached;
}

function buildTrendingMusicResponse(cached, { fromCache = true, manual = false } = {}) {
  if (!cached) {
    return null;
  }

  return {
    source: 'tiktok_creative_center',
    actor: TIKTOK_TRENDS_ACTOR_ID,
    category: 'sounds',
    country: cached.country,
    count: cached.items.length,
    items: cached.items,
    fetched_at: cached.fetched_at,
    cache_source: cached.source,
    from_cache: fromCache,
    manual_refresh: manual,
    is_fresh_today: cached.is_fresh_today,
    note:
      'Trending music from TikTok Creative Center (advertiser/market view). US updates daily; other countries refresh on manual search.',
  };
}

async function getTrendingMusic(req, res) {
  try {
    const country = String(req.query?.country || DEFAULT_COUNTRY).trim().toUpperCase();
    const cached = await getTrendingMusicCache(country);

    if (!cached?.items?.length) {
      return res.json({
        source: 'tiktok_creative_center',
        actor: TIKTOK_TRENDS_ACTOR_ID,
        category: 'sounds',
        country,
        count: 0,
        items: [],
        from_cache: true,
        is_fresh_today: false,
        note: `No trending music cached for ${country} yet. Click Refresh chart to scrape.`,
      });
    }

    return res.json(buildTrendingMusicResponse(cached, { fromCache: true }));
  } catch (error) {
    console.error('getTrendingMusic error:', error);
    return res.status(500).json({
      error: toUserFacingError(error.message, 'Failed to load trending music. Please try again.'),
    });
  }
}

async function refreshTrendingMusic(req, res) {
  try {
    const country = String(req.body?.country || DEFAULT_COUNTRY).trim().toUpperCase();
    const limit = Math.min(Math.max(Number(req.body?.limit || DEFAULT_LIMIT), 1), 100);

    const cached = await refreshTrendingMusicForCountry(country, {
      source: 'manual',
      limit,
    });

    return res.json(buildTrendingMusicResponse(cached, { fromCache: false, manual: true }));
  } catch (error) {
    console.error('refreshTrendingMusic error:', error);
    return res.status(500).json({
      error: toUserFacingError(error.message, 'Failed to refresh trending music. Please try again.'),
    });
  }
}

module.exports = {
  getTrendingMusic,
  refreshTrendingMusic,
  refreshTrendingMusicForCountry,
  fetchTrendingSoundsFromApify,
  DEFAULT_LIMIT,
};
