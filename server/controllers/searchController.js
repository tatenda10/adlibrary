const { ApifyClient } = require('apify-client');
const { Readable } = require('node:stream');
const pool = require('../db/connection');
const { ensureUser } = require('../utils/users');

const TIKTOK_DISCOVERY_ACTOR_ID = process.env.APIFY_TIKTOK_ACTOR || 'clockworks/tiktok-scraper';
const TIKTOK_PROFILE_ACTOR_ID =
  process.env.APIFY_TIKTOK_PROFILE_ACTOR || 'clockworks/tiktok-profile-scraper';

function pickFirst(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
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

function isApifyArtifactUrl(value = '') {
  const url = String(value || '').toLowerCase();
  return url.includes('api.apify.com/v2/key-value-stores/') || url.includes('/records/video-');
}

function pickPlayableUrl(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (isApifyArtifactUrl(trimmed)) continue;
    return trimmed;
  }
  return '';
}

function extractSourceStreamUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (isApifyArtifactUrl(raw)) return '';

  try {
    const parsed = new URL(raw);
    if (!parsed.pathname.endsWith('/api/search/stream')) {
      return isApifyArtifactUrl(raw) ? '' : raw;
    }

    const nested = parsed.searchParams.get('url');
    if (typeof nested !== 'string' || !nested.trim()) return '';
    return isApifyArtifactUrl(nested) ? '' : nested.trim();
  } catch {
    return isApifyArtifactUrl(raw) ? '' : raw;
  }
}

function isPublicTikTokUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (isApifyArtifactUrl(raw)) return false;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    return host.includes('tiktok.com');
  } catch {
    return false;
  }
}

function pickPublicTikTokUrl(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (!isPublicTikTokUrl(trimmed)) continue;
    return trimmed;
  }
  return '';
}

function sanitizeTikTokProfileSeed(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (raw.startsWith('@')) {
    return raw.slice(1);
  }

  try {
    const parsed = new URL(raw);
    if (!parsed.hostname.toLowerCase().includes('tiktok.com')) return '';
    const parts = parsed.pathname.split('/').filter(Boolean);
    const handleIndex = parts.findIndex((part) => part.startsWith('@'));
    if (handleIndex >= 0) {
      return parts[handleIndex].replace(/^@/, '').trim();
    }
    return '';
  } catch {
    if (/^[a-zA-Z0-9._-]+$/.test(raw)) return raw.replace(/^@/, '');
    return '';
  }
}

function extractTranscript(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return pickFirst(item.text, item.caption, item.content, item.subtitle);
        }
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (typeof value === 'object') {
    return pickFirst(value.text, value.caption, value.content, value.subtitle).trim();
  }

  return '';
}

function summarizeTikTokSource({ discoveryKeyword = '', profileUsername = '', sourceStage = '' } = {}) {
  const parts = [];
  if (discoveryKeyword) parts.push(`Discovery keyword: ${discoveryKeyword}`);
  if (profileUsername) parts.push(`Profile seed: ${profileUsername}`);
  if (sourceStage) parts.push(`Source stage: ${sourceStage}`);
  return parts.join(' | ');
}

