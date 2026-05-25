import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import {
  CREATOR_FOLLOWER_BANDS,
  CREATOR_SORTS,
  TREND_COUNTRY_OPTIONS,
  creatorAvgViews,
  formatEngagementRate,
  formatTrendCount,
} from '../components/tiktok/trendUtils.js';
import { getTrendingCreators, refreshTrendingCreators } from '../lib/api.js';
import { useApiToast } from '../hooks/useApiToast.js';

const RESULT_LIMIT = 48;

export default function TikTokCreators() {
  const { getToken } = useAuth();
  const { notifyApiError, notifyBillingOrApiError } = useApiToast();
  const [country, setCountry] = useState('US');
  const [creatorSort, setCreatorSort] = useState('follower');
  const [followerBand, setFollowerBand] = useState('');
  const [items, setItems] = useState([]);
  const [fetchedAt, setFetchedAt] = useState('');
  const [isFresh, setIsFresh] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const applyPayload = useCallback((data) => {
    setItems(Array.isArray(data?.items) ? data.items : []);
    setFetchedAt(data?.fetched_at || '');
    setIsFresh(Boolean(data?.is_fresh));
    setIsStale(Boolean(data?.stale));
  }, []);

  const loadFromCache = useCallback(async () => {
    setIsLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');

      const data = await getTrendingCreators(token, {
        country,
        sort: creatorSort,
        followerBand,
      });
      applyPayload(data);
    } catch (err) {
      notifyApiError(err, 'Could not load creators. Please try again.', { ignoreNotFound: true });
      setItems([]);
      setFetchedAt('');
      setIsFresh(false);
      setIsStale(false);
    } finally {
      setIsLoading(false);
    }
  }, [applyPayload, country, creatorSort, followerBand, getToken, notifyApiError]);

  const handleRefresh = async (event) => {
    event.preventDefault();
    setIsRefreshing(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');

      const data = await refreshTrendingCreators(token, {
        country,
        sort: creatorSort,
        followerBand,
        limit: RESULT_LIMIT,
      });
      applyPayload(data);
    } catch (err) {
      notifyBillingOrApiError(
        err,
        'Failed to refresh trending creators. Please try again in a few minutes.'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  const busy = isLoading || isRefreshing;
  const loaderLabel = isRefreshing
    ? `Refreshing creators for ${country}…`
    : `Loading creators for ${country}…`;

  return (
    <section className="space-y-4">
      <form
        onSubmit={handleRefresh}
        className="flex flex-wrap items-end justify-between gap-3 rounded-sm p-4"
        style={{ background: 'var(--app-panel)' }}
      >
        <label className="block min-w-[12rem] flex-1 sm:max-w-xs">
          <span className="text-xs text-white/55">Country</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
          >
            {TREND_COUNTRY_OPTIONS.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[10rem]">
          <span className="text-xs text-white/55">Sort by</span>
          <select
            value={creatorSort}
            onChange={(e) => setCreatorSort(e.target.value)}
            className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
          >
            {CREATOR_SORTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[11rem]">
          <span className="text-xs text-white/55">Follower band</span>
          <select
            value={followerBand}
            onChange={(e) => setFollowerBand(e.target.value)}
            className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
          >
            {CREATOR_FOLLOWER_BANDS.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="rounded-sm bg-[#25d366] px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          Refresh live
        </button>
      </form>

      {!busy && (isStale || !isFresh) && items.length > 0 ? (
        <p className="text-xs text-amber-200/90">
          Showing cached data{fetchedAt ? ` from ${new Date(fetchedAt).toLocaleString()}` : ''}. Refresh for
          the latest scrape.
        </p>
      ) : null}

      {busy ? <CubeLoaderOverlay label={loaderLabel} minHeight="40vh" /> : null}

      {!busy && items.length > 0 ? (
        <p className="text-xs text-white/45">
          {items.length} creators · limit {RESULT_LIMIT}
          {fetchedAt ? ` · cached ${new Date(fetchedAt).toLocaleString()}` : ''}
        </p>
      ) : null}

      {!busy && items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <CreatorTrendCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CreatorTrendCard({ item }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = item.thumbnail && !imgFailed;
  const displayName = item.authorName || item.name;
  const engagement = formatEngagementRate(item.engagementRate);
  const avgViews = creatorAvgViews(item);

  return (
    <article className="flex flex-col overflow-hidden rounded-sm border border-white/10 bg-white/[0.02]">
      <div className="relative aspect-square w-full bg-black/40">
        {showImage ? (
          <img
            src={item.thumbnail}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#134e2a]/30 to-black/80 text-2xl font-bold text-[#25d366]">
            {(displayName || '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-sm bg-black/75 px-2 py-0.5 text-xs font-bold text-[#25d366]">
          #{item.rank}
        </span>
        {item.markedAsNew ? (
          <span className="absolute right-2 top-2 rounded-sm bg-[#25d366]/90 px-1.5 py-0.5 text-[10px] font-semibold text-black">
            New
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{item.name}</p>
        {displayName && displayName !== item.name ? (
          <p className="truncate text-xs text-white/55">@{displayName}</p>
        ) : null}
        <p className="text-xs text-white/70">{formatTrendCount(item.followers)} followers</p>
        {engagement ? <p className="text-[11px] text-white/55">{engagement} engagement</p> : null}
        {avgViews > 0 ? (
          <p className="text-[11px] text-white/45">{formatTrendCount(avgViews)} avg views</p>
        ) : null}
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="mt-auto pt-2 text-[11px] font-semibold text-[#86efac] hover:text-white"
          >
            View on TikTok
          </a>
        ) : null}
      </div>
    </article>
  );
}
