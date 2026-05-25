import { getUserFacingError } from './userFacingError.js';

export const API_URL = 'http://localhost:5000';

function isApifyArtifactUrl(value) {
  const raw = String(value || '').toLowerCase();
  return raw.includes('api.apify.com/v2/key-value-stores/') || raw.includes('/records/video-');
}

export function extractTikTokStreamSourceUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (isApifyArtifactUrl(raw)) return '';

  try {
    const parsed = new URL(raw, window.location.origin);
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

export function buildTikTokStreamUrl(sourceUrl) {
  const raw = extractTikTokStreamSourceUrl(sourceUrl);
  if (!raw) return '';
  return `${API_URL}/api/search/stream?url=${encodeURIComponent(raw)}`;
}

/** Stable local playback URL saved when top ads are scraped (full file on server). */
export function resolveTopAdPlaybackUrl(item) {
  const cached = String(item?.playbackUrl || '').trim();
  if (cached) {
    return cached.startsWith('http') ? cached : `${API_URL}${cached}`;
  }
  const raw = item?.videoUrlHd || item?.videoUrl || '';
  return buildTikTokStreamUrl(raw) || raw;
}

export function resolveTopAdThumbnailUrl(item) {
  const cached = String(item?.thumbnailCachedUrl || '').trim();
  if (cached) {
    return cached.startsWith('http') ? cached : `${API_URL}${cached}`;
  }
  return String(item?.thumbnail || '').trim();
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const rawMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
    const message = getUserFacingError(
      { message: rawMessage, upgrade_prompt: data?.upgrade_prompt },
      'Something went wrong. Please try again.'
    );
    const error = new Error(message);
    error.status = response.status;
    error.code = data?.code || '';
    error.billing = data?.billing || data?.subscription || null;
    error.subscription = data?.subscription || data?.billing || null;
    error.usage = data?.usage || null;
    error.metric = data?.metric || '';
    error.upgrade_prompt = data?.upgrade_prompt || '';
    throw error;
  }

  return data;
}

/** Usage caps, subscription gates, and similar billing errors (do not surface as generic UI errors). */
export function isBillingOrQuotaError(err) {
  if (!err) return false;
  const code = String(err.code || '').toLowerCase();
  if (
    code === 'quota_exceeded' ||
    code === 'subscription_required' ||
    code === 'pro_required' ||
    code === 'collection_limit_reached'
  ) {
    return true;
  }
  const status = Number(err.status);
  if (status === 429 || status === 402 || status === 403) {
    if (code || err.upgrade_prompt || err.billing) return true;
  }
  const combined = `${err.message || ''} ${err.upgrade_prompt || ''}`.toLowerCase();
  return (
    combined.includes('monthly facebook search limit') ||
    combined.includes('monthly tiktok search limit') ||
    combined.includes('workspace video limit') ||
    combined.includes('usage limit reached') ||
    combined.includes('billing cycle') ||
    combined.includes('upgrade your plan') ||
    combined.includes('add more videos') ||
    combined.includes('active subscription is required') ||
    combined.includes('pro subscription is required')
  );
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function searchVideos(token, keyword, limit = 20, options = {}) {
  return request('/api/search', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ keyword, limit, ...options }),
  });
}

export function fetchTikTokHotTakes(
  token,
  {
    country = 'US',
    category = 'hashtags',
    limit = 48,
    timeRange = '7',
    industry = '',
    videoSort = 'vv',
    creatorSort = 'follower',
    followerBand = '',
  } = {}
) {
  return request('/api/tiktok/hot-takes', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      country,
      category,
      limit,
      timeRange,
      industry,
      videoSort,
      creatorSort,
      followerBand,
    }),
  });
}

export function getTrendingMusic(token, country = 'US') {
  return request(`/api/tiktok/trending-music?country=${encodeURIComponent(country)}`, {
    headers: authHeaders(token),
  });
}

export function refreshTrendingMusic(token, { country = 'US', limit = 48 } = {}) {
  return request('/api/tiktok/trending-music/refresh', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ country, limit }),
  });
}

