const { ApifyClient } = require('apify-client');
const { isTechnicalErrorMessage, toUserFacingError } = require('../utils/userFacingError');
const {
  DEFAULT_COUNTRY,
  getTopAdsCache,
  upsertTopAdsCache,
  MIN_ITEMS_TO_CACHE,
  normalizeCacheKey,
  TTL_HOURS,
} = require('../utils/tiktokTopAdsStore');
const {
  persistTopAdsMedia,
  ensureCachedItemsPlayback,
  streamTopAdVideo,
  streamTopAdThumbnail,
} = require('../utils/topAdsMediaStore');

const TOP_ADS_ACTOR_ID =
  process.env.APIFY_TIKTOK_TOP_ADS_ACTOR || 'beyondops/tiktok-ad-library-scraper';

const DEFAULT_LIMIT = Math.min(Math.max(Number(process.env.TIKTOK_TOP_ADS_LIMIT || 48), 1), 100);
/** Lower = less Apify account RAM reserved per run (helps free-tier memory caps). */
const ACTOR_MEMORY_MB = Math.min(
  Math.max(Number(process.env.TIKTOK_TOP_ADS_MEMORY_MB || 2048), 256),
  8192
);

const DEBUG_TOP_ADS_LOG = String(process.env.TIKTOK_TOP_ADS_DEBUG_LOG || '').trim() === '1';

const VALID_INDUSTRY = new Set([
  '',
  'app_games',
  'app_non_games',
  'ecommerce',
  'education',
  'finance',
  'food_beverage',
  'health',
  'home_improvement',
  'life_services',
  'media_entertainment',
  'tech_electronics',
  'travel',
  'vehicles_transport',
  'fashion_accessories',
  'beauty_personal_care',
  'sports_outdoors',
  'pets',
  'baby_kids_maternity',
  'news_politics',
]);

const VALID_OBJECTIVE = new Set([
  '',
  'traffic',
  'app_install',
  'conversions',
  'reach',
  'video_views',
  'lead_generation',
  'catalog_sales',
  'community_interaction',
]);

const VALID_PERIOD = new Set(['7', '30', '180']);
const VALID_AD_FORMAT = new Set(['', 'spark_ads', 'non_spark_ads', 'collection_ads']);
const VALID_ORDER_BY = new Set(['for_you', 'like', 'ctr', 'impression']);

function pickFirst(...values) {
  for (const value of values) {
    if (value === 0) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return '';
}

function pickNested(item, paths = []) {
  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object' && key in current) return current[key];
      return undefined;
    }, item);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return '';
}

function isApifyArtifactUrl(value = '') {
  const url = String(value || '').toLowerCase();
  return url.includes('api.apify.com/v2/key-value-stores/') || url.includes('/records/video-');
}

function summarizeTopAdPlayback(items, label = 'cache') {
  const list = Array.isArray(items) ? items : [];
  const sample = list[0] || null;
  const withVideo = list.filter((i) => String(i?.videoUrl || i?.videoUrlHd || '').trim()).length;
  const withThumb = list.filter((i) => String(i?.thumbnail || '').trim()).length;
  const withLocalPlayback = list.filter((i) => String(i?.playbackUrl || '').trim()).length;
  const apifyVideoUrls = list.filter((i) =>
    isApifyArtifactUrl(i?.videoUrl || i?.videoUrlHd)
  ).length;

  const samplePlayback = sample
    ? {
        id: sample.id,
        rank: sample.rank,
        name: String(sample.name || '').slice(0, 60),
        videoUrl: sample.videoUrl
          ? `${String(sample.videoUrl).slice(0, 96)}${String(sample.videoUrl).length > 96 ? '…' : ''}`
          : '(empty)',
        videoUrlHd: sample.videoUrlHd ? '(set)' : '(empty)',
        thumbnail: sample.thumbnail ? '(set)' : '(empty)',
        playbackUrl: sample.playbackUrl || '(empty)',
        thumbnailCachedUrl: sample.thumbnailCachedUrl || '(empty)',
        videoUrlHost: (() => {
          try {
            return sample.videoUrl ? new URL(sample.videoUrl).hostname : '';
          } catch {
            return '';
          }
        })(),
      }
    : null;

  const audit = {
    label,
    count: list.length,
    withVideoUrl: withVideo,
    withThumbnail: withThumb,
    withLocalPlaybackUrl: withLocalPlayback,
    apifyArtifactVideoUrls: apifyVideoUrls,
    playableFromCacheEstimate: withLocalPlayback || withVideo,
    sampleKeys: sample && typeof sample === 'object' ? Object.keys(sample) : [],
    sample: samplePlayback,
  };

  console.log('[hot takes / top ads cache]', JSON.stringify(audit, null, 2));
  return audit;
}

