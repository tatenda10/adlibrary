import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { TREND_COUNTRY_OPTIONS, formatTrendCount } from '../components/tiktok/trendUtils.js';
import {
  TOP_ADS_FORMATS,
  TOP_ADS_INDUSTRIES,
  TOP_ADS_OBJECTIVES,
  TOP_ADS_ORDER_BY,
  TOP_ADS_PERIODS,
  filterAndSortTopAds,
  formatCtr,
} from '../components/tiktok/topAdsUtils.js';
import { readTopAdsSession, topAdsFilterKey, writeTopAdsSession } from '../lib/topAdsSessionCache.js';
import {
  getTopAds,
  refreshTopAds,
  resolveTopAdPlaybackUrl,
  resolveTopAdThumbnailUrl,
} from '../lib/api.js';
import { useApiToast } from '../hooks/useApiToast.js';

const TOP_ADS_LIMIT = 48;

export default function TikTokHotTakes() {
  const { getToken } = useAuth();
  const { notifyBillingOrApiError } = useApiToast();
  const [country, setCountry] = useState('US');
  const [industry, setIndustry] = useState('');
  const [objective, setObjective] = useState('');
  const [period, setPeriod] = useState('7');
  const [adFormat, setAdFormat] = useState('');
  const [orderBy, setOrderBy] = useState('for_you');
  const [sourceAdItems, setSourceAdItems] = useState([]);
  const [scrapeFilterKey, setScrapeFilterKey] = useState('');
  const [adFetchedAt, setAdFetchedAt] = useState('');
  const [adIsFresh, setAdIsFresh] = useState(true);
  const [adLoading, setAdLoading] = useState(true);
  const [adRefreshing, setAdRefreshing] = useState(false);
  const filterKey = useMemo(
    () => topAdsFilterKey({ country, industry, objective, period, adFormat, orderBy }),
    [country, industry, objective, period, adFormat, orderBy]
  );

  const filteredAdItems = useMemo(
    () =>
      filterAndSortTopAds(sourceAdItems, {
        country,
        industry,
        objective,
        adFormat,
        orderBy,
      }),
    [sourceAdItems, country, industry, objective, adFormat, orderBy]
  );

  const needsRefreshForPeriod =
    Boolean(sourceAdItems.length) &&
    Boolean(scrapeFilterKey) &&
    scrapeFilterKey.split('|')[3] !== period;

  const applyAdPayload = useCallback((data, key, sourceLabel = 'api') => {
    const items = Array.isArray(data?.items) ? data.items : [];
    setSourceAdItems(items);
    setScrapeFilterKey(key);
    setAdFetchedAt(data?.fetched_at || '');
    setAdIsFresh(Boolean(data?.is_fresh));

    if (items.length > 0) {
      writeTopAdsSession(key, {
        items,
        fetched_at: data?.fetched_at || '',
        is_fresh: Boolean(data?.is_fresh),
      });
    }

    console.log(`[hot takes] payload source: ${sourceLabel}`);

    if (data?.playback_audit) {
      console.group('[hot takes] cache playback audit (from DB)');
      console.log('hint:', data.playback_audit.hint);
      console.log('raw rows in DB:', data.playback_audit.raw);
      console.log('after normalize:', data.playback_audit.normalized);
      console.groupEnd();
    }

    if (items.length > 0) {
      console.group('[hot takes] items loaded for playback');
      items.slice(0, 8).forEach((row) => {
        const raw = row.videoUrlHd || row.videoUrl || '';
        console.log(`#${row.rank}`, {
          id: row.id,
          hasVideoUrl: Boolean(raw),
          fullVideoUrlLength: raw.length,
          hasThumbnail: Boolean(row.thumbnail),
          hasLocalPlayback: Boolean(row.playbackUrl),
          playbackUrl: row.playbackUrl || '(none)',
          videoHost: (() => {
            try {
              return raw ? new URL(raw).hostname : '';
            } catch {
              return '';
            }
          })(),
          rawPreview: raw ? `${raw.slice(0, 80)}…` : '(empty)',
        });
      });
      console.groupEnd();
    }
  }, []);

  const loadTopAdsInitial = useCallback(async () => {
    const key = topAdsFilterKey({
      country,
      industry,
      objective,
      period,
      adFormat,
      orderBy,
    });

    setAdLoading(true);

    const sessionPayload = readTopAdsSession(key);
    if (sessionPayload?.items?.length) {
      applyAdPayload(sessionPayload, key, 'sessionStorage');
    }

    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');

      const data = await getTopAds(token, {
        country,
        industry,
        objective,
        period,
        adFormat,
        orderBy,
      });

      const incoming = Array.isArray(data?.items) ? data.items : [];
      if (incoming.length > 0) {
        applyAdPayload(data, data?.filter_key || key, 'api-cache');
      } else if (!sessionPayload?.items?.length) {
        applyAdPayload({ ...data, items: [] }, key, 'api-empty');
      }
    } catch (err) {
      if (!sessionPayload?.items?.length) {
        setSourceAdItems([]);
        setScrapeFilterKey('');
        setAdFetchedAt('');
        setAdIsFresh(false);
      }
      notifyBillingOrApiError(err, 'Could not load top ads. Please try again.');
    } finally {
      setAdLoading(false);
    }
  }, [adFormat, applyAdPayload, country, getToken, industry, notifyBillingOrApiError, objective, orderBy, period]);

  const refreshTopAdsLive = async () => {
    setAdRefreshing(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');

      const data = await refreshTopAds(token, {
        country,
        industry,
        objective,
        period,
        adFormat,
        orderBy,
        limit: TOP_ADS_LIMIT,
      });

      applyAdPayload(data, filterKey, 'refresh');
    } catch (err) {
      notifyBillingOrApiError(err, 'Could not refresh top ads. Please try again in a few minutes.');
    } finally {
      setAdRefreshing(false);
    }
  };

  useEffect(() => {
    loadTopAdsInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    refreshTopAdsLive();
  };

  const busy = adLoading || adRefreshing;
  const loaderLabel = adRefreshing
    ? `Refreshing top ads for ${country}…`
    : `Loading top ads for ${country}…`;

  const noMatches = !busy && sourceAdItems.length > 0 && filteredAdItems.length === 0;
  const emptyPool = !busy && sourceAdItems.length === 0;

  return (
    <section className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-sm p-4"
        style={{ background: 'var(--app-panel)' }}
      >
        <label className="block min-w-[10rem] flex-1 sm:max-w-[11rem]">
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

        <label className="block min-w-[10rem] flex-1 sm:max-w-[12rem]">
          <span className="text-xs text-white/55">Industry</span>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
          >
            {TOP_ADS_INDUSTRIES.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[9rem]">
          <span className="text-xs text-white/55">Objective</span>
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
          >
            {TOP_ADS_OBJECTIVES.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[8rem]">
          <span className="text-xs text-white/55">Period</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
          >
            {TOP_ADS_PERIODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[9rem]">
          <span className="text-xs text-white/55">Format</span>
          <select
            value={adFormat}
            onChange={(e) => setAdFormat(e.target.value)}
            className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
          >
            {TOP_ADS_FORMATS.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[9rem]">
          <span className="text-xs text-white/55">Sort</span>
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
            className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
          >
            {TOP_ADS_ORDER_BY.map((item) => (
              <option key={item.value} value={item.value}>
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
          {adRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </form>

      {needsRefreshForPeriod && !busy ? (
        <p className="text-xs text-white/50">
          Time period changed — click <strong className="font-semibold text-white/70">Refresh</strong> to
          fetch ads for that range from TikTok.
        </p>
      ) : null}

      {noMatches ? (
        <p className="text-xs text-white/50">
          No ads in the current list match these filters ({sourceAdItems.length} loaded). Try different
          filters or click <strong className="font-semibold text-white/70">Refresh</strong> to scrape with
          these settings.
        </p>
      ) : null}

      {busy ? <CubeLoaderOverlay label={loaderLabel} minHeight="40vh" /> : null}

      {emptyPool ? (
        <div className="grid min-h-[36vh] place-items-center rounded-sm border border-white/10 bg-white/[0.02]">
          <p className="text-center text-sm text-white/55">
            No ads loaded yet.
            <br />
            <span className="text-white/40">Click Refresh to fetch top ads from TikTok Creative Center.</span>
          </p>
        </div>
      ) : null}

      {!busy && filteredAdItems.length > 0 ? (
        <p className="text-xs text-white/45">
          Showing {filteredAdItems.length} of {sourceAdItems.length} loaded
          {adFetchedAt && adIsFresh ? ` · updated ${new Date(adFetchedAt).toLocaleString()}` : ''}
        </p>
      ) : null}

      {!busy && filteredAdItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredAdItems.map((item) => (
            <TopAdCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TopAdCard({ item }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [useCdnFallback, setUseCdnFallback] = useState(false);
  const rawVideoUrl = item.videoUrlHd || item.videoUrl || '';
  const localPlayback = resolveTopAdPlaybackUrl(item);
  const thumbSrc = resolveTopAdThumbnailUrl(item);
  const videoSrc = useCdnFallback ? rawVideoUrl : localPlayback;
  const showVideo = Boolean(videoSrc) && !videoFailed;
  const showImage = thumbSrc && !imgFailed && (!showVideo || videoFailed);

  const handleVideoError = () => {
    if (!useCdnFallback && item.playbackUrl && rawVideoUrl) {
      console.warn(`[hot takes] #${item.rank} local cache failed, trying CDN URL`, {
        playbackUrl: item.playbackUrl,
        rawVideoUrl: rawVideoUrl.slice(0, 100),
      });
      setUseCdnFallback(true);
      return;
    }
    console.warn(`[hot takes] #${item.rank} video playback failed`, {
      videoSrc: videoSrc?.slice(0, 100),
      hasThumbnail: Boolean(thumbSrc),
      hasLocalPlayback: Boolean(item.playbackUrl),
    });
    setVideoFailed(true);
  };

  const ctrLabel = formatCtr(item.ctr);
  const watchUrl = item.videoUrl || item.videoUrlHd;

  return (
    <article className="flex flex-col overflow-hidden rounded-sm border border-white/10 bg-white/[0.02]">
      <div className="relative aspect-[9/14] w-full overflow-hidden bg-black/40">
        {showVideo ? (
          <video
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
            poster={thumbSrc || undefined}
            src={videoSrc}
            onError={handleVideoError}
          />
        ) : showImage ? (
          <img
            src={thumbSrc}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#134e2a]/30 to-black/80 text-xs text-white/40">
            Ad
          </div>
        )}
        <span className="pointer-events-none absolute left-2 top-2 rounded-sm bg-black/75 px-2 py-0.5 text-xs font-bold text-[#25d366]">
          #{item.rank}
        </span>
        {item.budgetLevel ? (
          <span className="pointer-events-none absolute right-2 top-2 rounded-sm bg-black/75 px-1.5 py-0.5 text-[10px] text-white/80">
            {item.budgetLevel} spend
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{item.name}</p>
        {item.brandName && item.brandName !== item.name ? (
          <p className="truncate text-xs text-white/55">{item.brandName}</p>
        ) : null}
        <p className="text-[11px] text-white/55">
          {formatTrendCount(item.likes)} likes
          {ctrLabel ? ` · ${ctrLabel}` : ''}
        </p>
        {item.landingPageUrl ? (
          <a
            href={item.landingPageUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate text-[11px] text-white/45 hover:text-white"
          >
            Landing page
          </a>
        ) : null}
        {watchUrl ? (
          <a
            href={watchUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-auto pt-2 text-[11px] font-semibold text-[#86efac] hover:text-white"
          >
            Open video URL
          </a>
        ) : null}
      </div>
    </article>
  );
}