function normalizeTikTokItem(item, index, context = {}) {
  const subtitleText =
    extractTranscript(item.subtitleText) ||
    extractTranscript(item.subtitlesText) ||
    extractTranscript(item.subtitles) ||
    extractTranscript(item.captions) ||
    extractTranscript(item.subtitle) ||
    extractTranscript(item.videoMeta?.subtitle) ||
    extractTranscript(item.videoMeta?.subtitles);

  const thumbnail = pickFirst(
    item.thumbnail,
    item.cover,
    item.covers?.default,
    item.covers?.origin,
    item.videoMeta?.coverUrl,
    item.videoMeta?.originCover,
    item.videoMeta?.dynamicCover,
    item.authorMeta?.avatar
  );

  const videoStreamUrl = pickPlayableUrl(
    item.videoMeta?.downloadAddr,
    item.videoMeta?.playAddr,
    item.videoMeta?.playAddrH264,
    item.videoMeta?.playAddrBytevc1,
    item.mediaUrls?.[0],
    item.video?.playAddr,
    item.video?.downloadAddr,
    item.play_addr?.url_list?.[0],
    item.download_addr?.url_list?.[0]
  );

  const profileUrl = pickPublicTikTokUrl(
    pickNested(item, [
      'authorMeta.profileUrl',
      'authorMeta.url',
      'authorMeta.authorUrl',
      'author.url',
      'author.profileUrl',
      'authorUrl',
      'profileUrl',
      'profile.url',
    ])
  );

  const profileUsername =
    sanitizeTikTokProfileSeed(profileUrl) ||
    sanitizeTikTokProfileSeed(
      pickNested(item, [
        'authorMeta.uniqueId',
        'authorMeta.userName',
        'authorMeta.user_name',
        'author.uniqueId',
        'author.userName',
        'author.username',
        'author.name',
        'author',
        'profile.username',
      ])
    ) ||
    sanitizeTikTokProfileSeed(context.profileUsername);

  const resolvedTikTokUrl = pickPublicTikTokUrl(item.webVideoUrl, item.url, item.shareUrl);
  const sourceStage = String(context.sourceStage || '').trim() || 'discovery';
  const discoveryKeyword = String(context.discoveryKeyword || '').trim();
  const sourceContext = summarizeTikTokSource({
    discoveryKeyword,
    profileUsername,
    sourceStage,
  });

  return {
    id: item.id || item.input || `tiktok-${index}`,
    url: resolvedTikTokUrl,
    tiktok_url: resolvedTikTokUrl,
    thumbnail,
    source_video_stream_url: videoStreamUrl,
    video_stream_url: videoStreamUrl,
    caption: item.text || item.caption || item.desc || '',
    author: item.authorMeta?.name || item.author?.name || item.author || '',
    profile_username: profileUsername,
    profile_url: profileUrl,
    views: item.playCount || item.stats?.playCount || 0,
    likes: item.diggCount || item.stats?.diggCount || 0,
    shares: item.shareCount || item.stats?.shareCount || 0,
    comments: item.commentCount || item.stats?.commentCount || 0,
    transcript: subtitleText,
    discovery_keyword: discoveryKeyword,
    source_stage: sourceStage,
    source_context: sourceContext,
  };
}

async function runTikTokActor(actorId, input, limit) {
  if (!process.env.APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN is not configured');
  }

  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const run = await client.actor(actorId).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    limit: Math.min(Number(limit) || 20, 50),
  });
  return Array.isArray(items) ? items : [];
}

async function fetchTikTokDiscoveryResults(keyword, limit) {
  const maxItems = Math.min(Number(limit) || 20, 50);
  const input = {
    searchQueries: [String(keyword).trim()],
    resultsPerPage: maxItems,
    shouldDownloadVideos: true,
    shouldDownloadCovers: true,
    shouldDownloadSubtitles: true,
    maxItems,
  };

  const items = await runTikTokActor(TIKTOK_DISCOVERY_ACTOR_ID, input, maxItems);
  return items.map((item, index) =>
    normalizeTikTokItem(item, index, {
      sourceStage: 'keyword_discovery',
      discoveryKeyword: String(keyword || '').trim(),
    })
  );
}

function collectProfileSeeds(discoveryResults = [], maxProfiles = 6) {
  const seeds = [];
  const seen = new Set();

  for (const item of discoveryResults) {
    const seed = sanitizeTikTokProfileSeed(item.profile_username || item.profile_url || item.author || '');
    if (!seed || seen.has(seed)) continue;
    seen.add(seed);
    seeds.push(seed);
    if (seeds.length >= maxProfiles) break;
  }

  return seeds;
}