export function getTrendingCreators(
  token,
  { country = 'US', sort = 'follower', followerBand = '' } = {}
) {
  const params = new URLSearchParams({
    country,
    sort,
  });
  if (followerBand) params.set('followerBand', followerBand);
  return request(`/api/tiktok/trending-creators?${params.toString()}`, {
    headers: authHeaders(token),
  });
}

export function refreshTrendingCreators(
  token,
  { country = 'US', sort = 'follower', followerBand = '', limit = 48 } = {}
) {
  return request('/api/tiktok/trending-creators/refresh', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ country, sort, followerBand, limit }),
  });
}

export function getTopAds(
  token,
  {
    country = 'US',
    industry = '',
    objective = '',
    period = '7',
    adFormat = '',
    orderBy = 'for_you',
  } = {}
) {
  const params = new URLSearchParams({ country, period, orderBy });
  if (industry) params.set('industry', industry);
  if (objective) params.set('objective', objective);
  if (adFormat) params.set('adFormat', adFormat);
  return request(`/api/tiktok/top-ads?${params.toString()}`, {
    headers: authHeaders(token),
  });
}

export function refreshTopAds(
  token,
  {
    country = 'US',
    industry = '',
    objective = '',
    period = '7',
    adFormat = '',
    orderBy = 'for_you',
    limit = 48,
  } = {}
) {
  return request('/api/tiktok/top-ads/refresh', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ country, industry, objective, period, adFormat, orderBy, limit }),
  });
}

export function getWorkspaceFolders(token) {
  return request('/api/tiktok/workspace/folders', {
    headers: authHeaders(token),
  });
}

export function createWorkspaceFolder(token, { name }) {
  return request('/api/tiktok/workspace/folders', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
}

export function getWorkspaceFolder(token, folderId) {
  return request(`/api/tiktok/workspace/folders/${folderId}`, {
    headers: authHeaders(token),
  });
}

export function deleteWorkspaceFolder(token, folderId) {
  return request(`/api/tiktok/workspace/folders/${folderId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

export function addWorkspaceVideo(token, folderId, { url }) {
  return request(`/api/tiktok/workspace/folders/${folderId}/videos`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ url }),
  });
}

export function deleteWorkspaceVideo(token, folderId, videoId) {
  return request(`/api/tiktok/workspace/folders/${folderId}/videos/${videoId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

function createPlatformWorkspaceApi(platform) {
  const base = `/api/${platform}/workspace`;
  return {
    getFolders: (token) => request(`${base}/folders`, { headers: authHeaders(token) }),
    createFolder: (token, { name }) =>
      request(`${base}/folders`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ name }),
      }),
    getFolder: (token, folderId) =>
      request(`${base}/folders/${folderId}`, { headers: authHeaders(token) }),
    deleteFolder: (token, folderId) =>
      request(`${base}/folders/${folderId}`, { method: 'DELETE', headers: authHeaders(token) }),
    addVideo: (token, folderId, { url }) =>
      request(`${base}/folders/${folderId}/videos`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ url }),
      }),
    deleteVideo: (token, folderId, videoId) =>
      request(`${base}/folders/${folderId}/videos/${videoId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      }),
  };
}

const facebookWorkspaceApi = createPlatformWorkspaceApi('facebook');
const instagramWorkspaceApi = createPlatformWorkspaceApi('instagram');

export const getFacebookWorkspaceFolders = facebookWorkspaceApi.getFolders;
export const createFacebookWorkspaceFolder = facebookWorkspaceApi.createFolder;
export const getFacebookWorkspaceFolder = facebookWorkspaceApi.getFolder;
export const deleteFacebookWorkspaceFolder = facebookWorkspaceApi.deleteFolder;
export const addFacebookWorkspaceVideo = facebookWorkspaceApi.addVideo;
export const deleteFacebookWorkspaceVideo = facebookWorkspaceApi.deleteVideo;

export const getInstagramWorkspaceFolders = instagramWorkspaceApi.getFolders;
export const createInstagramWorkspaceFolder = instagramWorkspaceApi.createFolder;
export const getInstagramWorkspaceFolder = instagramWorkspaceApi.getFolder;
export const deleteInstagramWorkspaceFolder = instagramWorkspaceApi.deleteFolder;
export const addInstagramWorkspaceVideo = instagramWorkspaceApi.addVideo;
export const deleteInstagramWorkspaceVideo = instagramWorkspaceApi.deleteVideo;

export function getInstagramTrends(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.hashtags) {
    const tags = Array.isArray(filters.hashtags) ? filters.hashtags.join(',') : filters.hashtags;
    if (tags) params.set('hashtags', tags);
  }
  if (filters.brandName?.trim()) params.set('brandName', filters.brandName.trim());
  if (filters.searchMode) params.set('searchMode', filters.searchMode);
  if (filters.resultsType) params.set('resultsType', filters.resultsType);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.minLikes) params.set('minLikes', String(filters.minLikes));
  if (filters.minComments) params.set('minComments', String(filters.minComments));
  if (filters.requireBrandMatch) params.set('requireBrandMatch', '1');
  const qs = params.toString();
  return request(`/api/instagram/trends${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(token),
  });
}