function filterKeyFromNormalized(f) {
  return [f.country, f.industry, f.objective, f.period, f.adFormat, f.orderBy].join('|');
}

function normalizeFilters(input = {}) {
  const country = String(input.country || DEFAULT_COUNTRY).trim().toUpperCase();
  const industry = String(input.industry || '').trim().toLowerCase();
  const objective = String(input.objective || '').trim().toLowerCase();
  const period = String(input.period || '7').trim();
  const adFormat = String(input.adFormat || input.ad_format || '').trim().toLowerCase();
  const orderBy = String(input.orderBy || input.order_by || 'for_you').trim().toLowerCase();

  return {
    country,
    industry: VALID_INDUSTRY.has(industry) ? industry : '',
    objective: VALID_OBJECTIVE.has(objective) ? objective : '',
    period: VALID_PERIOD.has(period) ? period : '7',
    adFormat: VALID_AD_FORMAT.has(adFormat) ? adFormat : '',
    orderBy: VALID_ORDER_BY.has(orderBy) ? orderBy : 'for_you',
  };
}

function normalizeTopAdItem(item, index) {
  const adId = pickFirst(item.adId, item.ad_id, item.id);
  const brandName = pickFirst(item.brandName, item.brand_name, item.brand);
  const adTitle = pickFirst(item.adTitle, item.ad_title, item.title, item.name);

  return {
    id: String(adId || `top-ad-${index}`),
    type: 'top_ad',
    rank: index + 1,
    name: String(adTitle || brandName || 'Untitled ad'),
    brandName: String(brandName || ''),
    adTitle: String(adTitle || ''),
    adText: pickFirst(item.adText, item.ad_text, item.description) || '',
    country: pickFirst(item.country, item.countryCode, item.country_code) || '',
    industry: pickFirst(item.industry, item.industryName, item.industry_name) || '',
    objective: pickFirst(item.objective, item.campaignObjective) || '',
    likes: Number(item.likes || item.likeCount || 0) || 0,
    ctr: Number(item.ctr || item.ctrScore || 0) || 0,
    budgetLevel: pickFirst(item.budgetLevel, item.budget_level) || '',
    videoUrl:
      pickFirst(
        item.videoUrl,
        item.video_url,
        item.playUrl,
        item.play_url,
        item.downloadAddr,
        item.download_addr,
        item.video?.playAddr,
        item.video?.downloadAddr,
        pickNested(item, ['video.playAddr', 'video.downloadAddr', 'media.videoUrl'])
      ) || '',
    videoUrlHd:
      pickFirst(
        item.videoUrlHd,
        item.video_url_hd,
        item.hdPlayUrl,
        item.hd_play_url,
        item.video?.playAddr,
        item.video?.downloadAddr,
        pickNested(item, ['video.playAddr', 'video.downloadAddr'])
      ) || '',
    thumbnail:
      pickFirst(
        item.videoCoverUrl,
        item.video_cover_url,
        item.coverUrl,
        item.cover,
        item.thumbnail,
        item.thumbnailUrl,
        item.dynamicCover,
        item.originCover,
        pickNested(item, ['video.cover', 'video.dynamicCover', 'video.originCover'])
      ) || '',
    landingPageUrl: pickFirst(item.landingPageUrl, item.landing_page_url, item.url) || '',
    adFormat: pickFirst(item.adFormat, item.ad_format) || '',
    callToAction: pickFirst(item.callToAction, item.call_to_action) || '',
    videoDuration: Number(item.videoDuration || item.video_duration || 0) || 0,
    url: pickFirst(item.landingPageUrl, item.landing_page_url) || '',
    /** Full TikTok CDN URLs from scraper (may expire over time). */
    playbackUrl: String(item.playbackUrl || '').trim(),
    thumbnailCachedUrl: String(item.thumbnailCachedUrl || '').trim(),
    cached_at: item.cached_at || null,
  };
}

function buildProxyConfiguration(countryCode) {
  const config = {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
  };
  const cc = String(countryCode || '').trim().toUpperCase();
  // Match residential proxy geo to selected market — otherwise Creative Center often
  // defaults to the proxy region (e.g. PK) regardless of the country input field.
  if (cc.length === 2) {
    config.apifyProxyCountry = cc;
  }
  return config;
}