async function fetchTikTokProfileVideos(profileSeeds = [], limit = 20, discoveryKeyword = '') {
  const profiles = Array.isArray(profileSeeds)
    ? profileSeeds.map((value) => sanitizeTikTokProfileSeed(value)).filter(Boolean)
    : [];

  if (!profiles.length) return [];

  const maxItems = Math.min(Number(limit) || 20, 50);
  const perProfileLimit = Math.max(3, Math.ceil(maxItems / profiles.length));
  const input = {
    profiles: profiles.slice(0, 6),
    profileScrapeSections: ['videos'],
    shouldDownloadVideos: true,
    shouldDownloadCovers: true,
    shouldDownloadSubtitles: true,
    resultsPerPage: perProfileLimit,
  };

  const items = await runTikTokActor(TIKTOK_PROFILE_ACTOR_ID, input, Math.max(maxItems * 2, 24));
  const results = [];
  const seenUrls = new Set();

  items.forEach((item, index) => {
    const normalized = normalizeTikTokItem(item, index, {
      sourceStage: 'profile_expansion',
      discoveryKeyword,
      profileUsername:
        sanitizeTikTokProfileSeed(
          pickNested(item, [
            'authorMeta.uniqueId',
            'author.uniqueId',
            'author.userName',
            'author.username',
            'author.name',
          ])
        ) || '',
    });

    const key = normalized.tiktok_url || normalized.id;
    if (!key || seenUrls.has(key)) return;
    seenUrls.add(key);
    results.push(normalized);
  });

  return results.slice(0, maxItems);
}

async function fetchTikTokResults(keyword, limit, options = {}) {
  const queriesInput = Array.isArray(keyword) ? keyword : [keyword];
  const searchOptions = normalizeTikTokSearchOptions(options);
  const queries = buildDiscoveryQueries(queriesInput, searchOptions).slice(0, 4);
  const perQueryLimit = Math.min(
    Math.max(Math.ceil((Number(limit) || 20) / Math.max(queries.length, 1)) + 4, 8),
    20
  );
  const discoveryRuns = await Promise.all(
    queries.map(async (query) => ({
      query,
      items: await fetchTikTokDiscoveryResults(query, perQueryLimit),
    }))
  );

  const discoveryResults = [];
  const seenDiscovery = new Set();

  discoveryRuns.forEach(({ items }) => {
    items.forEach((item) => {
      const key = item.tiktok_url || item.url || item.id;
      if (!key || seenDiscovery.has(key)) return;
      seenDiscovery.add(key);
      discoveryResults.push(item);
    });
  });

  const profileSeeds = collectProfileSeeds(discoveryResults);
  let profileExpandedResults = [];
  let profileExpansionWarning = '';

  try {
    profileExpandedResults = await fetchTikTokProfileVideos(
      profileSeeds,
      limit,
      queries[0] || String(keyword || '').trim()
    );
  } catch (error) {
    profileExpansionWarning = error?.message || 'Profile expansion failed';
    console.warn('TikTok profile expansion fallback:', profileExpansionWarning);
  }

  const combinedResults = profileExpandedResults.length
    ? [...profileExpandedResults, ...discoveryResults]
    : discoveryResults;
  const rankedResults = rankTikTokResults(combinedResults, {
    prompt: options.prompt,
    queries,
    businessProfile: options.businessProfile || {},
    ...searchOptions,
  });
  const filteredResults = filterTikTokResults(rankedResults, searchOptions);
  const results = filteredResults.slice(0, Math.min(Number(limit) || 20, 50));

  return {
    plan: {
      mode: 'keyword_to_profiles',
      query: queries[0] || String(keyword || '').trim(),
      queries,
      filters_applied: searchOptions,
      profile_seeds: profileSeeds,
      discovery_count: discoveryResults.length,
      profile_result_count: profileExpandedResults.length,
      filtered_result_count: filteredResults.length,
      profile_expansion_warning: profileExpansionWarning,
      rationale: profileExpandedResults.length
        ? 'Multi-angle discovery identified creator profiles, then profile expansion collected more reliable video URLs for analysis.'
        : profileExpansionWarning
          ? 'Discovery succeeded, but profile expansion fell back to ranked discovery results.'
          : 'Discovery did not yield reusable profile seeds, so ranked discovery results were returned directly.',
    },
    results,
  };
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanSearchFragment(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearchTerms(value = '') {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'at', 'be', 'for', 'from', 'how', 'i', 'in', 'into', 'is', 'it',
    'me', 'my', 'of', 'on', 'or', 'our', 'show', 'that', 'the', 'this', 'to', 'us', 'want',
    'we', 'what', 'with', 'you', 'your',
  ]);

  return cleanSearchFragment(value)
    .split(' ')
    .filter((term) => term.length >= 3 && !stopWords.has(term));
}

