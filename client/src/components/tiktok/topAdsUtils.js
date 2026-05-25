export const TOP_ADS_INDUSTRIES = [
  { value: '', label: 'All industries' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'beauty_personal_care', label: 'Beauty & personal care' },
  { value: 'fashion_accessories', label: 'Fashion & accessories' },
  { value: 'food_beverage', label: 'Food & beverage' },
  { value: 'health', label: 'Health' },
  { value: 'finance', label: 'Finance' },
  { value: 'education', label: 'Education' },
  { value: 'tech_electronics', label: 'Tech & electronics' },
  { value: 'app_games', label: 'App — games' },
  { value: 'app_non_games', label: 'App — non-games' },
  { value: 'travel', label: 'Travel' },
  { value: 'vehicles_transport', label: 'Vehicles & transport' },
  { value: 'home_improvement', label: 'Home improvement' },
  { value: 'life_services', label: 'Life services' },
  { value: 'media_entertainment', label: 'Media & entertainment' },
  { value: 'sports_outdoors', label: 'Sports & outdoors' },
  { value: 'pets', label: 'Pets' },
  { value: 'baby_kids_maternity', label: 'Baby, kids & maternity' },
  { value: 'news_politics', label: 'News & politics' },
];

export const TOP_ADS_OBJECTIVES = [
  { value: '', label: 'All objectives' },
  { value: 'conversions', label: 'Conversions' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'app_install', label: 'App install' },
  { value: 'reach', label: 'Reach' },
  { value: 'video_views', label: 'Video views' },
  { value: 'lead_generation', label: 'Lead generation' },
  { value: 'catalog_sales', label: 'Catalog sales' },
  { value: 'community_interaction', label: 'Community interaction' },
];

export const TOP_ADS_PERIODS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '180', label: 'Last 180 days' },
];

export const TOP_ADS_FORMATS = [
  { value: '', label: 'All formats' },
  { value: 'spark_ads', label: 'Spark Ads' },
  { value: 'non_spark_ads', label: 'Non-Spark Ads' },
  { value: 'collection_ads', label: 'Collection Ads' },
];

export const TOP_ADS_ORDER_BY = [
  { value: 'for_you', label: 'Recommended' },
  { value: 'like', label: 'Most likes' },
  { value: 'ctr', label: 'Highest CTR' },
  { value: 'impression', label: 'Most impressions' },
];

export function formatCtr(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return `${pct.toFixed(pct >= 10 ? 1 : 2)}% CTR`;
}

function normalizeFilterToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function itemMatchesToken(itemValue, filterValue) {
  if (!filterValue) return true;
  const itemToken = normalizeFilterToken(itemValue);
  const filterToken = normalizeFilterToken(filterValue);
  if (!itemToken) return true;
  return itemToken === filterToken || itemToken.includes(filterToken) || filterToken.includes(itemToken);
}

/**
 * Narrow and sort ads already loaded in the client. Period is scrape-time only (use Refresh).
 */
export function filterAndSortTopAds(items, { country, industry, objective, adFormat, orderBy } = {}) {
  const list = Array.isArray(items) ? items : [];
  const cc = String(country || '').trim().toUpperCase();

  const filtered = list.filter((item) => {
    if (cc && item.country) {
      const itemCc = String(item.country).trim().toUpperCase();
      if (itemCc && itemCc !== cc) return false;
    }
    if (industry && !itemMatchesToken(item.industry, industry)) return false;
    if (objective && !itemMatchesToken(item.objective, objective)) return false;
    if (adFormat && !itemMatchesToken(item.adFormat, adFormat)) return false;
    return true;
  });

  const sorted = [...filtered];
  const sortKey = String(orderBy || 'for_you').toLowerCase();

  if (sortKey === 'like') {
    sorted.sort((a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0));
  } else if (sortKey === 'ctr') {
    sorted.sort((a, b) => (Number(b.ctr) || 0) - (Number(a.ctr) || 0));
  } else if (sortKey === 'impression') {
    sorted.sort(
      (a, b) =>
        (Number(b.impressions) || Number(b.likes) || 0) - (Number(a.impressions) || Number(a.likes) || 0)
    );
  }

  return sorted.map((item, index) => ({ ...item, rank: index + 1 }));
}