function buildTopAdsActorInput(filters, limit = DEFAULT_LIMIT) {
  const f = normalizeFilters(filters);
  const maxResults = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 100);

  const input = {
    country: f.country,
    industry: f.industry,
    objective: f.objective,
    period: f.period,
    adFormat: f.adFormat,
    orderBy: f.orderBy,
    maxResults,
    proxyConfiguration: buildProxyConfiguration(f.country),
  };

  if (f.country) {
    input.countryCode = f.country;
  }

  return input;
}

async function runTopAdsActor(input) {
  if (!process.env.APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN is not configured');
  }

  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const run = await client.actor(TOP_ADS_ACTOR_ID).call(input, {
    memory: ACTOR_MEMORY_MB,
  });
  const maxItems = Math.min(Math.max(Number(input.maxResults) || DEFAULT_LIMIT, 1), 100);
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: maxItems });
  const list = Array.isArray(items) ? items : [];

  return {
    items: list,
    runStatus: run.status,
    itemCount: list.length,
  };
}

async function fetchTopAdsFromApify(filters = {}, limit = DEFAULT_LIMIT) {
  const normalized = normalizeFilters(filters);
  const actorInput = buildTopAdsActorInput(normalized, limit);

  console.log('[tiktok top ads] Apify scrape filters:', {
    country: normalized.country,
    industry: normalized.industry || '(all)',
    objective: normalized.objective || '(all)',
    period: normalized.period,
    adFormat: normalized.adFormat || '(all)',
    orderBy: normalized.orderBy,
    maxResults: actorInput.maxResults,
    proxyCountry: actorInput.proxyConfiguration?.apifyProxyCountry || '(rotating)',
  });

  if (DEBUG_TOP_ADS_LOG) {
    console.log('[tiktok top ads] full Apify input:', JSON.stringify(actorInput));
  }

  const { items: rawItems, runStatus, itemCount } = await runTopAdsActor(actorInput);

  if (DEBUG_TOP_ADS_LOG && rawItems.length > 0) {
    const sample = rawItems[0];
    console.log('[tiktok top ads] raw row count:', rawItems.length);
    console.log('[tiktok top ads] first row keys:', sample && typeof sample === 'object' ? Object.keys(sample) : []);
    try {
      const json = JSON.stringify(sample);
      console.log('[tiktok top ads] first row (truncated):', json.length > 2500 ? `${json.slice(0, 2500)}…` : json);
    } catch (e) {
      console.log('[tiktok top ads] first row: (could not stringify)', e?.message || e);
    }
  }

  const items = rawItems.map((item, index) => normalizeTopAdItem(item, index));
  const itemsWithMedia = await persistTopAdsMedia(items, normalized);
  const cachedAt = new Date().toISOString();
  const itemsForDb = itemsWithMedia.map((row) => ({ ...row, cached_at: cachedAt }));

  return {
    items: itemsForDb,
    runStatus,
    itemCount,
    filters: normalized,
    scrape_ok: items.length >= MIN_ITEMS_TO_CACHE,
  };
}

async function refreshTopAdsForFilters(filters = {}, { source = 'manual', limit = DEFAULT_LIMIT } = {}) {
  const normalized = normalizeFilters(filters);
  const fetched = await fetchTopAdsFromApify(normalized, limit);

  if (!fetched.scrape_ok) {
    const existing = await getTopAdsCache(normalized);
    if (existing?.items?.length) {
      return {
        ...existing,
        stale: true,
        skipped_write: true,
        scrape_failed: true,
      };
    }
    const err = new Error(
      'Top ads could not be loaded right now. TikTok may be unavailable for this filter — try again later.'
    );
    err.statusCode = 502;
    throw err;
  }

  const cached = await upsertTopAdsCache(normalized, fetched.items, source);
  summarizeTopAdPlayback(cached?.items, `saved-to-db:${source}`);
  return cached;
}

function buildTopAdsResponse(cached, { fromCache = true, manual = false, stale = false } = {}) {
  if (!cached?.items?.length) {
    return null;
  }

  const key = normalizeCacheKey(cached);

  return {
    source: 'tiktok_creative_center',
    actor: TOP_ADS_ACTOR_ID,
    category: 'top_ads',
    country: key.country,
    industry: key.industry,
    objective: key.objective,
    period: key.period,
    ad_format: key.adFormat,
    order_by: key.orderBy,
    filter_key: filterKeyFromNormalized(key),
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
      'Top ads from TikTok Creative Center via beyondops/tiktok-ad-library-scraper. Cached by filter set.',
  };
}

function filtersFromQuery(query = {}) {
  return normalizeFilters({
    country: query.country,
    industry: query.industry,
    objective: query.objective,
    period: query.period,
    adFormat: query.adFormat || query.ad_format,
    orderBy: query.orderBy || query.order_by,
  });
}