function buildPhrase(tokens = [], maxWords = 4) {
  return tokens.slice(0, maxWords).join(' ').trim();
}

function normalizeSearchNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeTikTokSearchOptions(raw = {}) {
  return {
    minViews: normalizeSearchNumber(raw.minViews),
    minLikes: normalizeSearchNumber(raw.minLikes),
    hookContains: cleanSearchFragment(raw.hookContains),
    hookMode: Boolean(raw.hookMode),
  };
}

function uniqueQueries(values = [], maxItems = 5) {
  const seen = new Set();
  const output = [];

  values.forEach((value) => {
    const cleaned = cleanSearchFragment(value);
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    output.push(cleaned);
  });

  return output.slice(0, maxItems);
}

function getOpeningHookText(item = {}) {
  const transcript = String(item.transcript || '').trim();
  const caption = String(item.caption || '').trim();
  const source = transcript || caption;
  if (!source) return '';
  return cleanSearchFragment(source.split(/[.!?\n]/)[0] || source).slice(0, 180);
}

function buildDiscoveryQueries(baseQueries = [], options = {}) {
  const normalizedOptions = normalizeTikTokSearchOptions(options);
  const hookTerms = tokenizeSearchTerms(normalizedOptions.hookContains).join(' ');
  const base = uniqueQueries(baseQueries, 5);

  if (!hookTerms) return base;

  const queryVariants = [];
  base.forEach((query) => {
    queryVariants.push(query);
    queryVariants.push(`${query} ${hookTerms}`);
    if (normalizedOptions.hookMode) {
      queryVariants.push(`${query} hook ${hookTerms}`);
      queryVariants.push(`${hookTerms} tiktok hook`);
      queryVariants.push(`${hookTerms} ugc`);
    }
  });

  return uniqueQueries(queryVariants, 5);
}

function filterTikTokResults(results = [], options = {}) {
  const normalizedOptions = normalizeTikTokSearchOptions(options);
  const hookNeedle = normalizedOptions.hookContains;

  return results.filter((item) => {
    if (normalizedOptions.minViews && Number(item.views || 0) < normalizedOptions.minViews) {
      return false;
    }

    if (normalizedOptions.minLikes && Number(item.likes || 0) < normalizedOptions.minLikes) {
      return false;
    }

    if (hookNeedle) {
      const haystack = cleanSearchFragment([
        item.caption,
        item.transcript,
      ].filter(Boolean).join(' '));
      if (!haystack.includes(hookNeedle)) {
        return false;
      }
    }

    return true;
  });
}

function buildHeuristicTikTokPlan({ prompt, fallbackKeyword, businessProfile }) {
  const combinedText = [
    prompt,
    fallbackKeyword,
    businessProfile?.product_name,
    businessProfile?.product,
    businessProfile?.offer,
    businessProfile?.niche,
    businessProfile?.audience,
    businessProfile?.target_audience,
    businessProfile?.pain_points,
    businessProfile?.benefits,
  ]
    .filter(Boolean)
    .join(' ');

  const tokens = tokenizeSearchTerms(combinedText);
  const primary = buildPhrase(tokens, 4) || cleanSearchFragment(fallbackKeyword) || 'tiktok ads';
  const secondary = buildPhrase(tokens.slice(1), 4) || primary;
  const queries = uniqueQueries([
    primary,
    `${primary} ad`,
    `${primary} tiktok`,
    `${secondary} ugc`,
    `${secondary} problem solution`,
  ]);

  return {
    query: queries[0] || cleanSearchFragment(fallbackKeyword) || fallbackKeyword,
    related_queries: queries.slice(1),
    rationale: 'Used product, audience, and pain-point terms to build several TikTok research angles.',
  };
}

