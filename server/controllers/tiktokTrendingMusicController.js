const {
  buildTrendsActorInput,
  normalizeTrendItem,
  runApifyActor,
  runTrendsActor,
  TIKTOK_TRENDS_ACTOR_ID,
} = require('./tiktokTrendsController');
const {
  DEFAULT_COUNTRY,
  getTrendingMusicCache,
  upsertTrendingMusicCache,
  MIN_ITEMS_TO_CACHE,
} = require('../utils/tiktokTrendingMusicStore');
const { toUserFacingError } = require('../utils/userFacingError');

const TIKTOK_MUSIC_FALLBACK_ACTOR_ID =
  process.env.APIFY_TIKTOK_MUSIC_FALLBACK_ACTOR || 'burbn/tiktok-trending-sounds';

const DEFAULT_LIMIT = Math.min(
  Math.max(Number(process.env.TIKTOK_TRENDING_MUSIC_LIMIT || 48), 1),
  100
);

function buildMusicFallbackActorInput(countryCode, limit = DEFAULT_LIMIT) {
  return {
    country_code: String(countryCode || DEFAULT_COUNTRY).trim().toUpperCase(),
    period: '7',
    rank_type: 'popular',
    maxResults: Math.min(Math.max(Number(limit) || 48, 1), 100),
  };
}

function normalizeBurbnSoundItem(item, index) {
  return normalizeTrendItem(
    {
      id: item.clip_id || item.song_id,
      title: item.title,
      name: item.title,
      link: item.link,
      url: item.link,
      cover: item.cover,
      authorName: item.author,
      author: item.author,
      country_code: item.country_code,
      rank: item.rank,
      rank_diff: item.rank_diff,
      marked_as_new: item.rank_diff_type === 4,
      is_promoted: item.is_promoted,
      duration: item.duration,
    },
    index,
    'sounds'
  );
}

async function runMusicFallbackActor(countryCode, limit = DEFAULT_LIMIT) {
  const input = buildMusicFallbackActorInput(countryCode, limit);
  const result = await runApifyActor(TIKTOK_MUSIC_FALLBACK_ACTOR_ID, input, limit, {
    logLabel: 'tiktok-trending-music-fallback',
  });

  return {
    ...result,
    items: result.items.map((item, index) => normalizeBurbnSoundItem(item, index)),
  };
}

async function fetchTrendingSoundsFromApify(country, limit = DEFAULT_LIMIT) {
  const countryCode = String(country || DEFAULT_COUNTRY).trim().toUpperCase();
  const actorInput = buildTrendsActorInput({
    category: 'sounds',
    country: countryCode,
    limit,
  });

  const primary = await runTrendsActor(actorInput, limit);
  let items = primary.items.map((item, index) => normalizeTrendItem(item, index, 'sounds'));
  let actor = TIKTOK_TRENDS_ACTOR_ID;
  let runStatus = primary.runStatus;
  let itemCount = primary.itemCount;
  let usedFallback = false;

  if (items.length < MIN_ITEMS_TO_CACHE) {
    console.warn('[tiktok-trending-music] primary scrape insufficient; trying fallback actor', {
      primaryActor: TIKTOK_TRENDS_ACTOR_ID,
      fallbackActor: TIKTOK_MUSIC_FALLBACK_ACTOR_ID,
      country: countryCode,
      primaryCount: items.length,
      minRequired: MIN_ITEMS_TO_CACHE,
    });

    const fallback = await runMusicFallbackActor(countryCode, limit);
    if (fallback.items.length > items.length) {
      items = fallback.items;
      actor = TIKTOK_MUSIC_FALLBACK_ACTOR_ID;
      runStatus = fallback.runStatus;
      itemCount = fallback.itemCount;
      usedFallback = true;

      console.info('[tiktok-trending-music] fallback actor used', {
        actor: TIKTOK_MUSIC_FALLBACK_ACTOR_ID,
        country: countryCode,
        itemCount: items.length,
      });
    }
  }

  return {
    items,
    runStatus,
    itemCount,
    country: countryCode,
    actor,
    used_fallback: usedFallback,
    scrape_ok: items.length >= MIN_ITEMS_TO_CACHE,
  };
}