export function refreshInstagramTrends(token, filters = {}) {
  return request('/api/instagram/trends/refresh', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(filters),
  });
}

export function intelligentSearchVideos(
  token,
  { prompt, keyword, limit = 20, businessProfile = {}, minViews = 0, minLikes = 0, hookContains = '', hookMode = false }
) {
  return request('/api/search/intelligent', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ prompt, keyword, limit, businessProfile, minViews, minLikes, hookContains, hookMode }),
  });
}

export function getRecentTikTokVideos(token) {
  return request('/api/search/recent', {
    headers: authHeaders(token),
  });
}

export function saveRecentTikTokVideos(token, videos = []) {
  return request('/api/search/recent', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ videos }),
  });
}

export function analyzeVideo(token, video) {
  return request('/api/analyze', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      videoUrl: video.url,
      caption: video.caption,
      author: video.author,
      transcript: video.transcript || '',
      videoStreamUrl: video.videoStreamUrl || video.video_stream_url || '',
      sourceContext: video.sourceContext || '',
    }),
  });
}

export function getBookmarks(token) {
  return request('/api/bookmarks', {
    headers: authHeaders(token),
  });
}

export function createBookmark(token, videoData, aiAnalysis) {
  return request('/api/bookmarks', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ videoData, aiAnalysis }),
  });
}

