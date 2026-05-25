const { ApifyClient } = require('apify-client');

const FACEBOOK_BASE_URL = 'https://www.facebook.com';
const META_AD_LIBRARY_URL = `${FACEBOOK_BASE_URL}/ads/library/`;
/** Default: Curious Coder Facebook Ad Library Scraper (Apify Store). Override with APIFY_FACEBOOK_AD_LIBRARY_ACTOR or APIFY_FACEBOOK_ADS_ACTOR. */
const DEFAULT_FACEBOOK_ADS_ACTOR_ID =
  process.env.APIFY_FACEBOOK_AD_LIBRARY_ACTOR ||
  process.env.APIFY_FACEBOOK_ADS_ACTOR ||
  'curious_coder/facebook-ads-library-scraper';
const VALID_PUBLISHER_PLATFORMS = new Set([
  'facebook',
  'instagram',
  'messenger',
  'whatsapp',
  'threads',
  'audience_network',
]);
const VALID_MEDIA_TYPES = new Set(['all', 'image', 'video', 'memes_and_stickers']);

function pickFirst(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function getByPath(value, path) {
  return path.split('.').reduce((current, key) => {
    if (current && typeof current === 'object' && key in current) return current[key];
    return undefined;
  }, value);
}

function pickNested(item, paths = []) {
  for (const path of paths) {
    const value = getByPath(item, path);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function flattenValues(value) {
  if (Array.isArray(value)) return value.flatMap(flattenValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenValues);
  return [value];
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function arrayFromPaths(item, paths = []) {
  const values = [];
  for (const path of paths) {
    const resolved = getByPath(item, path);
    const flattened = flattenValues(resolved)
      .filter((entry) => typeof entry === 'string' && entry.trim())
      .map((entry) => entry.trim());
    values.push(...flattened);
  }
  return [...new Set(values)];
}

function normalizeApifyPublisherPlatforms(platforms) {
  const list = Array.isArray(platforms) ? platforms : platforms ? [platforms] : [];
  return dedupeStrings(
    list.map((value) => {
      const key = String(value || '').trim().toLowerCase();
      if (!key) return '';
      if (key === 'audience_network') return 'audience_network';
      return key.replace(/\s+/g, '_');
    })
  ).filter((value) => VALID_PUBLISHER_PLATFORMS.has(value));
}

/** Curious Coder facebook-ads-library-scraper row shape (ad_archive_id + snapshot). */
function isCuriousCoderAdLibraryRow(item) {
  return Boolean(item && typeof item === 'object' && (item.ad_archive_id || item.ad_library_url) && item.snapshot);
}

function extractCuriousCoderVideoUrls(item) {
  const videos = getByPath(item, 'snapshot.videos');
  if (!Array.isArray(videos)) return { hd: '', sd: '', preview: '' };
  const first = videos[0] || {};
  return {
    hd: pickFirst(first.video_hd_url, first.videoHdUrl),
    sd: pickFirst(first.video_sd_url, first.videoSdUrl),
    preview: pickFirst(first.video_preview_image_url, first.videoPreviewImageUrl, first.thumbnail_url),
  };
}

function pickAdExternalUrl(item) {
  const candidates = [
    pickNested(item, ['ad_library_url', 'adLibraryUrl']),
    pickNested(item, ['snapshot.link_url', 'snapshot.linkUrl']),
    pickNested(item, ['snapshotUrl', 'adSnapshotUrl', 'ad_snapshot_url']),
    pickNested(item, ['ad_content.landingUrl', 'creative.landingUrl']),
  ];
  for (const value of candidates) {
    if (value && !isMetaAdLibraryUrl(value)) return value;
  }
  const generic = pickNested(item, ['url', 'external_url']);
  if (generic && !isMetaAdLibraryUrl(generic)) return generic;
  return pickNested(item, ['ad_library_url', 'adLibraryUrl']) || '';
}

function extractFacebookMediaAssets(item) {
  const curiousVideos = isCuriousCoderAdLibraryRow(item) ? extractCuriousCoderVideoUrls(item) : null;
  const urls = dedupeStrings([
    ...(curiousVideos
      ? [curiousVideos.preview, curiousVideos.hd, curiousVideos.sd].filter(Boolean)
      : []),
    pickNested(item, ['snapshot.page_profile_picture_url', 'snapshot.pageProfilePictureUrl']),
    ...arrayFromPaths(item, [
      'imageUrl',
      'image_url',
      'thumbnailUrl',
      'thumbnail',
      'snapshot.images',
      'snapshot.image_url',
      'creative.thumbnailUrl',
      'creative.thumbnail.url',
      'creative.image.url',
      'ad_content.mediaUrls',
      'ad_content.media_urls',
      'ad_content.imageUrls',
      'ad_content.images',
      'creative.mediaUrls',
      'creative.imageUrls',
      'creative.images',
      'cards.image_url',
      'cards.imageUrl',
      'cards.thumbnail_url',
      'cards.image.url',
      'videos.thumbnail',
      'attachments.media.image.src',
      'attachments.media.image.uri',
    ]),
    ...arrayFromPaths(item, [
      'videoUrl',
      'video_url',
      'snapshot.videos.0.video_hd_url',
      'snapshot.videos.0.video_sd_url',
      'snapshot.videos.0.video_preview_image_url',
      'creative.videoUrl',
      'creative.video.url',
      'ad_content.videoUrl',
      'ad_content.video_url',
      'cards.video_url',
      'cards.video.url',
      'videos.url',
      'video.url',
    ]),
  ]);

  return urls
    .filter((url) => /^https?:\/\//i.test(String(url || '').trim()))
    .map((url) => {
      const lower = String(url).toLowerCase();
      return {
        url,
        type: /\.mp4(\?|$)/i.test(lower) || lower.includes('/video') ? 'video' : 'image',
      };
    });
}

function clamp(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, min), max);
}

function extractJsonObject(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeCountryCodes(countries) {
  const list = Array.isArray(countries) && countries.length ? countries : ['US'];
  const normalized = [...new Set(list.map((value) => String(value || '').toUpperCase().trim()).filter(Boolean))];
  if (normalized.includes('ALL')) return ['ALL'];
  return normalized;
}

function normalizePublisherPlatforms(platforms) {
  const list = Array.isArray(platforms) ? platforms : [];
  return [...new Set(
    list
      .map((value) => String(value || '').trim().toLowerCase())
      .filter((value) => VALID_PUBLISHER_PLATFORMS.has(value))
  )];
}

function normalizeLanguageCodes(languageCodes) {
  const list = Array.isArray(languageCodes) ? languageCodes : [];
  return [...new Set(
    list
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 5)
  )];
}

function normalizeMediaType(value) {
  const mediaType = String(value || 'all').trim().toLowerCase();
  return VALID_MEDIA_TYPES.has(mediaType) ? mediaType : 'all';
}

function normalizeAdActiveStatus(value) {
  const normalized = String(value || 'ALL').trim().toUpperCase();
  if (normalized === 'ACTIVE') return 'ACTIVE';
  if (normalized === 'INACTIVE') return 'INACTIVE';
  return 'ALL';
}

function normalizeAdType(value) {
  const normalized = String(value || 'ALL').trim().toUpperCase();
  return normalized || 'ALL';
}

function normalizeFacebookSearchMode(value) {
  const mode = String(value || 'keyword').trim().toLowerCase();
  if (['keyword', 'competitor', 'research'].includes(mode)) return mode;
  return 'keyword';
}

function toAdLibraryStatusValue(value) {
  const normalized = normalizeAdActiveStatus(value);
  if (normalized === 'ACTIVE') return 'active';
  if (normalized === 'INACTIVE') return 'inactive';
  return 'all';
}

function toAdLibraryTypeValue(value) {
  const normalized = normalizeAdType(value).toLowerCase();
  return normalized || 'all';
}

function isLikelyUrl(value = '') {
  const raw = String(value || '').trim();
  return /^https?:\/\//i.test(raw) || /^www\./i.test(raw);
}

function isMetaAdLibraryUrl(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  return raw.includes('facebook.com/ads/library');
}

function isFacebookPageUrl(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  return raw.includes('facebook.com/') && !raw.includes('/ads/library');
}

function normalizeFacebookPageUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (isFacebookPageUrl(raw)) {
    return raw.startsWith('http') ? raw : `https://${raw.replace(/^\/+/, '')}`;
  }

  if (/^[a-zA-Z0-9.\-_]+$/.test(raw) && !raw.includes(' ')) {
    return `${FACEBOOK_BASE_URL}/${raw.replace(/^@/, '')}`;
  }

  return '';
}

function slugFromFacebookPageUrl(value = '') {
  const normalized = normalizeFacebookPageUrl(value);
  if (!normalized) return '';

  try {
    const parsed = new URL(normalized);
    const segments = parsed.pathname.split('/').map((segment) => segment.trim()).filter(Boolean);
    if (!segments.length) return '';
    const last = segments[segments.length - 1];
    if (/^\d+$/.test(last)) return last;
    return last.replace(/^@/, '');
  } catch {
    return '';
  }
}

function buildMetaAdLibrarySearchUrl({
  query,
  country = 'US',
  adType = 'ALL',
  adActiveStatus = 'ALL',
  publisherPlatforms = [],
  mediaType = 'all',
  languageCodes = [],
}) {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery) return '';

  const url = new URL(META_AD_LIBRARY_URL);
  url.searchParams.set('active_status', toAdLibraryStatusValue(adActiveStatus));
  url.searchParams.set('ad_type', toAdLibraryTypeValue(adType));
  url.searchParams.set('country', String(country || 'US').toUpperCase());
  url.searchParams.set('is_targeted_country', 'false');
  url.searchParams.set('media_type', normalizeMediaType(mediaType));
  url.searchParams.set('search_type', 'keyword_unordered');
  url.searchParams.set('q', trimmedQuery);

  normalizePublisherPlatforms(publisherPlatforms).forEach((platform, index) => {
    url.searchParams.set(`publisher_platforms[${index}]`, platform);
  });

  normalizeLanguageCodes(languageCodes).forEach((languageCode, index) => {
    url.searchParams.set(`content_languages[${index}]`, languageCode);
  });

  return url.toString();
}

function dedupeStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

const FACEBOOK_SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'for', 'from', 'how', 'i',
  'if', 'im', "i'm", 'in', 'is', 'it', 'looking', 'market', 'me', 'my', 'of', 'on',
  'or', 'our', 'related', 'show', 'that', 'the', 'their', 'them', 'these', 'this',
  'to', 'us', 'want', 'we', 'with', 'you', 'your',
]);

