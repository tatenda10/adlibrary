const STORAGE_KEY = 'viraladlib_tiktok_top_ads_v1';
const MAX_KEYS = 10;
/** How long client session cache is trusted when navigating back (default 6h). */
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

function ttlMs() {
  const n = Number(import.meta.env?.VITE_TOP_ADS_SESSION_TTL_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MS;
}

export function topAdsFilterKey({ country, industry, objective, period, adFormat, orderBy }) {
  return [country, industry, objective, period, adFormat, orderBy].join('|');
}

export function readTopAdsSession(filterKey) {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    const entry = map[filterKey];
    if (!entry?.savedAt || !entry?.payload) return null;
    if (Date.now() - entry.savedAt > ttlMs()) return null;
    return entry.payload;
  } catch {
    return null;
  }
}

export function writeTopAdsSession(filterKey, payload) {
  if (typeof sessionStorage === 'undefined') return;
  if (!filterKey || !payload?.items?.length) return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[filterKey] = { savedAt: Date.now(), payload };

    const keys = Object.keys(map);
    if (keys.length > MAX_KEYS) {
      keys.sort((a, b) => (map[b].savedAt || 0) - (map[a].savedAt || 0));
      for (let i = MAX_KEYS; i < keys.length; i += 1) {
        delete map[keys[i]];
      }
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota / private mode
  }
}