function rankTikTokResults(
  results = [],
  { prompt = '', queries = [], businessProfile = {}, minViews = 0, minLikes = 0, hookContains = '', hookMode = false } = {}
) {
  const searchOptions = normalizeTikTokSearchOptions({ minViews, minLikes, hookContains, hookMode });
  const rankingTerms = uniqueQueries([
    prompt,
    ...queries,
    businessProfile?.product_name,
    businessProfile?.product,
    businessProfile?.offer,
    businessProfile?.niche,
    businessProfile?.audience,
    businessProfile?.target_audience,
    businessProfile?.pain_points,
    businessProfile?.benefits,
  ]).flatMap((value) => tokenizeSearchTerms(value));

  if (!rankingTerms.length) return results;

  return [...results]
    .map((item, index) => {
      const haystack = cleanSearchFragment([
        item.caption,
        item.transcript,
        item.author,
        item.discovery_keyword,
        item.source_context,
      ].filter(Boolean).join(' '));
      const openingHook = getOpeningHookText(item);

      let score = 0;
      rankingTerms.forEach((term) => {
        if (haystack.includes(term)) score += term.length >= 6 ? 4 : 2;
        if (searchOptions.hookMode && openingHook.includes(term)) score += term.length >= 6 ? 6 : 3;
      });

      if (item.source_stage === 'profile_expansion') score += 3;
      if (item.views) score += Math.min(6, Math.log10(Number(item.views) + 1));
      if (item.likes) score += Math.min(4, Math.log10(Number(item.likes) + 1));

      return { item, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

async function planSearchWithClaude({ prompt, fallbackKeyword, businessProfile, searchOptions = {} }) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return {
      ...buildHeuristicTikTokPlan({
        prompt: `${prompt} ${searchOptions.hookContains || ''}`.trim(),
        fallbackKeyword,
        businessProfile,
      }),
      rationale: 'CLAUDE_API_KEY not configured; using local search planning.',
    };
  }

  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

  const instruction = `You optimize search queries for TikTok ad research.
Return STRICT JSON only:
{
  "query": "best single short query",
  "related_queries": ["q1", "q2", "q3"],
  "rationale": "one short sentence"
}

Business context:\n${JSON.stringify(businessProfile || {}, null, 2)}
Search preferences:\n${JSON.stringify(normalizeTikTokSearchOptions(searchOptions), null, 2)}
User request:\n${prompt || fallbackKeyword}

Rules:
- Query must be concise (2-6 words)
- Focus on buyer intent, ad angles, hooks, creatives, UGC style, problems, and outcomes
- Avoid broad generic terms unless the user request is generic
- related_queries should explore different angles, not near-duplicates
- Do not include markdown`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        temperature: 0.2,
        messages: [{ role: 'user', content: instruction }],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data?.content?.map((part) => part.text).join('\n') || '';
      const parsed = extractJsonObject(text);

      if (!parsed || !parsed.query) {
        break;
      }

      const queries = uniqueQueries([
        parsed.query,
        ...(Array.isArray(parsed.related_queries) ? parsed.related_queries : []),
        fallbackKeyword,
      ]);

      return {
        query: queries[0] || cleanSearchFragment(fallbackKeyword) || fallbackKeyword,
        related_queries: queries.slice(1),
        rationale: String(parsed.rationale || 'Optimized by Claude').trim(),
      };
    }

    const body = await response.text();
    const retryable = response.status === 429 || response.status === 529 || response.status >= 500;

    if (!retryable || attempt === 2) {
      console.warn('Claude planning fallback:', response.status, body);
      break;
    }

    await sleep(400 * (attempt + 1));
  }

  return {
    ...buildHeuristicTikTokPlan({
      prompt: `${prompt} ${searchOptions.hookContains || ''}`.trim(),
      fallbackKeyword,
      businessProfile,
    }),
    rationale: 'AI planning was unavailable, so a local multi-angle TikTok query plan was used.',
  };
}

async function searchTikTok(req, res) {
  try {
    const { keyword, limit = 20, minViews = 0, minLikes = 0, hookContains = '', hookMode = false } = req.body;

    if (!keyword || !String(keyword).trim()) {
      return res.status(400).json({ error: 'keyword is required' });
    }

    const data = await fetchTikTokResults(keyword, limit, {
      minViews,
      minLikes,
      hookContains,
      hookMode,
      prompt: String(keyword).trim(),
    });
    return res.json(data);
  } catch (error) {
    console.error('searchTikTok error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch TikTok search results' });
  }
}

