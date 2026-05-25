import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import {
  HASHTAG_INDUSTRIES,
  HASHTAG_TIME_RANGES,
  TREND_COUNTRY_OPTIONS,
  formatTrendCount,
} from '../components/tiktok/trendUtils.js';
import { useApiToast } from '../hooks/useApiToast.js';
import { fetchTikTokHotTakes } from '../lib/api.js';
import { TOAST_FALLBACKS } from '../lib/userFacingError.js';

const RESULT_LIMIT = 48;

export default function TikTokTrendingHashtags() {
  const { getToken } = useAuth();
  const { notifyBillingOrApiError } = useApiToast();
  const [country, setCountry] = useState('US');
  const [timeRange, setTimeRange] = useState('7');
  const [industry, setIndustry] = useState(HASHTAG_INDUSTRIES[0]);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const loadHashtags = useCallback(async () => {
    setIsLoading(true);
    setItems([]);

    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');

      const data = await fetchTikTokHotTakes(token, {
        country,
        category: 'hashtags',
        limit: RESULT_LIMIT,
        timeRange,
        industry,
      });

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      notifyBillingOrApiError(err, TOAST_FALLBACKS.unavailable);
    } finally {
      setIsLoading(false);
    }
  }, [country, getToken, industry, notifyBillingOrApiError, timeRange]);

  useEffect(() => {
    loadHashtags();
  }, [loadHashtags]);

  return (
    <section className="space-y-4">
      <div className="rounded-sm border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
        <p>
          Niche and industry signals from TikTok Creative Center — trending hashtags filtered by{' '}
          <strong className="text-white">adsHashtagIndustry</strong>. This is separate from the Creators
          chart, which does not expose niche on each row.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadHashtags();
        }}
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

        <label className="block min-w-[12rem] flex-1 sm:max-w-md">
          <span className="text-xs text-white/55">Industry</span>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
          >
            {HASHTAG_INDUSTRIES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[10rem]">
          <span className="text-xs text-white/55">Time range</span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
          >
            {HASHTAG_TIME_RANGES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-sm bg-[#25d366] px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {isLoading ? 'Loading…' : 'Search'}
        </button>
      </form>

      {isLoading ? (
        <CubeLoaderOverlay label={`Loading hashtags for ${industry}…`} minHeight="40vh" />
      ) : null}

      {!isLoading && !items.length ? (
        <div className="grid min-h-[36vh] place-items-center rounded-sm border border-white/10 bg-white/[0.02]">
          <p className="text-sm text-white/55">No hashtags returned for this industry and market.</p>
        </div>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <>
          <p className="text-xs text-white/45">
            {items.length} hashtags · {industry} · limit {RESULT_LIMIT}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((item) => (
              <HashtagTrendCard key={item.id} item={item} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function HashtagTrendCard({ item }) {
  const tag = item.name?.startsWith('#') ? item.name : `#${item.name}`;

  return (
    <article className="flex flex-col gap-2 rounded-sm border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold text-white">{tag}</p>
        <span className="shrink-0 rounded-sm bg-black/60 px-2 py-0.5 text-xs font-bold text-[#25d366]">
          #{item.rank}
        </span>
      </div>
      {item.industryName ? (
        <p className="text-[11px] text-white/45">{item.industryName}</p>
      ) : null}
      <p className="text-xs text-white/70">{formatTrendCount(item.views)} views</p>
      {item.videoCount > 0 ? (
        <p className="text-[11px] text-white/45">{formatTrendCount(item.videoCount)} posts</p>
      ) : null}
      {item.markedAsNew ? (
        <span className="w-fit rounded-sm bg-[#25d366]/90 px-1.5 py-0.5 text-[10px] font-semibold text-black">
          New
        </span>
      ) : null}
    </article>
  );
}