export function deleteBookmark(token, id) {
  return request(`/api/bookmarks/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

export function searchFacebookAds({
  token,
  keyword,
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
}) {
  return request('/api/facebook/ads', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      keyword,
      countries,
      limit,
      adType,
      adActiveStatus,
      source,
      urls,
      pageUrls,
      searchMode,
      advertiserPageId,
      competitorDeepDive,
    }),
  });
}

export function intelligentSearchFacebookAds({
  token,
  prompt,
  keyword,
  countries = ['US'],
  limit = 40,
  adType = 'ALL',
  adActiveStatus = 'ALL',
  source = 'apify_meta_ads',
  businessProfile = {},
  searchMode = 'research',
}) {
  return request('/api/facebook/ads/intelligent', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      prompt,
      keyword,
      countries,
      limit,
      adType,
      adActiveStatus,
      source,
      businessProfile,
      searchMode,
    }),
  });
}

export function searchInstagram({ token, query, limit = 12, source = 'profile_posts' }) {
  return request('/api/instagram/search', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ query, limit, source }),
  });
}

export function intelligentSearchInstagram({
  token,
  prompt,
  query,
  limit = 12,
  businessProfile = {},
  source = 'profile_posts',
}) {
  return request('/api/instagram/intelligent', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ prompt, query, limit, businessProfile, source }),
  });
}

export function getOnboardingStatus(token) {
  return request('/api/onboarding/status', {
    headers: authHeaders(token),
  });
}

export function saveOnboardingProfile(token, payload) {
  return request('/api/onboarding', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function previewOnboardingProfile(token, payload) {
  return request('/api/onboarding/preview', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function previewLandingWebsite(payload) {
  return request('/api/onboarding/landing-preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getBrandProfile(token) {
  return request('/api/onboarding', {
    headers: authHeaders(token),
  });
}

export function getDashboardOverview(token) {
  return request('/api/dashboard/overview', {
    headers: authHeaders(token),
  });
}

export function generateHookScript(token, payload) {
  return request('/api/hooks/generate', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function generateFacebookAdCopy(token, payload) {
  return request('/api/hooks/facebook-ad-copy', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function extractProductFromWebsite(token, websiteUrl) {
  return request('/api/hooks/product-from-website', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ websiteUrl }),
  });
}

export function analyzeWebsiteCro(token, websiteUrl) {
  return request('/api/cro-audit', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ websiteUrl }),
  });
}

export function getSavedCroAudits(token) {
  return request('/api/cro-audits', {
    headers: authHeaders(token),
  });
}

export function createSavedCroAudit(token, payload) {
  return request('/api/cro-audits', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function deleteSavedCroAudit(token, id) {
  return request(`/api/cro-audits/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

export function getBillingStatus(token) {
  return request('/api/billing/status', {
    headers: authHeaders(token),
  });
}

export function getCollections(token, params = {}) {
  const query = new URLSearchParams();
  if (params.platform) query.set('platform', params.platform);
  if (params.includeArchived) query.set('includeArchived', '1');
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/api/collections${suffix}`, {
    headers: authHeaders(token),
  });
}

export function getCollection(token, id) {
  return request(`/api/collections/${id}`, {
    headers: authHeaders(token),
  });
}

export function createCollection(token, payload) {
  return request('/api/collections', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function updateCollection(token, id, payload) {
  return request(`/api/collections/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function duplicateCollection(token, id) {
  return request(`/api/collections/${id}/duplicate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

export function deleteCollection(token, id) {
  return request(`/api/collections/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

export function createAnalyzeJob(token, payload) {
  return request('/api/analyze/jobs', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function createCroAuditJob(token, payload) {
  return request('/api/cro-audit/jobs', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function getJobStatus(token, id) {
  return request(`/api/jobs/${id}`, {
    headers: authHeaders(token),
  });
}

export function createBillingCheckout(token, planKey, options = {}) {
  return request('/api/billing/checkout', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ planKey, ...options }),
  });
}

export function createBillingPortalSession(token) {
  return request('/api/billing/portal', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

export function getArticles(status = 'published') {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/api/articles${query}`);
}

export function getArticleBySlug(slug) {
  return request(`/api/articles/${encodeURIComponent(slug)}`);
}

export function submitSupportMessage(payload) {
  return request('/api/support/contact', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export function getWeeklyRecommendations(token) {
  return request('/api/strategy/weekly-recommendations', {
    headers: authHeaders(token),
  });
}

export function generateCreativeTestPlanner(token, payload) {
  return request('/api/strategy/test-planner', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function generateMonthlySocialCalendar(token, payload) {
  return request('/api/strategy/monthly-social-calendar', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function runCompetitorRadar(token, payload) {
  return request('/api/strategy/competitor-radar', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function getCompetitorAlerts(token) {
  return request('/api/strategy/competitor-alerts', {
    headers: authHeaders(token),
  });
}

export function getWinningPatterns(token) {
  return request('/api/strategy/winning-patterns', {
    headers: authHeaders(token),
  });
}

export function generateCreativeBrief(token, payload) {
  return request('/api/strategy/creative-brief', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function getPersonaLens(token) {
  return request('/api/strategy/persona-lens', {
    headers: authHeaders(token),
  });
}

export function getPerformanceBenchmarks(token) {
  return request('/api/strategy/benchmarks', {
    headers: authHeaders(token),
  });
}

export function getLandingAdMatchScore(token, payload) {
  return request('/api/strategy/landing-ad-match', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function getSavedPlans(token) {
  return request('/api/strategy/saved-plans', {
    headers: authHeaders(token),
  });
}

export function createSavedPlan(token, payload) {
  return request('/api/strategy/saved-plans', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function updateSavedPlan(token, id, payload) {
  return request(`/api/strategy/saved-plans/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function deleteSavedPlan(token, id) {
  return request(`/api/strategy/saved-plans/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

export function getCompetitorWatchlist(token) {
  return request('/api/strategy/watchlist', {
    headers: authHeaders(token),
  });
}

export function createCompetitorWatchlistItem(token, payload) {
  return request('/api/strategy/watchlist', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function updateCompetitorWatchlistItem(token, id, payload) {
  return request(`/api/strategy/watchlist/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
}

export function deleteCompetitorWatchlistItem(token, id) {
  return request(`/api/strategy/watchlist/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}