function filtersFromBody(body = {}) {
  return normalizeFilters(body);
}

function emptyTopAdsPayload(filters) {
  const f = normalizeFilters(filters);
  return {
    source: 'tiktok_creative_center',
    category: 'top_ads',
    country: f.country,
    industry: f.industry,
    objective: f.objective,
    period: f.period,
    ad_format: f.adFormat,
    order_by: f.orderBy,
    filter_key: filterKeyFromNormalized(f),
    count: 0,
    items: [],
    from_cache: true,
    manual_refresh: false,
    is_fresh: false,
    ttl_hours: TTL_HOURS,
    stale: false,
  };
}

function withVideoUrlMissing(items) {
  const list = Array.isArray(items) ? items : [];
  return list.filter((i) => !String(i?.videoUrl || i?.videoUrlHd || '').trim()).length;
}

function normalizeCachedTopAdItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    if (item && item.type === 'top_ad' && (item.videoUrl || item.thumbnail || item.name)) {
      return normalizeTopAdItem(item, index);
    }
    return normalizeTopAdItem(item, index);
  });
}

async function getTopAds(req, res) {
  try {
    const filters = filtersFromQuery(req.query);
    const cached = await getTopAdsCache(filters);

    if (!cached?.items?.length) {
      return res.json(emptyTopAdsPayload(filters));
    }

    const rawAudit = summarizeTopAdPlayback(cached.items, 'db-raw');
    const normalizedItems = normalizeCachedTopAdItems(cached.items);
    const itemsWithPlayback = await ensureCachedItemsPlayback(normalizedItems, filters);
    const normalizedAudit = summarizeTopAdPlayback(itemsWithPlayback, 'db-normalized');

    const normalizedCache = {
      ...cached,
      items: itemsWithPlayback,
    };

    return res.json({
      ...buildTopAdsResponse(normalizedCache, {
        fromCache: true,
        stale: !cached.is_fresh,
      }),
      playback_audit: {
        raw: rawAudit,
        normalized: normalizedAudit,
        hint:
          withVideoUrlMissing(itemsWithPlayback) > 0
            ? 'Cached rows have no videoUrl — click Refresh to re-scrape and download videos.'
            : normalizedAudit.withLocalPlaybackUrl > 0
              ? 'Playback uses locally cached /api/tiktok/top-ads/media/… URLs.'
              : 'CDN URLs in cache could not be downloaded — click Refresh after TikTok URLs are fresh, or check server logs for [top ads media].',
      },
    });
  } catch (error) {
    console.error('getTopAds error:', error?.message || error);
    return res.status(500).json({
      error: toUserFacingError(error.message, 'Failed to load top ads. Please try again.'),
    });
  }
}

async function refreshTopAds(req, res) {
  try {
    const filters = filtersFromBody(req.body);
    const limit = Math.min(Math.max(Number(req.body?.limit || DEFAULT_LIMIT), 1), 100);

    const cached = await refreshTopAdsForFilters(filters, {
      source: 'manual',
      limit,
    });

    return res.json(
      buildTopAdsResponse(cached, {
        fromCache: false,
        manual: true,
        stale: Boolean(cached?.stale),
      })
    );
  } catch (error) {
    const raw = String(error?.message || error || '');
    const isMemoryOrCapacity =
      error?.statusCode === 402 ||
      error?.type === 'actor-memory-limit-exceeded' ||
      /memory limit|actor-memory/i.test(raw);

    const logLine = isTechnicalErrorMessage(raw)
      ? 'refreshTopAds: Apify run failed (details hidden from client)'
      : `refreshTopAds error: ${raw}`;
    console.error(logLine);

    const status = error.statusCode === 502 ? 502 : isMemoryOrCapacity ? 503 : 500;
    const fallback = isMemoryOrCapacity
      ? 'Top ads could not load right now. Your scraper account may be at its run limit — try again in a few minutes, or after other jobs finish.'
      : 'Failed to refresh top ads. Please try again in a few minutes.';

    return res.status(status).json({
      error: toUserFacingError(error.message, fallback),
      code: isMemoryOrCapacity ? 'scraper_capacity' : undefined,
    });
  }
}

module.exports = {
  getTopAds,
  refreshTopAds,
  refreshTopAdsForFilters,
  fetchTopAdsFromApify,
  normalizeTopAdItem,
  normalizeFilters,
  emptyTopAdsPayload,
  streamTopAdVideo,
  streamTopAdThumbnail,
  DEFAULT_LIMIT,
  TOP_ADS_ACTOR_ID,
};
