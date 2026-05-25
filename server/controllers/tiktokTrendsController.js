const { ApifyClient } = require('apify-client');
const { toUserFacingError } = require('../utils/userFacingError');

const TIKTOK_TRENDS_ACTOR_ID =
  process.env.APIFY_TIKTOK_TRENDS_ACTOR || 'clockworks/tiktok-trends-scraper';

const VALID_CATEGORIES = new Set(['hashtags', 'sounds', 'creators', 'videos']);
const VALID_TIME_RANGES = new Set(['7', '30', '120']);
const VALID_VIDEO_SORT = new Set(['vv', 'like', 'comment', 'repost']);
const VALID_CREATOR_SORT = new Set(['follower', 'engagement', 'avg_views']);

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
  }
  return '';
}

function extractTrendThumbnail(item, category) {
  const common = [
    item.coverUrl,
    item.cover_url,
    item.cover,
    item.thumbnail,
    item.thumbnailUrl,
    item.thumbnail_url,
    item.imgUrl,
    item.imageUrl,
    item.image,
    item.poster,
    item.posterUrl,
    pickNested(item, ['cover.url', 'coverUrl', 'thumbnail.url', 'image.url', 'music.cover']),
  ];

  if (category === 'sounds') {
    return pickFirst(
      ...common,
      item.musicCover,
      item.music_cover,
      item.albumCover,
      item.album_cover,
      item.soundCover,
      item.sound_cover,
      item.audioCover,
      item.avatarUrl,
      item.avatar_url,
      item.avatar,
      pickNested(item, ['music.coverUrl', 'music.cover', 'sound.coverUrl', 'author.avatarUrl'])
    );
  }

  if (category === 'hashtags') {
    return pickFirst(
      ...common,
      item.hashtagCover,
      item.hashtag_cover,
      pickNested(item, ['hashtag.coverUrl', 'hashtag.cover'])
    );
  }

  return pickFirst(...common, item.avatarUrl, item.avatar_url, item.avatar);
}

function normalizeTrendItem(item, index, category) {
  const name = pickFirst(
    item.name,
    item.hashtagName,
    item.soundName,
    item.musicName,
    item.creatorName,
    item.authorName,
    item.videoTitle,
    item.title
  );

  const url = pickFirst(item.url, item.link, item.webVideoUrl, item.videoUrl, item.profileUrl);

  return {
    id: pickFirst(item.id, item.hashtagId, item.soundId, item.creatorId) || `${category}-${index}`,
    type: category,
    rank: Number(item.rank || item.ranking || index + 1) || index + 1,
    name: String(name || 'Untitled'),
    url: String(url || ''),
    countryCode: pickFirst(item.countryCode, item.country_code, item.adsCountryCode) || '',
    views: Number(item.viewCount || item.views || item.totalViews || 0) || 0,
    avgViews:
      Number(
        item.avgViewCount ||
          item.avgViews ||
          item.avg_views ||
          item.averageViews ||
          item.averageViewCount ||
          0
      ) || 0,
    likes: Number(item.likeCount || item.likes || item.diggCount || 0) || 0,
    videoCount: Number(item.videoCount || item.videosCount || 0) || 0,
    followers: Number(item.followerCount || item.followers || 0) || 0,
    engagementRate: Number(item.engagementRate || item.engagement_rate || 0) || 0,
    industryName: pickFirst(item.industryName, item.industry_name) || '',
    soundName: pickFirst(item.soundName, item.musicName, item.sound_name) || '',
    authorName: pickFirst(item.authorName, item.creatorName, item.author, item.creator) || '',
    rankDiff: Number(item.rankDiff ?? item.rank_diff ?? 0) || 0,
    markedAsNew: Boolean(item.markedAsNew ?? item.marked_as_new),
    isPromoted: Boolean(item.isPromoted ?? item.is_promoted),
    durationSec: Number(item.duration || item.durationSec || 0) || 0,
    thumbnail: extractTrendThumbnail(item, category),
  };
}

