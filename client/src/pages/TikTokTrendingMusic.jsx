import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { TREND_COUNTRY_OPTIONS } from '../components/tiktok/trendUtils.js';
import { useApiToast } from '../hooks/useApiToast.js';
import { fetchTikTokHotTakes, getTrendingMusic, refreshTrendingMusic } from '../lib/api.js';
import { TOAST_FALLBACKS } from '../lib/userFacingError.js';

const DEFAULT_COUNTRY = 'US';
const RESULT_LIMIT = 48;

const TABS = [
  { id: 'chart', label: 'Daily chart' },
  { id: 'sounds', label: 'Trending sounds' },
];

export default function TikTokTrendingMusic() {
  const { getToken } = useAuth();
  const { notifyApiError, notifyBillingOrApiError, showSuccess } = useApiToast();
  const [tab, setTab] = useState('chart');
  const [viewCountry, setViewCountry] = useState(DEFAULT_COUNTRY);
  const [searchCountry, setSearchCountry] = useState(DEFAULT_COUNTRY);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const applyPayload = useCallback((data) => {
    setItems(Array.isArray(data?.items) ? data.items : []);
    setViewCountry(data?.country || searchCountry || DEFAULT_COUNTRY);
  }, [searchCountry]);

  const loadDailyChart = useCallback(
    async (country = DEFAULT_COUNTRY) => {
      setIsLoading(true);

      try {
        const token = await getToken();
        if (!token) throw new Error('No session token available');

        const data = await getTrendingMusic(token, country);
        applyPayload(data);
      } catch (err) {
        setItems([]);
        notifyApiError(err, 'Could not load the daily chart.', { ignoreNotFound: true });
      } finally {
        setIsLoading(false);
      }
    },
    [applyPayload, getToken, notifyApiError]
  );

  const loadTrendingSounds = useCallback(async () => {
    setIsLoading(true);
    setItems([]);

    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');

      const data = await fetchTikTokHotTakes(token, {
        country: searchCountry,
        category: 'sounds',
        limit: RESULT_LIMIT,
      });

      applyPayload({ ...data, country: data?.country || searchCountry });
    } catch (err) {
      setItems([]);
      notifyBillingOrApiError(err, TOAST_FALLBACKS.unavailable);
    } finally {
      setIsLoading(false);
    }
  }, [applyPayload, getToken, notifyBillingOrApiError, searchCountry]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsRefreshing(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');

      if (tab === 'chart') {
        const data = await refreshTrendingMusic(token, {
          country: searchCountry,
          limit: RESULT_LIMIT,
        });
        applyPayload(data);
        showSuccess(`Daily chart updated for ${searchCountry}.`);
      } else {
        const data = await fetchTikTokHotTakes(token, {
          country: searchCountry,
          category: 'sounds',
          limit: RESULT_LIMIT,
        });
        applyPayload({ ...data, country: data?.country || searchCountry });
        showSuccess(`Loaded trending sounds for ${searchCountry}.`);
      }
    } catch (err) {
      notifyBillingOrApiError(
        err,
        tab === 'chart'
          ? 'Could not refresh the daily chart. Try again in a few minutes.'
          : TOAST_FALLBACKS.unavailable
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (tab === 'chart') {
      loadDailyChart(DEFAULT_COUNTRY);
    } else {
      loadTrendingSounds();
    }
  }, [tab, loadDailyChart, loadTrendingSounds]);

  const busy = isLoading || isRefreshing;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition ${
              tab === item.id
                ? 'border-[#25d366] bg-[#25d366]/15 text-[#86efac]'
                : 'border-white/15 text-white/65 hover:border-white/30 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end justify-between gap-3 rounded-sm p-4"
        style={{ background: 'var(--app-panel)' }}
      >
        <label className="block min-w-[12rem] flex-1 sm:max-w-xs">
          <span className="text-xs text-white/55">Country</span>
          <select
            value={searchCountry}
            onChange={(e) => setSearchCountry(e.target.value)}
            className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
          >
            {TREND_COUNTRY_OPTIONS.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:ml-auto">
          {tab === 'chart' && viewCountry !== DEFAULT_COUNTRY ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSearchCountry(DEFAULT_COUNTRY);
                loadDailyChart(DEFAULT_COUNTRY);
              }}
              className="rounded-sm border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:border-[#25d366] disabled:opacity-60"
            >
              Back to US daily
            </button>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-sm bg-[#25d366] px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {isRefreshing ? 'Loading…' : tab === 'chart' ? 'Refresh chart' : 'Refresh sounds'}
          </button>
        </div>
      </form>

      {isLoading ? (
        <CubeLoaderOverlay
          label={tab === 'chart' ? 'Loading daily chart…' : 'Loading trending sounds…'}
          minHeight="40vh"
        />
      ) : null}

      {isRefreshing ? (
        <CubeLoaderOverlay label="Updating…" fullscreen />
      ) : null}

      {!isLoading && !items.length ? (
        <div className="grid min-h-[36vh] place-items-center rounded-sm border border-white/10 bg-white/[0.02]">
          <div className="max-w-md px-4 text-center">
            <p className="text-lg font-semibold text-white">
              {tab === 'chart' ? 'No chart data yet' : 'No sounds for this market'}
            </p>
            <p className="mt-2 text-sm text-white/55">
              {tab === 'chart'
                ? 'The daily US job may still be running. Try Trending sounds or click Refresh chart.'
                : 'Try another country or refresh.'}
            </p>
          </div>
        </div>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => (
            <MusicTrendCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MusicTrendCard({ item }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = item.thumbnail && !imgFailed;

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
          <MusicPlaceholder />
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
        {item.authorName ? <p className="truncate text-xs text-white/55">@{item.authorName}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          {item.rankDiff !== 0 ? (
            <span className="text-[10px] text-white/45">
              {item.rankDiff > 0 ? `↑${item.rankDiff}` : `↓${Math.abs(item.rankDiff)}`}
            </span>
          ) : null}
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold text-[#86efac] hover:text-white"
            >
              Open on TikTok
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MusicPlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#134e2a]/40 to-black/80">
      <svg viewBox="0 0 24 24" className="h-10 w-10 text-[#25d366]/80" fill="currentColor" aria-hidden>
        <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
      </svg>
      <span className="text-[10px] uppercase tracking-widest text-white/35">Sound</span>
    </div>
  );
}