async function intelligentSearchTikTok(req, res) {
  try {
    const {
      prompt = '',
      keyword = '',
      limit = 20,
      businessProfile = {},
      minViews = 0,
      minLikes = 0,
      hookContains = '',
      hookMode = false,
    } = req.body;
    const seed = String(keyword || prompt).trim();
    const searchOptions = { minViews, minLikes, hookContains, hookMode };

    if (!seed) {
      return res.status(400).json({ error: 'prompt or keyword is required' });
    }

    const plan = await planSearchWithClaude({
      prompt: String(prompt).trim(),
      fallbackKeyword: seed,
      businessProfile,
      searchOptions,
    });

    const queries = uniqueQueries([plan.query, ...(plan.related_queries || [])], 4);
    const results = await fetchTikTokResults(queries, limit, {
      prompt: String(prompt).trim(),
      businessProfile,
      ...searchOptions,
    });

    return res.json({
      plan: {
        ...plan,
        filters_applied: normalizeTikTokSearchOptions(searchOptions),
        queries,
        execution_mode: results?.plan?.mode || 'keyword_to_profiles',
        discovery_queries: results?.plan?.queries || queries,
        profile_seeds: results?.plan?.profile_seeds || [],
        discovery_count: results?.plan?.discovery_count || 0,
        profile_result_count: results?.plan?.profile_result_count || 0,
        filtered_result_count: results?.plan?.filtered_result_count || 0,
      },
      results: Array.isArray(results?.results) ? results.results : [],
    });
  } catch (error) {
    console.error('intelligentSearchTikTok error:', error);
    return res.status(500).json({ error: error.message || 'Failed to run intelligent search' });
  }
}