function normalizeSearchText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearchText(value = '') {
  return normalizeSearchText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !FACEBOOK_SEARCH_STOP_WORDS.has(token));
}

function escapeRegExp(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholePhrase(text = '', phrase = '') {
  const normalizedText = ` ${normalizeSearchText(text)} `;
  const normalizedPhrase = normalizeSearchText(phrase);
  if (!normalizedPhrase) return false;
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(normalizedPhrase)}(?=\\s|$)`, 'i');
  return pattern.test(normalizedText);
}

/** Normalize brand strings for loose matching (dots, spacing). */
function normalizeBrandToken(value = '') {
  return normalizeSearchText(String(value || '').replace(/\./g, ' '));
}

/** True if page or title clearly matches a known competitor name (not body-only). */
function isCompetitorAlignedPage(item, competitorKeywords = []) {
  const page = normalizeBrandToken(item.page_name || '');
  const title = normalizeBrandToken(item.title || '');
  const combined = `${page} ${title}`.trim();
  if (!combined) return false;
  for (const term of competitorKeywords) {
    const t = normalizeBrandToken(term);
    if (!t || t.length < 2) continue;
    if (combined.includes(t) || hasWholePhrase(combined, t)) return true;
  }
  return false;
}

function buildMetaAdLibraryIdUrl(providerId) {
  if (providerId === undefined || providerId === null || providerId === '') return '';
  const id = String(providerId).trim();
  if (!/^\d+$/.test(id)) return '';
  return `${META_AD_LIBRARY_URL}?id=${encodeURIComponent(id)}`;
}

function buildSearchTargets({
  keyword,
  countries,
  adType,
  adActiveStatus,
  explicitUrls = [],
  explicitPageUrls = [],
  relatedQueries = [],
  publisherPlatforms = [],
  mediaType = 'all',
  languageCodes = [],
}) {
  const targets = [];
  const normalizedCountries = normalizeCountryCodes(countries);
  const primaryCountry = normalizedCountries[0] || 'US';
  const trimmedKeyword = String(keyword || '').trim();

  for (const value of dedupeStrings(explicitUrls)) {
    if (isMetaAdLibraryUrl(value)) {
      targets.push(value);
      continue;
    }

    const normalizedPageUrl = normalizeFacebookPageUrl(value);
    if (normalizedPageUrl) {
      targets.push(normalizedPageUrl);
    }
  }

  for (const value of dedupeStrings(explicitPageUrls)) {
    const normalizedPageUrl = normalizeFacebookPageUrl(value);
    if (normalizedPageUrl) {
      targets.push(normalizedPageUrl);
    }
  }

  if (trimmedKeyword) {
    if (isMetaAdLibraryUrl(trimmedKeyword)) {
      targets.push(trimmedKeyword);
    } else {
      const normalizedPageUrl = normalizeFacebookPageUrl(trimmedKeyword);
      if (normalizedPageUrl && !trimmedKeyword.includes(' ')) {
        targets.push(normalizedPageUrl);
      } else {
        targets.push(
          buildMetaAdLibrarySearchUrl({
            query: trimmedKeyword,
            country: primaryCountry,
            adType,
            adActiveStatus,
            publisherPlatforms,
            mediaType,
            languageCodes,
          })
        );
      }
    }
  }

  for (const query of dedupeStrings(relatedQueries)) {
    if (targets.length >= 6) break;
    targets.push(
      buildMetaAdLibrarySearchUrl({
        query,
        country: primaryCountry,
        adType,
        adActiveStatus,
        publisherPlatforms,
        mediaType,
        languageCodes,
      })
    );
  }

  return dedupeStrings(targets).filter(Boolean);
}

function createActorInput({ targets, limit, adActiveStatus, countries }) {
  const primaryCountry = normalizeCountryCodes(countries)[0] || 'US';
  const resultsLimit = clamp(limit, 1, 100, 20);
  const normalizedActiveStatus = toAdLibraryStatusValue(adActiveStatus);

  return {
    startUrls: dedupeStrings(targets)
      .map((target) => {
        try {
          const parsed = new URL(String(target).trim());
          return { url: parsed.toString() };
        } catch {
          return null;
        }
      })
      .filter(Boolean),
    resultsLimit,
    activeStatus: normalizedActiveStatus === 'all' ? '' : normalizedActiveStatus,
    isDetailsPerAd: true,
    includeAboutPage: true,
    countryFallback: primaryCountry,
  };
}

function isCuriousCoderFacebookAdLibraryActor(actorId) {
  const id = String(actorId || '').toLowerCase();
  return id.includes('curious_coder') && id.includes('facebook-ads-library-scraper');
}

/** Input schema for curious_coder/facebook-ads-library-scraper (see Apify actor README). */
function createCuriousCoderAdLibraryInput({ targets, limit, adActiveStatus, countries }) {
  const primaryCountry = normalizeCountryCodes(countries)[0] || 'US';
  const urls = dedupeStrings(targets)
    .map((target) => {
      try {
        const parsed = new URL(String(target).trim());
        return { url: parsed.toString() };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const normalizedActive = toAdLibraryStatusValue(adActiveStatus);
  const activeForActor = normalizedActive === 'all' ? 'all' : normalizedActive;
  const totalAds = clamp(limit, 1, 500, 100);

  return {
    urls,
    count: totalAds,
    scrapeAdDetails: process.env.APIFY_FACEBOOK_SCRAPER_AD_DETAILS === '1',
    'scrapePageAds.period': '',
    'scrapePageAds.activeStatus': activeForActor,
    'scrapePageAds.sortBy': 'impressions_desc',
    'scrapePageAds.countryCode':
      primaryCountry === 'ALL'
        ? 'ALL'
        : primaryCountry.length === 2
          ? primaryCountry.toUpperCase()
          : 'US',
  };
}

async function planFacebookAdsSearch({
  prompt,
  fallbackKeyword,
  businessProfile,
  countries = ['US'],
  adActiveStatus = 'ALL',
  searchMode = 'keyword',
}) {
  const fallbackPlan = {
    query: fallbackKeyword,
    related_queries: [fallbackKeyword].filter(Boolean),
    competitor_keywords: [],
    advertiser_page_urls: [],
    publisher_platforms: [],
    media_type: 'all',
    language_codes: [],
    active_status: toAdLibraryStatusValue(adActiveStatus),
    search_mode: normalizeFacebookSearchMode(searchMode),
    rationale: 'Claude not configured; using direct Facebook ads search.',
  };

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return fallbackPlan;

  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
  const instruction = `You optimize research inputs for Meta Ad Library scraping.
Return STRICT JSON only:
{
  "query": "best primary short query",
  "related_queries": ["q1", "q2", "q3"],
  "competitor_keywords": ["brand 1", "brand 2"],
  "advertiser_page_urls": ["https://www.facebook.com/brand"],
  "publisher_platforms": ["facebook", "instagram"],
  "media_type": "all",
  "language_codes": ["en"],
  "active_status": "active",
  "search_mode": "research",
  "rationale": "one short sentence"
}

Business context:
${JSON.stringify(businessProfile || {}, null, 2)}

Target countries:
${JSON.stringify(normalizeCountryCodes(countries))}

User request:
${prompt || fallbackKeyword}

Requested search mode:
${normalizeFacebookSearchMode(searchMode)}

Rules:
- query must be concise and scraper-safe: 2-6 words
- search_mode must be one of: keyword, competitor, research
- when the user asks to find competitors, first infer the likely competitors or adjacent brands, then bias query and related_queries toward those brands and product phrases
- related_queries should be 2-5 alternate short ad-library search terms
- competitor_keywords should list 0-5 competitor or advertiser names when they are inferable from the request
- advertiser_page_urls: for each competitor_keyword where you know the official Page, include https://www.facebook.com/... profile URL so the Apify Ad Library scraper can run page-scoped pulls (this is the most reliable way to get the right creatives)
- CRITICAL: whenever competitor_keywords is non-empty, advertiser_page_urls MUST list the official facebook.com page for as many of those brands as you can confidently identify (same order or clearly paired). Keyword-only searches mix unrelated advertisers; page URLs fix that.
- omit advertiser_page_urls entries you are not confident about rather than guessing wrong domains
- publisher_platforms can only include: facebook, instagram, messenger, whatsapp, threads, audience_network
- media_type must be one of: all, image, video, memes_and_stickers
- active_status must be one of: active, inactive, all
- language_codes should be short language codes like en, fr, de when clearly implied
- never return markdown`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      temperature: 0.2,
      messages: [{ role: 'user', content: instruction }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data?.content?.map((part) => part.text).join('\n') || '';
  const parsed = extractJsonObject(text);

  if (!parsed || !parsed.query) {
    return {
      ...fallbackPlan,
      rationale: 'Claude response was not valid JSON; using direct Facebook ads search.',
    };
  }

  return {
    query: String(parsed.query).trim(),
    related_queries: dedupeStrings(Array.isArray(parsed.related_queries) ? parsed.related_queries : []).slice(0, 5),
    competitor_keywords: dedupeStrings(Array.isArray(parsed.competitor_keywords) ? parsed.competitor_keywords : []).slice(0, 5),
    advertiser_page_urls: dedupeStrings(Array.isArray(parsed.advertiser_page_urls) ? parsed.advertiser_page_urls : []).slice(0, 3),
    publisher_platforms: normalizePublisherPlatforms(parsed.publisher_platforms),
    media_type: normalizeMediaType(parsed.media_type),
    language_codes: normalizeLanguageCodes(parsed.language_codes),
    active_status: ['active', 'inactive', 'all'].includes(String(parsed.active_status || '').trim().toLowerCase())
      ? String(parsed.active_status).trim().toLowerCase()
      : toAdLibraryStatusValue(adActiveStatus),
    search_mode: normalizeFacebookSearchMode(parsed.search_mode || searchMode),
    rationale: String(parsed.rationale || 'Optimized by Claude').trim(),
  };
}

function parseMetaResponse(items = []) {
  return items.map((item, index) => ({
    id: String(item.id || item.ad_archive_id || `fb-ad-${index}`),
    kind: 'ad',
    title: item.page_name || 'Unknown Page',
    subtitle: item.page_id ? `Page ID: ${item.page_id}` : '',
    page_id: item.page_id || '',
    page_name: item.page_name || '',
    ad_snapshot_url: item.ad_snapshot_url || '',
    external_url: item.ad_snapshot_url || '',
    ad_creation_time: item.ad_creation_time || '',
    ad_delivery_start_time: item.ad_delivery_start_time || '',
    ad_delivery_stop_time: item.ad_delivery_stop_time || '',
    ad_creative_bodies: toArray(item.ad_creative_bodies),
    ad_creative_link_captions: toArray(item.ad_creative_link_captions),
    ad_creative_link_titles: toArray(item.ad_creative_link_titles),
    ad_creative_link_descriptions: toArray(item.ad_creative_link_descriptions),
    publisher_platforms: toArray(item.publisher_platforms),
    languages: toArray(item.languages),
    spend: item.spend || null,
    impressions: item.impressions || null,
    currency: item.currency || '',
    image_url: '',
    raw: item,
  }));
}

function buildFacebookResearchFacets(items = [], competitorKeywords = []) {
  const advertisers = new Map();
  const ctas = new Map();
  const platforms = new Map();
  const formats = { video: 0, image: 0, unknown: 0 };

  const competitorList = dedupeStrings(competitorKeywords || []).filter(Boolean);

  items.forEach((item) => {
    const pageId = String(item.page_id || '').trim();
    const name = String(item.page_name || item.title || '').trim() || 'Unknown advertiser';
    const mapKey = pageId || name;
    const prev = advertisers.get(mapKey);
    if (prev) {
      prev.count += 1;
      if (!prev.page_id && pageId) prev.page_id = pageId;
      if (name && name !== 'Unknown advertiser') prev.name = name;
    } else {
      advertisers.set(mapKey, { name, page_id: pageId, count: 1 });
    }

    (item.call_to_action_types || []).forEach((cta) => {
      const key = String(cta || '').trim();
      if (!key) return;
      ctas.set(key, (ctas.get(key) || 0) + 1);
    });

    (item.publisher_platforms || []).forEach((platform) => {
      const key = String(platform || '').trim().toLowerCase();
      if (!key) return;
      platforms.set(key, (platforms.get(key) || 0) + 1);
    });

    if (item.video_url) formats.video += 1;
    else if (item.image_url) formats.image += 1;
    else formats.unknown += 1;
  });

  function advertiserCompetitorBoost(label) {
    const n = normalizeBrandToken(label);
    for (const c of competitorList) {
      const t = normalizeBrandToken(c);
      if (t.length >= 2 && n.includes(t)) return 1_000_000;
    }
    return 0;
  }

  const toSortedAdvertisers = [...advertisers.entries()]
    .sort((a, b) => {
      const boostDiff = advertiserCompetitorBoost(b[1].name) - advertiserCompetitorBoost(a[1].name);
      if (boostDiff !== 0) return boostDiff;
      return b[1].count - a[1].count;
    })
    .slice(0, 24)
    .map(([, entry]) => ({
      name: entry.name,
      page_id: entry.page_id || '',
      count: entry.count,
    }));

  return {
    advertisers: toSortedAdvertisers,
    ctas: [...ctas.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([label, count]) => ({ label, count })),
    platforms: [...platforms.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([label, count]) => ({ label, count })),
    formats,
  };
}

function normalizeFacebookAdItem(item, index) {
  const mediaAssets = extractFacebookMediaAssets(item);
  const imageUrls = mediaAssets.filter((asset) => asset.type === 'image').map((asset) => asset.url);
  const videoUrls = mediaAssets.filter((asset) => asset.type === 'video').map((asset) => asset.url);
  const curiousVideos = isCuriousCoderAdLibraryRow(item) ? extractCuriousCoderVideoUrls(item) : null;
  const publisherPlatforms = normalizeApifyPublisherPlatforms(
    getByPath(item, 'publisher_platform') ||
      getByPath(item, 'publisher_platforms') ||
      arrayFromPaths(item, [
        'publisherPlatforms',
        'publisher_platforms',
        'metadata.publisherPlatforms',
        'distribution.publisherPlatforms',
      ])
  );
  const languages = arrayFromPaths(item, ['languages', 'distribution.languages']);
  const snapshotBody = pickNested(item, ['snapshot.body.text', 'snapshot.body']);
  const creativeBodies = dedupeStrings([
    ...(typeof snapshotBody === 'string' && snapshotBody.trim() ? [snapshotBody.trim()] : []),
    ...arrayFromPaths(item, [
      'primaryText',
      'adText',
      'body',
      'copy',
      'ad_creative_bodies',
      'ad_content.body',
      'creative.body',
    ]),
  ]);
  const creativeTitle = pickNested(item, [
    'snapshot.title',
    'headline',
    'title',
    'ad_content.title',
    'creative.title',
  ]);
  const snapshotCaption = pickNested(item, ['snapshot.caption', 'caption']);
  const snapshotCta = pickNested(item, ['snapshot.cta_text', 'snapshot.cta_type', 'call_to_action_type']);
  const adLibraryUrl = pickNested(item, ['ad_library_url', 'adLibraryUrl']);
  const landingUrl = pickAdExternalUrl(item);

  return {
    id: pickNested(item, [
      'ad_archive_id',
      'id',
      'adArchiveId',
      'adArchiveID',
      'adArchive.id',
      'metadata.adArchiveId',
      'metadata.adArchiveID',
    ]) || `fb-ad-${index}`,
    kind: 'ad',
    title: pickNested(item, [
      'page_name',
      'pageName',
      'snapshot.page_name',
      'metadata.pageName',
      'pageInfo.page.name',
      'page.name',
      'advertiserName',
      'advertiser',
    ]) || creativeTitle || 'Unknown advertiser',
    subtitle: pickNested(item, ['page_id', 'pageId', 'snapshot.page_id', 'metadata.pageId', 'pageInfo.page.id', 'page.id']),
    page_id: pickNested(item, ['page_id', 'pageId', 'snapshot.page_id', 'metadata.pageId', 'pageInfo.page.id', 'page.id']),
    page_name: pickNested(item, [
      'page_name',
      'pageName',
      'snapshot.page_name',
      'metadata.pageName',
      'pageInfo.page.name',
      'page.name',
      'advertiserName',
      'advertiser',
    ]),
    ad_snapshot_url: pickFirst(adLibraryUrl, pickNested(item, [
      'snapshotUrl',
      'adSnapshotUrl',
      'ad_snapshot_url',
      'ad_content.snapshotUrl',
      'creative.snapshotUrl',
    ])),
    external_url: pickFirst(landingUrl, adLibraryUrl),
    link_url: pickNested(item, ['snapshot.link_url', 'snapshot.linkUrl', 'link_url']),
    ad_creation_time: pickNested(item, [
      'start_date_formatted',
      'startDateFormatted',
      'startDate',
      'createdAt',
      'ad_creation_time',
      'timing.startDate',
      'status.adDeliveryStartTime',
    ]),
    ad_delivery_start_time: pickNested(item, [
      'start_date_formatted',
      'startDateFormatted',
      'startDate',
      'ad_delivery_start_time',
      'timing.startDate',
      'status.adDeliveryStartTime',
    ]),
    ad_delivery_stop_time: pickNested(item, [
      'end_date_formatted',
      'endDateFormatted',
      'endDate',
      'ad_delivery_stop_time',
      'timing.endDate',
      'status.adDeliveryStopTime',
    ]),
    ad_creative_bodies: creativeBodies,
    ad_creative_link_captions: dedupeStrings([
      ...(snapshotCaption ? [snapshotCaption] : []),
      ...arrayFromPaths(item, [
        'ad_creative_link_captions',
        'ad_content.cta',
        'creative.caption',
      ]),
    ]),
    ad_creative_link_titles: dedupeStrings([
      ...(creativeTitle ? [creativeTitle] : []),
      ...arrayFromPaths(item, [
        'ad_creative_link_titles',
        'ad_content.title',
        'creative.title',
      ]),
    ]),
    ad_creative_link_descriptions: arrayFromPaths(item, [
      'description',
      'ad_creative_link_descriptions',
      'ad_content.description',
      'creative.description',
      'cards.description',
    ]),
    call_to_action_types: dedupeStrings([
      ...(snapshotCta ? [snapshotCta] : []),
      ...arrayFromPaths(item, [
        'callToActionType',
        'call_to_action_type',
        'ad_content.callToActionType',
        'creative.callToActionType',
        'cards.call_to_action_type',
      ]),
    ]),
    publisher_platforms: publisherPlatforms,
    languages,
    spend: getByPath(item, 'performance.spend') || item.spend || null,
    impressions: getByPath(item, 'performance.impressions') || item.impressions || null,
    currency: pickNested(item, ['currency', 'performance.spend.currency']),
    image_url:
      curiousVideos?.preview ||
      imageUrls[0] ||
      pickFirst(
        item.image_url,
        item.imageUrl,
        item.thumbnailUrl,
        item.thumbnail_url,
        pickNested(item, ['snapshot.page_profile_picture_url', 'snapshot.url', 'snapshot.imageUrl', 'snapshot.image_url', 'creative.imageUrl'])
      ),
    video_url:
      curiousVideos?.hd ||
      curiousVideos?.sd ||
      videoUrls[0] ||
      pickFirst(
        item.video_url,
        item.videoUrl,
        item.video_hd_url,
        item.video_sd_url,
        pickNested(item, ['snapshot.videoUrl', 'snapshot.video_url', 'creative.videoUrl'])
      ),
    media_assets: mediaAssets.slice(0, 6),
    page_url: pickNested(item, ['snapshot.page_profile_uri', 'pageInfo.page.url', 'page.url']),
    display_format: pickNested(item, ['snapshot.display_format', 'display_format']),
    is_active: item.is_active === true || item.is_active === 'true',
    input_url: pickNested(item, ['inputUrl']),
    normalized_source: pickNested(item, [
      'source',
      'searchSource',
      'metadata.source',
      'rawSource',
    ]) || 'facebook_ads',
    raw: item,
  };
}

function normalizeFacebookGroupItem(item, index) {
  return {
    id: String(item.id || item.groupId || item.url || `fb-group-${index}`),
    kind: 'group',
    title: pickFirst(item.name, item.title) || 'Facebook group',
    subtitle: pickFirst(item.membersText, item.members, item.privacy, item.category),
    external_url: pickFirst(item.url, item.groupUrl),
    image_url: pickFirst(item.imageUrl, item.coverImage, item.photoUrl),
    description: pickFirst(item.description, item.about),
    members: pickFirst(item.membersText, item.members),
    privacy: pickFirst(item.privacy),
    activity: pickFirst(item.postFrequency, item.activity),
    raw: item,
  };
}

function normalizeFacebookFollowItem(item, index) {
  return {
    id: String(item.id || item.profileId || item.url || `fb-follow-${index}`),
    kind: 'profile',
    title: pickFirst(item.title, item.name) || 'Facebook profile',
    subtitle: pickFirst(item.subtitle, item.followType, item.type),
    external_url: pickFirst(item.url, item.profileUrl),
    image_url: pickFirst(item.image, item.imageUrl, item.avatar),
    follow_type: pickFirst(item.followType, item.type),
    raw: item,
  };
}

async function runApifyActor(actorId, runInput, datasetLimit) {
  if (!process.env.APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN is not configured');
  }

  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const run = await client.actor(actorId).call(runInput);
  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    limit: clamp(datasetLimit, 1, 500, 100),
  });
  const safe = Array.isArray(items) ? items : [];
  const inputUrls = runInput?.urls || runInput?.startUrls;
  const inputUrlPreview =
    Array.isArray(inputUrls) && inputUrls.length
      ? String(inputUrls[0]?.url ?? inputUrls[0] ?? '').slice(0, 160)
      : '';
  console.log('[Apify] dataset response', {
    actorId,
    runId: run?.id,
    datasetId: run?.defaultDatasetId,
    itemCount: safe.length,
    inputUrlPreview: inputUrlPreview || undefined,
  });
  if (safe[0]) {
    try {
      const preview = JSON.stringify(safe[0]);
      const max = 14000;
      console.log(
        '[Apify] first raw item (truncated)',
        preview.length > max ? `${preview.slice(0, max)}… (${preview.length} chars)` : preview
      );
    } catch (e) {
      console.log('[Apify] first raw item: could not JSON.stringify', e?.message || e);
    }
  }
  if (process.env.APIFY_DEBUG_LOGS === '1' && safe[1]) {
    console.log('[Apify] second raw item', safe[1]);
  }
  return safe;
}

async function searchMetaGraphAds({ keyword, countries, limit, adType, adActiveStatus }) {
  const accessToken = process.env.META_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('META_ACCESS_TOKEN is not configured');
  }

  const graphVersion = process.env.META_GRAPH_VERSION || 'v22.0';
  const endpoint = `https://graph.facebook.com/${graphVersion}/ads_archive`;
  const params = new URLSearchParams({
    access_token: accessToken,
    search_terms: String(keyword).trim(),
    ad_type: String(adType || 'ALL'),
    ad_active_status: String(adActiveStatus || 'ALL'),
    ad_reached_countries: JSON.stringify(normalizeCountryCodes(countries)),
    fields: [
      'id',
      'page_id',
      'page_name',
      'ad_snapshot_url',
      'ad_creation_time',
      'ad_delivery_start_time',
      'ad_delivery_stop_time',
      'ad_creative_bodies',
      'ad_creative_link_captions',
      'ad_creative_link_titles',
      'ad_creative_link_descriptions',
      'publisher_platforms',
      'languages',
      'spend',
      'impressions',
      'currency',
    ].join(','),
    limit: String(clamp(limit, 1, 100, 20)),
  });

  const response = await fetch(`${endpoint}?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `Meta request failed with status ${response.status}`);
  }

  return {
    source: 'meta_api',
    results: parseMetaResponse(Array.isArray(data?.data) ? data.data : []),
    paging: data?.paging || null,
  };
}

async function searchFacebookApifyAds({
  keyword,
  countries,
  limit,
  adType = 'ALL',
  adActiveStatus = 'ALL',
  urls = [],
  pageUrls = [],
  relatedQueries = [],
  publisherPlatforms = [],
  mediaType = 'all',
  languageCodes = [],
  actorId,
}) {
  const resolvedActorId = String(actorId || DEFAULT_FACEBOOK_ADS_ACTOR_ID).trim() || DEFAULT_FACEBOOK_ADS_ACTOR_ID;
  const targets = buildSearchTargets({
    keyword,
    countries,
    adType,
    adActiveStatus,
    explicitUrls: urls,
    explicitPageUrls: pageUrls,
    relatedQueries,
    publisherPlatforms,
    mediaType,
    languageCodes,
  });

  if (!targets.length) {
    throw new Error('No valid Facebook page URLs or Meta Ad Library URLs could be built from the search input.');
  }

  const perTargetLimit = Math.max(6, Math.ceil(clamp(limit, 1, 100, 20) / Math.max(targets.length, 1)));
  const runInput = isCuriousCoderFacebookAdLibraryActor(resolvedActorId)
    ? createCuriousCoderAdLibraryInput({
        targets,
        limit,
        adActiveStatus,
        countries,
      })
    : createActorInput({
        targets,
        limit: perTargetLimit,
        adActiveStatus,
        countries,
      });

  const datasetLimit = isCuriousCoderFacebookAdLibraryActor(resolvedActorId)
    ? clamp(limit, 1, 500, 100)
    : Math.min(clamp(limit, 1, 100, 20) * Math.max(targets.length, 1), 200);

  const items = await runApifyActor(resolvedActorId, runInput, datasetLimit);

  const normalizedResults = items
    .map(normalizeFacebookAdItem)
    .filter((item) => item.id && (item.page_name || item.ad_creative_bodies.length || item.ad_snapshot_url));

  const dedupedResults = [];
  const seen = new Set();
  for (const item of normalizedResults) {
    const key = item.id || item.ad_snapshot_url || item.external_url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    dedupedResults.push(item);
    if (dedupedResults.length >= clamp(limit, 1, 100, 20)) break;
  }

  const facets = buildFacebookResearchFacets(dedupedResults, []);
  const topAdvertisers = facets.advertisers.slice(0, 6);

  return {
    source: 'apify_meta_ads',
    actorId: resolvedActorId,
    targets,
    query: keyword,
    advertiser_id: '',
    task_runs: [],
    results: dedupedResults,
    research_summary: {
      total_ads: dedupedResults.length,
      advertiser_count: topAdvertisers.length,
      top_advertisers: topAdvertisers,
      task_count: 1,
      discarded_low_relevance: 0,
    },
    facets,
  };
}

async function searchFacebookGroups({ keyword, limit }) {
  const actorId = process.env.APIFY_FACEBOOK_GROUPS_ACTOR || 'easyapi/facebook-groups-search-scraper';
  const runInput = {
    searchStringsArray: [String(keyword).trim()],
    maxItems: clamp(limit, 1, 100, 20),
  };

  const items = await runApifyActor(actorId, runInput, limit);
  return {
    source: 'apify_groups',
    actorId,
    results: items.map(normalizeFacebookGroupItem),
  };
}

async function searchFacebookFollowersFollowing({ keyword, limit }) {
  const actorId =
    process.env.APIFY_FACEBOOK_FOLLOWERS_ACTOR || 'apify/facebook-followers-following-scraper';
  const targetUrl = String(keyword).trim();
  const runInput = {
    startUrls: [{ url: targetUrl }],
    maxItems: clamp(limit, 1, 100, 20),
  };

  const items = await runApifyActor(actorId, runInput, limit);
  return {
    source: 'apify_followers_following',
    actorId,
    results: items.map(normalizeFacebookFollowItem),
  };
}

async function searchFacebookAds(req, res) {
  try {
    const {
      keyword = '',
      countries = ['US'],
      limit = 40,
      adType = 'ALL',
      adActiveStatus = 'ALL',
      source = 'apify_meta_ads',
      urls = [],
      pageUrls = [],
      searchMode = 'keyword',
      advertiserPageId = '',
      competitorDeepDive = false,
    } = req.body || {};

    const trimmedKeyword = String(keyword).trim();
    const trimmedAdvertiserPageId = String(advertiserPageId || '').trim();
    const mergedPageUrls = dedupeStrings([
      ...(Array.isArray(pageUrls) ? pageUrls : []),
      ...(trimmedAdvertiserPageId ? [trimmedAdvertiserPageId] : []),
    ]);
    const hasDirectTargets =
      (Array.isArray(urls) && urls.length > 0) || mergedPageUrls.length > 0;
    if (!trimmedKeyword && !hasDirectTargets) {
      return res.status(400).json({ error: 'keyword, urls, or pageUrls is required' });
    }

    const adLibrarySource = source === 'metapi_ads' ? 'apify_meta_ads' : source;
    if (adLibrarySource === 'apify_meta_ads') {
      return res.json(
        await searchFacebookApifyAds({
          keyword: trimmedKeyword,
          countries,
          limit,
          adType,
          adActiveStatus,
          urls,
          pageUrls: mergedPageUrls,
          relatedQueries: [],
          publisherPlatforms: [],
          mediaType: 'all',
          languageCodes: [],
        })
      );
    }

    if (source === 'apify_groups') {
      return res.json(await searchFacebookGroups({ keyword: trimmedKeyword, limit }));
    }

    if (source === 'apify_followers_following') {
      return res.json(await searchFacebookFollowersFollowing({ keyword: trimmedKeyword, limit }));
    }

    if (source === 'meta_api') {
      return res.json(
        await searchMetaGraphAds({ keyword: trimmedKeyword, countries, limit, adType, adActiveStatus })
      );
    }

    return res.status(400).json({ error: `Unsupported Facebook source: ${source}` });
  } catch (error) {
    console.error('searchFacebookAds error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch Facebook data' });
  }
}

async function intelligentSearchFacebookAds(req, res) {
  try {
    const {
      prompt = '',
      keyword = '',
      countries = ['US'],
      limit = 40,
      adType = 'ALL',
      adActiveStatus = 'ALL',
      source = 'apify_meta_ads',
      businessProfile = {},
      searchMode = 'research',
    } = req.body || {};

    const seed = String(keyword || prompt).trim();
    if (!seed) {
      return res.status(400).json({ error: 'prompt or keyword is required' });
    }

    const plan = await planFacebookAdsSearch({
      prompt: String(prompt).trim(),
      fallbackKeyword: seed,
      businessProfile,
      countries,
      adActiveStatus,
      searchMode,
    });
    const competitorLedQueries = dedupeStrings([
      ...(plan.competitor_keywords || []),
      ...(plan.related_queries || []),
    ]).slice(0, 5);

    const adLibrarySource = source === 'metapi_ads' ? 'apify_meta_ads' : source;
    if (adLibrarySource !== 'apify_meta_ads' && adLibrarySource !== 'meta_api') {
      return res.status(400).json({ error: `Intelligent search is not supported for source: ${source}` });
    }

    if (adLibrarySource === 'meta_api') {
      const data = await searchMetaGraphAds({
        keyword: plan.query || competitorLedQueries[0] || seed,
        countries,
        limit,
        adType,
        adActiveStatus: plan.active_status || adActiveStatus,
      });

      return res.json({
        plan,
        ...data,
      });
    }

    const data = await searchFacebookApifyAds({
      keyword: plan.query || competitorLedQueries[0] || seed,
      countries,
      limit,
      adType,
      adActiveStatus: plan.active_status || adActiveStatus,
      urls: [],
      pageUrls: plan.advertiser_page_urls || [],
      relatedQueries: competitorLedQueries,
      publisherPlatforms: plan.publisher_platforms || [],
      mediaType: plan.media_type || 'all',
      languageCodes: plan.language_codes || [],
    });

    return res.json({
      plan: {
        ...plan,
        execution_mode: 'apify_ad_library',
        target_urls: [],
        resolved_query: data.query || plan.query || competitorLedQueries[0] || seed,
        resolved_advertiser_id: data.advertiser_id || '',
        task_runs: data.task_runs || [],
      },
      ...data,
    });
  } catch (error) {
    console.error('intelligentSearchFacebookAds error:', error);
    return res.status(500).json({ error: error.message || 'Failed to run intelligent Facebook search' });
  }
}

module.exports = { searchFacebookAds, intelligentSearchFacebookAds };
