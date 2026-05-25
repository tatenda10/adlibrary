export const DEFAULT_INSTAGRAM_TREND_HASHTAGS = 'viral,trending,reels,fyp';

export const INSTAGRAM_TRENDS_CONTENT_TYPES = [
  { value: 'posts', label: 'Posts' },
  { value: 'reels', label: 'Reels' },
];

export const INSTAGRAM_TRENDS_SEARCH_MODES = [
  { value: 'hashtag', label: 'Hashtag explore' },
  { value: 'keyword', label: 'Keyword search (Apify)' },
];

export const DEFAULT_INSTAGRAM_TREND_FILTERS = {
  brandName: '',
  hashtags: DEFAULT_INSTAGRAM_TREND_HASHTAGS,
  searchMode: 'hashtag',
  resultsType: 'posts',
  limit: 36,
  minLikes: 0,
  minComments: 0,
  requireBrandMatch: false,
};

export function parseHashtagList(raw = '') {
  return String(raw || '')
    .split(/[,\s]+/)
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean);
}

export function slugifyBrandName(name = '') {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48);
}

/** Stable key for cache lookup — must match server buildTrendsCacheKey. */
export function instagramTrendsFilterKey(filters = {}) {
  const tags = [...new Set(parseHashtagList(filters.hashtags))].sort();
  const brand = slugifyBrandName(filters.brandName);
  const mode = filters.searchMode === 'keyword' ? 'keyword' : 'hashtag';
  const type = filters.resultsType === 'reels' ? 'reels' : 'posts';
  const minLikes = Math.max(0, Number(filters.minLikes) || 0);
  const minComments = Math.max(0, Number(filters.minComments) || 0);
  const requireBrand = filters.requireBrandMatch ? '1' : '0';

  return [
    `mode:${mode}`,
    brand ? `brand:${brand}` : '',
    tags.length ? `tags:${tags.join('+')}` : '',
    `type:${type}`,
    minLikes ? `minLikes:${minLikes}` : '',
    minComments ? `minComments:${minComments}` : '',
    `brandMatch:${requireBrand}`,
  ]
    .filter(Boolean)
    .join('|');
}

export function instagramTrendsQueryParams(filters = {}) {
  const params = new URLSearchParams();
  const tags = parseHashtagList(filters.hashtags);
  if (tags.length) params.set('hashtags', tags.join(','));
  if (filters.brandName?.trim()) params.set('brandName', filters.brandName.trim());
  if (filters.searchMode) params.set('searchMode', filters.searchMode);
  if (filters.resultsType) params.set('resultsType', filters.resultsType);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.minLikes) params.set('minLikes', String(filters.minLikes));
  if (filters.minComments) params.set('minComments', String(filters.minComments));
  if (filters.requireBrandMatch) params.set('requireBrandMatch', '1');
  return params;
}