function buildTrendsActorInput({
  category,
  country,
  limit,
  timeRange,
  industry,
  videoSort,
  creatorSort,
  followerBand,
}) {
  const resultsPerPage = Math.min(Math.max(Number(limit) || 48, 1), 100);
  const countryCode = String(country || 'US').trim().toUpperCase() || 'US';

  const input = {
    resultsPerPage,
    adsScrapeHashtags: false,
    adsScrapeSounds: false,
    adsScrapeCreators: false,
    adsScrapeVideos: false,
  };

  if (category === 'hashtags') {
    input.adsScrapeHashtags = true;
    input.adsCountryCode = countryCode;
    input.adsTimeRange = VALID_TIME_RANGES.has(String(timeRange)) ? String(timeRange) : '7';
    if (industry) input.adsHashtagIndustry = String(industry).trim();
  } else if (category === 'sounds') {
    input.adsScrapeSounds = true;
    input.adsSoundsCountryCode = countryCode;
    input.adsRankType = 'popular';
  } else if (category === 'creators') {
    input.adsScrapeCreators = true;
    input.adsCreatorsCountryCode = countryCode;
    input.adsSortCreatorsBy = VALID_CREATOR_SORT.has(String(creatorSort))
      ? String(creatorSort)
      : 'follower';
    const band = String(followerBand || '').trim();
    if (['1', '2', '3', '4'].includes(band)) {
      input.adsFollowers = band;
    }
  } else if (category === 'videos') {
    input.adsScrapeVideos = true;
    input.adsVideosCountryCode = countryCode;
    input.adsSortVideosBy = VALID_VIDEO_SORT.has(String(videoSort)) ? String(videoSort) : 'vv';
  }

  return input;
}

async function runTrendsActor(input, limit) {
  if (!process.env.APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN is not configured');
  }

  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const run = await client.actor(TIKTOK_TRENDS_ACTOR_ID).call(input);
  const maxItems = Math.min(Math.max(Number(limit) || 48, 1), 100);
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: maxItems });
  const list = Array.isArray(items) ? items : [];

  return {
    items: list,
    runStatus: run.status,
    itemCount: list.length,
  };
}

async function fetchTikTokHotTakes(req, res) {
  try {
    const {
      country = 'US',
      category = 'hashtags',
      limit = 48,
      timeRange = '7',
      industry = '',
      videoSort = 'vv',
      creatorSort = 'follower',
      followerBand = '',
    } = req.body || {};

    const normalizedCategory = String(category || 'hashtags').trim().toLowerCase();
    if (!VALID_CATEGORIES.has(normalizedCategory)) {
      return res.status(400).json({
        error: 'category must be one of: hashtags, sounds, creators, videos',
      });
    }

    const actorInput = buildTrendsActorInput({
      category: normalizedCategory,
      country,
      limit,
      timeRange,
      industry,
      videoSort,
      creatorSort,
      followerBand,
    });

    const { items: rawItems } = await runTrendsActor(actorInput, limit);
    const items = rawItems.map((item, index) =>
      normalizeTrendItem(item, index, normalizedCategory)
    );

    return res.json({
      source: 'tiktok_creative_center',
      actor: TIKTOK_TRENDS_ACTOR_ID,
      category: normalizedCategory,
      country: String(country || 'US').trim().toUpperCase(),
      timeRange: actorInput.adsTimeRange || null,
      videoSort: actorInput.adsSortVideosBy || null,
      creatorSort: actorInput.adsSortCreatorsBy || null,
      count: items.length,
      items,
      note:
        'Trends come from TikTok Creative Center (advertiser/market view), not your personalized For You feed.',
    });
  } catch (error) {
    console.error('fetchTikTokHotTakes error:', error);
    return res.status(500).json({
      error: toUserFacingError(error.message, 'Trend data is temporarily unavailable. Please try again in a few minutes.'),
    });
  }
}

module.exports = {
  fetchTikTokHotTakes,
  buildTrendsActorInput,
  normalizeTrendItem,
  runTrendsActor,
  TIKTOK_TRENDS_ACTOR_ID,
};