function normalizeRecentVideo(video = {}, index = 0) {
  const videoStreamUrl = pickPlayableUrl(
    extractSourceStreamUrl(video.source_video_stream_url),
    extractSourceStreamUrl(video.sourceVideoStreamUrl),
    extractSourceStreamUrl(video.video_stream_url),
    extractSourceStreamUrl(video.videoStreamUrl),
    video.videoUrl,
    video.play_url,
    video.playAddr,
    video.downloadAddr,
    video.videoMeta?.downloadAddr,
    video.videoMeta?.playAddr,
    video.video?.playAddr,
    video.video?.downloadAddr,
    video.video?.play_addr?.url_list?.[0],
    video.video?.download_addr?.url_list?.[0],
    video.play_addr?.url_list?.[0],
    video.download_addr?.url_list?.[0]
  );

  return {
    id: video.id || video.video_id || video.url || `recent-${index}`,
    url: pickPublicTikTokUrl(video.tiktok_url, video.url, video.webVideoUrl, video.shareUrl),
    tiktok_url: pickPublicTikTokUrl(video.tiktok_url, video.url, video.webVideoUrl, video.shareUrl),
    thumbnail: pickFirst(video.thumbnail, video.cover, video.covers?.default),
    source_video_stream_url: videoStreamUrl,
    videoStreamUrl: videoStreamUrl,
    video_stream_url: videoStreamUrl,
    caption: String(video.caption || video.desc || video.text || '').trim(),
    author: String(video.author || video.authorMeta?.name || '').trim(),
    profile_username: String(video.profile_username || video.profileUsername || '').trim(),
    profile_url: pickPublicTikTokUrl(video.profile_url, video.profileUrl),
    views: Number(video.views || video.playCount || video.stats?.playCount || 0),
    likes: Number(video.likes || video.diggCount || video.stats?.diggCount || 0),
    transcript: String(video.transcript || '').trim(),
    discovery_keyword: String(video.discovery_keyword || video.discoveryKeyword || '').trim(),
    source_stage: String(video.source_stage || video.sourceStage || '').trim(),
    source_context: String(video.source_context || video.sourceContext || '').trim(),
  };
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function saveRecentTikTokVideos(req, res) {
  try {
    await ensureUser(req.user);
    const videos = Array.isArray(req.body?.videos) ? req.body.videos : [];
    const limited = videos
      .slice(0, 20)
      .map(normalizeRecentVideo)
      .filter((video) => isPublicTikTokUrl(video.tiktok_url));

    await pool.query('DELETE FROM recent_tiktok_videos WHERE user_id = ?', [req.user.id]);

    if (limited.length) {
      const values = limited.map((video, index) => [req.user.id, index, JSON.stringify(video)]);
      await pool.query(
        `INSERT INTO recent_tiktok_videos (user_id, sort_order, video_json)
         VALUES ?`,
        [values]
      );
    }

    return res.json({ success: true, count: limited.length });
  } catch (error) {
    console.error('saveRecentTikTokVideos error:', error);
    return res.status(500).json({ error: 'Failed to save recent TikTok videos' });
  }
}

async function getRecentTikTokVideos(req, res) {
  try {
    await ensureUser(req.user);

    const [rows] = await pool.query(
      `SELECT video_json
       FROM recent_tiktok_videos
       WHERE user_id = ?
       ORDER BY sort_order ASC`,
      [req.user.id]
    );

    const videos = rows
      .map((row) => parseJson(row.video_json))
      .filter(Boolean)
      .map(normalizeRecentVideo);

    return res.json(videos);
  } catch (error) {
    console.error('getRecentTikTokVideos error:', error);
    return res.status(500).json({ error: 'Failed to fetch recent TikTok videos' });
  }
}

async function streamTikTokVideo(req, res) {
  try {
    const sourceUrl = String(req.query?.url || '').trim();
    if (!/^https?:\/\//i.test(sourceUrl)) {
      return res.status(400).json({ error: 'Valid source video URL is required' });
    }

    let referer = 'https://www.tiktok.com/';
    let origin = 'https://www.tiktok.com';
    try {
      const host = new URL(sourceUrl).hostname.toLowerCase();
      if (host.includes('tiktok')) {
        referer = 'https://www.tiktok.com/';
        origin = 'https://www.tiktok.com';
      } else if (host.includes('byteoversea') || host.includes('muscdn')) {
        referer = 'https://www.tiktok.com/';
        origin = 'https://www.tiktok.com';
      }
    } catch {
      // keep defaults
    }

    const requestHeaders = {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      referer,
      origin,
    };

    if (req.headers.range) {
      requestHeaders.range = req.headers.range;
    }

    const upstream = await fetch(sourceUrl, {
      headers: {
        ...requestHeaders,
      },
    });

    if (!upstream.ok) {
      console.warn('[video stream] upstream failed', {
        status: upstream.status,
        host: (() => {
          try {
            return new URL(sourceUrl).hostname;
          } catch {
            return '';
          }
        })(),
        urlPreview: sourceUrl.slice(0, 120),
      });
      return res.status(upstream.status).json({ error: `Upstream video request failed (${upstream.status})` });
    }

    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'video/mp4');
    res.setHeader('cache-control', 'public, max-age=600');

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) {
      res.setHeader('content-length', contentLength);
    }

    const acceptRanges = upstream.headers.get('accept-ranges');
    if (acceptRanges) {
      res.setHeader('accept-ranges', acceptRanges);
    }

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) {
      res.setHeader('content-range', contentRange);
    }

    if (!upstream.body) {
      return res.end();
    }

    return Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error('streamTikTokVideo error:', error);
    return res.status(500).json({ error: 'Failed to stream TikTok video' });
  }
}

function extractTikTokVideoId(url = '') {
  const raw = String(url || '').trim();
  const match = raw.match(/\/video\/(\d{8,})/i);
  return match ? match[1] : '';
}

async function fetchTikTokVideoByUrl(url) {
  const tiktokUrl = pickPublicTikTokUrl(url);
  if (!tiktokUrl) {
    throw new Error('Enter a valid public TikTok video link.');
  }

  const input = {
    postURLs: [tiktokUrl],
    shouldDownloadVideos: true,
    shouldDownloadCovers: true,
    shouldDownloadSubtitles: false,
    maxItems: 1,
  };

  const items = await runTikTokActor(TIKTOK_DISCOVERY_ACTOR_ID, input, 1);
  if (!items.length) {
    throw new Error('Could not load video from that link. Check the URL and try again.');
  }

  return normalizeTikTokItem(items[0], 0, { sourceStage: 'workspace_link' });
}

module.exports = {
  searchTikTok,
  intelligentSearchTikTok,
  saveRecentTikTokVideos,
  getRecentTikTokVideos,
  streamTikTokVideo,
  fetchTikTokVideoByUrl,
  extractTikTokVideoId,
  isPublicTikTokUrl,
};
