import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { getInstagramTrends, refreshInstagramTrends } from '../lib/api.js';
import { useApiToast } from '../hooks/useApiToast.js';
import {
  DEFAULT_INSTAGRAM_TREND_FILTERS,
  INSTAGRAM_TRENDS_CONTENT_TYPES,
  INSTAGRAM_TRENDS_SEARCH_MODES,
  instagramTrendsFilterKey,
  parseHashtagList,
} from '../components/instagram/instagramTrendsUtils.js';

export default function InstagramTrending() {
  const { getToken } = useAuth();
  const { notifyBillingOrApiError } = useApiToast();
  const [filters, setFilters] = useState(DEFAULT_INSTAGRAM_TREND_FILTERS);
  const [items, setItems] = useState([]);
  const [fetchedAt, setFetchedAt] = useState('');
  const [isFresh, setIsFresh] = useState(false);
  const [scrapeMeta, setScrapeMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const filterKey = useMemo(() => instagramTrendsFilterKey(filters), [filters]);
  const hashtagPreview = useMemo(() => parseHashtagList(filters.hashtags), [filters.hashtags]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const apiFilters = useMemo(
    () => ({
      brandName: filters.brandName.trim(),
      hashtags: filters.hashtags,
      searchMode: filters.searchMode,
      resultsType: filters.resultsType,
      limit: Number(filters.limit) || 36,
      minLikes: Number(filters.minLikes) || 0,
      minComments: Number(filters.minComments) || 0,
      requireBrandMatch: Boolean(filters.requireBrandMatch && filters.brandName.trim()),
    }),
    [filters]
  );

  const applyPayload = useCallback((data) => {
    setItems(Array.isArray(data?.items) ? data.items : []);
    setFetchedAt(data?.fetched_at || '');
    setIsFresh(Boolean(data?.is_fresh));
    setScrapeMeta({
      cacheKey: data?.cache_key || data?.hashtag_key || '',
      scrapeTargets: data?.scrape_targets || data?.filters?.hashtags || [],
      filters: data?.filters || null,
    });
  }, []);

  const loadTrends = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await getInstagramTrends(token, apiFilters);
      applyPayload(data);
      setHasLoaded(true);
    } catch (err) {
      setItems([]);
      notifyBillingOrApiError(err, 'Could not load Instagram trends.');
    } finally {
      setLoading(false);
    }
  }, [apiFilters, applyPayload, getToken, notifyBillingOrApiError]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await refreshInstagramTrends(token, apiFilters);
      applyPayload(data);
      setHasLoaded(true);
    } catch (err) {
      notifyBillingOrApiError(err, 'Could not refresh Instagram trends.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleRefresh();
  };

  const busy = loading || refreshing;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-white/45">Instagram</p>
        <h2 className="text-xl font-semibold text-white">Trending</h2>
        <p className="mt-1 text-sm text-white/55">
          Scrape by brand keyword and hashtags. Results are cached per filter set.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-sm p-4"
        style={{ background: 'var(--app-panel)' }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block sm:col-span-1">
            <span className="text-xs text-white/55">Brand name</span>
            <input
              value={filters.brandName}
              onChange={(e) => updateFilter('brandName', e.target.value)}
              placeholder="e.g. Nike, Glossier"
              className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
            />
            <span className="mt-1 block text-[11px] text-white/40">
              Hashtag mode adds a slug tag; keyword mode searches captions.
            </span>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs text-white/55">Hashtags</span>
            <input
              value={filters.hashtags}
              onChange={(e) => updateFilter('hashtags', e.target.value)}
              placeholder="fitness, skincareroutine, usasmallbusiness"
              className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
            />
            <span className="mt-1 block text-[11px] text-white/40">
              Comma-separated, no #. {hashtagPreview.length} tag{hashtagPreview.length === 1 ? '' : 's'}{' '}
              queued.
            </span>
          </label>

          <label className="block">
            <span className="text-xs text-white/55">Search mode</span>
            <select
              value={filters.searchMode}
              onChange={(e) => updateFilter('searchMode', e.target.value)}
              className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
            >
              {INSTAGRAM_TRENDS_SEARCH_MODES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-white/55">Content type</span>
            <select
              value={filters.resultsType}
              onChange={(e) => updateFilter('resultsType', e.target.value)}
              className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
            >
              {INSTAGRAM_TRENDS_CONTENT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-white/55">Max results</span>
            <input
              type="number"
              min={1}
              max={100}
              value={filters.limit}
              onChange={(e) => updateFilter('limit', e.target.value)}
              className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
            />
          </label>

          <label className="block">
            <span className="text-xs text-white/55">Min likes</span>
            <input
              type="number"
              min={0}
              value={filters.minLikes}
              onChange={(e) => updateFilter('minLikes', e.target.value)}
              className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
            />
          </label>

          <label className="block">
            <span className="text-xs text-white/55">Min comments</span>
            <input
              type="number"
              min={0}
              value={filters.minComments}
              onChange={(e) => updateFilter('minComments', e.target.value)}
              className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
            />
          </label>

          <label className="flex items-end gap-2 pb-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={filters.requireBrandMatch}
              disabled={!filters.brandName.trim()}
              onChange={(e) => updateFilter('requireBrandMatch', e.target.checked)}
              className="rounded border-white/20"
            />
            <span className="text-sm text-white/70">
              Only show posts mentioning the brand (caption, @username, or hashtag)
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="rounded-sm bg-[#25d366] px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {refreshing ? 'Scraping…' : 'Refresh scrape'}
          </button>
          <button
            type="button"
            onClick={loadTrends}
            disabled={busy}
            className="rounded-sm border border-white/15 px-4 py-2 text-sm text-white/80 disabled:opacity-50"
          >
            Load cache
          </button>
        </div>
      </form>

      <p className="text-[11px] text-white/40">
        Cache key: <span className="text-white/55">{filterKey}</span>
        {scrapeMeta?.scrapeTargets?.length ? (
          <>
            {' '}
            · Apify targets: {scrapeMeta.scrapeTargets.map((t) => `#${t}`).join(', ')}
          </>
        ) : null}
      </p>

      {items.length > 0 ? (
        <p className="text-xs text-white/45">
          {items.length} posts
          {fetchedAt ? ` · ${isFresh ? 'cached' : 'stale'} ${new Date(fetchedAt).toLocaleString()}` : ''}
        </p>
      ) : null}

      {busy ? (
        <CubeLoaderOverlay
          label={refreshing ? 'Scraping with your filters…' : 'Loading cached trends…'}
          minHeight="40vh"
        />
      ) : null}

      {!busy && !hasLoaded ? (
        <div className="grid min-h-[36vh] place-items-center rounded-sm border border-white/10 bg-white/[0.02]">
          <p className="max-w-md text-center text-sm text-white/55">
            Set brand, hashtags, and filters, then click <strong className="text-white/80">Refresh scrape</strong>{' '}
            or <strong className="text-white/80">Load cache</strong>.
          </p>
        </div>
      ) : null}

      {!busy && hasLoaded && !items.length ? (
        <div className="grid min-h-[36vh] place-items-center rounded-sm border border-white/10 bg-white/[0.02]">
          <p className="max-w-md text-center text-sm text-white/55">
            No posts for this filter set. Loosen min likes/comments, turn off brand-only, or try different
            hashtags.
          </p>
        </div>
      ) : null}

      {!busy && items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <TrendPostCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TrendPostCard({ item }) {
  const [imgFailed, setImgFailed] = useState(false);
  const postUrl = item.url || item.instagram_url;

  return (
    <article className="flex flex-col overflow-hidden rounded-sm border border-white/10 bg-white/[0.02]">
      <div className="relative aspect-[9/14] w-full overflow-hidden bg-black/40">
        {item.thumbnail && !imgFailed ? (
          <a href={postUrl} target="_blank" rel="noreferrer" className="block h-full">
            <img
              src={item.thumbnail}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => setImgFailed(true)}
            />
          </a>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/40">Post</div>
        )}
        <span className="pointer-events-none absolute left-2 top-2 rounded-sm bg-black/75 px-2 py-0.5 text-xs font-bold text-[#25d366]">
          #{item.rank}
        </span>
        {item.hashtag ? (
          <span className="pointer-events-none absolute right-2 top-2 max-w-[45%] truncate rounded-sm bg-black/75 px-1.5 py-0.5 text-[10px] text-white/80">
            #{item.hashtag}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{item.name}</p>
        {item.author ? <p className="truncate text-xs text-[#86efac]">@{item.author}</p> : null}
        {item.locationName ? (
          <p className="truncate text-[10px] text-white/45">{item.locationName}</p>
        ) : null}
        <p className="text-[11px] text-white/55">
          {Number(item.likes || 0).toLocaleString()} likes · {Number(item.comments || 0).toLocaleString()}{' '}
          comments
        </p>
        {postUrl ? (
          <a
            href={postUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-auto pt-2 text-[11px] font-semibold text-[#86efac] hover:text-white"
          >
            Open on Instagram
          </a>
        ) : null}
      </div>
    </article>
  );
}