async function refreshTrendingMusicForCountry(country, { source = 'manual', limit = DEFAULT_LIMIT } = {}) {
  const countryCode = String(country || DEFAULT_COUNTRY).trim().toUpperCase();
  const fetched = await fetchTrendingSoundsFromApify(countryCode, limit);

  if (!fetched.scrape_ok) {
    const existing = await getTrendingMusicCache(countryCode);
    if (existing?.items?.length) {
      console.warn('[tiktok-trending-music] live scrape failed; serving stale cache', {
        country: countryCode,
        runStatus: fetched.runStatus,
        itemCount: fetched.itemCount,
        kept: existing.items.length,
        source,
        triedFallback: fetched.used_fallback,
      });
      return {
        ...existing,
        stale: true,
        skipped_write: true,
        scrape_failed: true,
        kept_cache: true,
      };
    }

    const err = new Error(
      'Trending music could not be loaded right now. TikTok Creative Center may be temporarily unavailable — try again later.'
    );
    err.statusCode = 502;
    throw err;
  }

  const cached = await upsertTrendingMusicCache(countryCode, fetched.items, source);
  if (!cached?.items?.length) {
    const err = new Error(
      'Trending music could not be saved. TikTok returned too few results for this market.'
    );
    err.statusCode = 502;
    throw err;
  }

  return {
    ...cached,
    actor: fetched.actor,
    used_fallback: fetched.used_fallback,
  };
}

function buildTrendingMusicResponse(
  cached,
  { fromCache = true, manual = false, stale = false } = {}
) {
  if (!cached) {
    return null;
  }

  const isStale = Boolean(stale || cached.stale || cached.skipped_write || cached.scrape_failed);

  return {
    source: 'tiktok_creative_center',
    actor: cached.actor || TIKTOK_TRENDS_ACTOR_ID,
    used_fallback: Boolean(cached.used_fallback),
    category: 'sounds',
    country: cached.country,
    count: cached.items.length,
    items: cached.items,
    fetched_at: cached.fetched_at,
    cache_source: cached.source,
    from_cache: fromCache,
    manual_refresh: manual,
    is_fresh_today: cached.is_fresh_today,
    stale: isStale,
    scrape_failed: Boolean(cached.scrape_failed),
    kept_cache: Boolean(cached.kept_cache),
    note: isStale
      ? 'Live scrape failed or returned too little data — showing the last good chart from cache.'
      : 'Trending music from TikTok Creative Center (advertiser/market view). US updates daily; other countries refresh on manual search.',
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
        stale: false,
        note: `No trending music cached for ${country} yet. Click Refresh chart to scrape.`,
      });
    }

    return res.json(
      buildTrendingMusicResponse(cached, {
        fromCache: true,
        stale: !cached.is_fresh_today,
      })
    );
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

    return res.json(
      buildTrendingMusicResponse(cached, {
        fromCache: Boolean(cached?.kept_cache),
        manual: true,
        stale: Boolean(cached?.stale),
      })
    );
  } catch (error) {
    console.error('refreshTrendingMusic error:', error);
    const status = error.statusCode === 502 ? 502 : 500;
    return res.status(status).json({
      error: toUserFacingError(
        error.message,
        'Failed to refresh trending music. Please try again in a few minutes.'
      ),
    });
  }
}

module.exports = {
  getTrendingMusic,
  refreshTrendingMusic,
  refreshTrendingMusicForCountry,
  fetchTrendingSoundsFromApify,
  DEFAULT_LIMIT,
  TIKTOK_MUSIC_FALLBACK_ACTOR_ID,
};
