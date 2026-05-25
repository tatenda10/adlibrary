export const TREND_COUNTRY_OPTIONS = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'IN', name: 'India' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'PH', name: 'Philippines' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PL', name: 'Poland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PT', name: 'Portugal' },
];

export const HASHTAG_TIME_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '120', label: 'Last 120 days' },
];

export const CREATOR_SORTS = [
  { value: 'follower', label: 'Followers' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'avg_views', label: 'Avg views' },
];

/** TikTok Creative Center `adsFollowers` bands (1–4). */
export const CREATOR_FOLLOWER_BANDS = [
  { value: '', label: 'All follower sizes' },
  { value: '1', label: '10K – 100K' },
  { value: '2', label: '100K – 1M' },
  { value: '3', label: '1M – 10M' },
  { value: '4', label: '10M+' },
];

export const HASHTAG_INDUSTRIES = [
  'Apparel & Accessories',
  'Baby, Kids & Maternity',
  'Beauty & Personal Care',
  'Business Services',
  'Education',
  'Financial Services',
  'Food & Beverage',
  'Games',
  'Health',
  'Home Improvement',
  'Household Products',
  'Life Services',
  'News & Entertainment',
  'Pets',
  'Sports & Outdoor',
  'Tech & Electronics',
  'Travel',
  'Vehicle & Transportation',
];

export function formatTrendCount(value) {
  const n = Number(value || 0);
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatEngagementRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return `${pct.toFixed(pct >= 10 ? 1 : 2)}%`;
}

export function creatorAvgViews(item) {
  const avg = Number(item?.avgViews || 0);
  if (avg > 0) return avg;
  return Number(item?.views || 0) || 0;
}
