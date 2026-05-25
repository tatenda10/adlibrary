import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBilling } from '../components/billing/BillingContext.jsx';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import useSearch from '../hooks/useSearch.js';
import useBookmarks from '../hooks/useBookmarks.js';
import { keyForVideo, storeAnalysisRecord } from '../lib/analysis-store.js';
import { createCollection, getCollection, updateCollection, isBillingOrQuotaError } from '../lib/api.js';
import { useApiToast } from '../hooks/useApiToast.js';

function TikTokTrending() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { subscription } = useBilling();
  const [keyword, setKeyword] = useState('');
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState('relevance');
  const [minViews, setMinViews] = useState('');
  const [minLikes, setMinLikes] = useState('');
  const [hookContains, setHookContains] = useState('');
  const [hookMode, setHookMode] = useState(false);
  const [intelligent, setIntelligent] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [collectionStatus, setCollectionStatus] = useState('');
  const [showSaveCollectionModal, setShowSaveCollectionModal] = useState(false);
  const [collectionToast, setCollectionToast] = useState('');
  const [analysisByKey, setAnalysisByKey] = useState({});
  const [analyzingKey, setAnalyzingKey] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [playbackErrors, setPlaybackErrors] = useState({});
  const [activeVideo, setActiveVideo] = useState(null);
  const hydratedCollectionId = useRef('');

  const { videos, isSearching, searchPlan, searchError, runSearch, runAnalysis } = useSearch();
  const { notifyApiError, notifyBillingOrApiError } = useApiToast();
  const { bookmarks, saveBookmark } = useBookmarks({ autoLoad: true });

  const savedUrls = useMemo(() => new Set(bookmarks.map((item) => item.tiktok_url)), [bookmarks]);
  const hasProAccess = Boolean(subscription?.is_pro);

  useEffect(() => {
    if (!searchError) return;
    if (isBillingOrQuotaError(searchError)) {
      notifyBillingOrApiError(searchError, 'Search failed.');
    } else {
      notifyApiError(searchError, 'Search failed.');
    }
  }, [notifyApiError, notifyBillingOrApiError, searchError]);

  useEffect(() => {
    if (videos.length) {
      localStorage.setItem('tiktok_recent_results', JSON.stringify(videos.slice(0, 20)));
    }
    setPlaybackErrors({});
  }, [videos]);

  useEffect(() => {
    if (searchPlan) {
      localStorage.setItem('tiktok_ai_plan', JSON.stringify(searchPlan));
    }
  }, [searchPlan]);

  useEffect(() => {
    if (!collectionToast) return undefined;
    const timer = window.setTimeout(() => setCollectionToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [collectionToast]);

  useEffect(() => {
    if (!activeVideo) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveVideo(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeVideo]);

  useEffect(() => {
    let cancelled = false;
    const collectionId = searchParams.get('collection') || '';
    if (!collectionId || hydratedCollectionId.current === collectionId) return undefined;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await getCollection(token, collectionId);
        const collection = data?.collection;
        if (!collection || cancelled) return;

        hydratedCollectionId.current = collectionId;
        setSelectedCollectionId(String(collection.id));
        setCollectionName(collection.name || '');
        setKeyword(collection.keyword || '');
        setLimit(Number(collection.limit || 20));
        setSortBy(collection.sortBy || 'relevance');
        setIntelligent(Boolean(collection.intelligent));
        setMinViews(String(collection.meta?.searchFilters?.minViews || ''));
        setMinLikes(String(collection.meta?.searchFilters?.minLikes || ''));
        setHookContains(collection.meta?.searchFilters?.hookContains || '');
        setHookMode(Boolean(collection.meta?.searchFilters?.hookMode));

        if (collection.keyword) {
          await runSearch(collection.keyword, {
            limit: Number(collection.limit || 20),
            sortBy: collection.sortBy || 'relevance',
            intelligent: Boolean(collection.intelligent),
            prompt: collection.prompt || collection.keyword || '',
            businessProfile: readBusinessProfile(),
            minViews: Number(collection.meta?.searchFilters?.minViews || 0),
            minLikes: Number(collection.meta?.searchFilters?.minLikes || 0),
            hookContains: collection.meta?.searchFilters?.hookContains || '',
            hookMode: Boolean(collection.meta?.searchFilters?.hookMode),
          });
        }
      } catch (err) {
        if (!cancelled) setCollectionStatus(err?.message || 'Could not load saved collection.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, runSearch, searchParams]);

  const handleSearch = async (event) => {
    event.preventDefault();

    const businessProfile = readBusinessProfile();
    const searchText = keyword.trim();
    if (intelligent && !hasProAccess) {
      navigate('/billing?checkoutPlan=pro');
      return;
    }
    const searchOptions = {
      limit: Number(limit),
      sortBy,
      intelligent,
      prompt: intelligent ? searchText : '',
      businessProfile,
      minViews: Number(minViews || 0),
      minLikes: Number(minLikes || 0),
      hookContains: hookContains.trim(),
      hookMode,
    };

    localStorage.setItem(
      'tiktok_last_search',
      JSON.stringify({
        keyword: searchText,
        ...searchOptions,
      }),
    );

    await runSearch(searchText, searchOptions);
  };

  const ensureAnalysis = async (video) => {
    const key = keyForVideo(video);
    if (!key) return null;

    if (analysisByKey[key]) {
      return analysisByKey[key];
    }

    setAnalyzingKey(key);
    const result = await runAnalysis(video);
    setAnalyzingKey('');

    if (!result) return null;

    setAnalysisByKey((prev) => ({ ...prev, [key]: result }));
    storeAnalysisRecord(key, {
      video,
      analysis: result,
      analyzedAt: new Date().toISOString(),
    });

    return result;
  };

  const handleSave = async (video) => {
    const key = keyForVideo(video);
    if (!key) return;

    setSavingKey(key);
    const analysis = await ensureAnalysis(video);
    await saveBookmark(video, analysis);
    setSavingKey('');
  };

  const handleAnalyze = async (video) => {
    if (!hasProAccess) {
      navigate('/billing?checkoutPlan=pro');
      return;
    }
    const result = await ensureAnalysis(video);
    if (!result) return;

    const key = encodeURIComponent(keyForVideo(video));
    navigate(`/tiktok/analysis/${key}`);
  };

  const handleView = (video) => {
    const key = encodeURIComponent(keyForVideo(video));
    navigate(`/tiktok/analysis/${key}`);
  };

  const handleSaveCollection = async () => {
    if (!keyword.trim()) return;

    try {
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      const payload = {
        platform: 'tiktok',
        source: 'tiktok_search',
        name: collectionName || keyword,
        keyword,
        limit,
        sortBy,
        intelligent,
        prompt: intelligent ? keyword : '',
        results: videos,
        plan: searchPlan,
        meta: {
          saved_from: 'tiktok_trending',
          searchFilters: {
            minViews: Number(minViews || 0),
            minLikes: Number(minLikes || 0),
            hookContains: hookContains.trim(),
            hookMode,
          },
        },
      };
      const data = selectedCollectionId
        ? await updateCollection(token, selectedCollectionId, payload)
        : await createCollection(token, payload);
      const entry = data?.collection;
      if (!entry) throw new Error('Collection was not returned');
      hydratedCollectionId.current = String(entry.id);
      setSelectedCollectionId(String(entry.id));
      setCollectionName(entry.name);
      setCollectionStatus(selectedCollectionId ? 'Collection updated.' : 'Search saved to collection.');
      setCollectionToast('Saved');
      setShowSaveCollectionModal(false);
      setSearchParams({ collection: String(entry.id) });
    } catch (err) {
      setCollectionStatus(err?.message || 'Failed to save collection.');
    }
  };

  const handleRenameCollection = async () => {
    if (!selectedCollectionId || !collectionName.trim()) return;
    try {
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      const data = await updateCollection(token, selectedCollectionId, { name: collectionName });
      const updated = data?.collection;
      if (!updated) return;
      setCollectionName(updated.name);
      setCollectionStatus('Collection renamed.');
    } catch (err) {
      setCollectionStatus(err?.message || 'Failed to rename collection.');
    }
  };

  return (
    <section className="space-y-4">
      <form onSubmit={handleSearch} className="space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-[220px] flex-1">
            {intelligent ? (
              <div
                className="rounded-sm px-3 py-3"
                style={{ background: 'var(--app-panel)', border: 'none' }}
              >
                <textarea
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Search for high-converting skincare ads for women 25-34 in the US"
                  className="min-h-[112px] w-full resize-none bg-transparent text-sm outline-none"
                />
                <div className="mt-2 border-t border-white/6 pt-2 text-xs text-white/55">
                  <p>With intelligent search you can just search what you want.</p>
                  <p className="mt-1">Example: “Show me winning TikTok ads for a productivity app targeting students.”</p>
                  <p className="mt-1">This will turn your request into a smarter search query to find more relevant TikTok results.</p>
                </div>
              </div>
            ) : (
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Keyword search (e.g. ai companion ads)"
                className="w-full rounded-sm px-3 py-2 text-sm"
                style={{ background: 'var(--app-panel)', border: 'none' }}
              />
            )}
          </div>

          <label
            className="inline-flex items-center gap-2 rounded-sm px-3 py-2 text-xs text-white/70"
            style={{ background: 'var(--app-panel)' }}
          >
            <input
              type="checkbox"
              checked={intelligent}
              onChange={(e) => {
                if (e.target.checked && !hasProAccess) {
                  navigate('/billing?checkoutPlan=pro');
                  return;
                }
                setIntelligent(e.target.checked);
              }}
              className="h-3.5 w-3.5 accent-[#25d366]"
            />
            Intelligent Search
          </label>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-sm px-3 py-2 text-sm"
            style={{ background: 'var(--app-panel)', border: 'none' }}
          >
            <option value={12}>12</option>
            <option value={20}>20</option>
            <option value={32}>32</option>
            <option value={40}>40</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-sm px-3 py-2 text-sm"
            style={{ background: 'var(--app-panel)', border: 'none' }}
          >
            <option value="relevance">Relevance</option>
            <option value="views">Most Views</option>
            <option value="likes">Most Likes</option>
          </select>

          <button
            type="submit"
            disabled={isSearching}
            className="rounded-sm bg-[#25d366] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {isSearching ? 'Searching...' : 'Search Videos'}
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={minViews}
            onChange={(e) => setMinViews(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="Min views"
            className="w-full rounded-sm px-3 py-2 text-sm"
            style={{ background: 'var(--app-panel)', border: 'none' }}
          />

          <input
            value={minLikes}
            onChange={(e) => setMinLikes(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="Min likes"
            className="w-full rounded-sm px-3 py-2 text-sm"
            style={{ background: 'var(--app-panel)', border: 'none' }}
          />

          <input
            value={hookContains}
            onChange={(e) => setHookContains(e.target.value)}
            placeholder="Hook contains"
            className="w-full rounded-sm px-3 py-2 text-sm"
            style={{ background: 'var(--app-panel)', border: 'none' }}
          />

          <label
            className="inline-flex items-center gap-2 rounded-sm px-3 py-2 text-xs text-white/70"
            style={{ background: 'var(--app-panel)' }}
          >
            <input
              type="checkbox"
              checked={hookMode}
              onChange={(e) => setHookMode(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#25d366]"
            />
            Hook Mode
          </label>
        </div>

        {!hasProAccess ? (
          <div className="rounded-sm border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Pro unlocks intelligent TikTok search and AI analysis for each video.
            <button
              type="button"
              onClick={() => navigate('/billing?checkoutPlan=pro')}
              className="ml-2 font-semibold text-white underline underline-offset-2"
            >
              Upgrade to Pro
            </button>
          </div>
        ) : null}

        {(videos.length > 0 || selectedCollectionId) && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCollectionName((current) => current || keyword);
                setShowSaveCollectionModal(true);
              }}
              className="rounded-sm bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white"
            >
              Save Search
            </button>
            {selectedCollectionId && (
              <button
                type="button"
                onClick={handleRenameCollection}
                disabled={!collectionName.trim()}
                className="rounded-sm bg-[#ef4444] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Rename Collection
              </button>
            )}
          </div>
        )}
      </form>

      {collectionStatus && (
        <div className="rounded-sm bg-white/5 px-3 py-2 text-xs text-white/70">
          {collectionStatus}
        </div>
      )}

      {collectionToast && (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div className="rounded-full bg-[#161616] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_34px_rgba(0,0,0,0.38)] ring-1 ring-white/8">
            {collectionToast}
          </div>
        </div>
      )}

      {showSaveCollectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-xl bg-[#111111] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
            <p className="text-sm font-semibold text-white">Enter name</p>
            <input
              autoFocus
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="My TikTok search collection"
              className="mt-3 w-full rounded-sm px-3 py-2 text-sm text-white outline-none"
              style={{ background: 'var(--app-panel)', border: 'none' }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaveCollectionModal(false)}
                className="rounded-sm bg-white/8 px-4 py-2 text-sm font-semibold text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCollection}
                disabled={!collectionName.trim()}
                className="rounded-sm bg-[#25d366] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {activeVideo ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-[2px]"
          onClick={() => setActiveVideo(null)}
        >
          <div
            className="w-full max-w-5xl rounded-2xl bg-[#0f0f10] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">{activeVideo.caption || 'TikTok video'}</p>
                <p className="mt-1 text-xs text-white/60">@{activeVideo.author || 'unknown'}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                className="rounded-sm bg-white/8 px-3 py-2 text-xs font-semibold text-white"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
              <div className="overflow-hidden rounded-xl bg-black">
                {buildTikTokEmbedUrl(activeVideo.url) ? (
                  <iframe
                    src={buildTikTokEmbedUrl(activeVideo.url)}
                    title={activeVideo.caption || 'TikTok video player'}
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    className="h-[70vh] min-h-[540px] w-full border-0"
                  />
                ) : (
                  <div className="grid h-[70vh] min-h-[540px] place-items-center px-6 text-center text-sm text-white/70">
                    This TikTok URL cannot be embedded here. Use Open to watch it on TikTok.
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-xl bg-white/4 p-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Performance</p>
                  <p className="mt-2 text-sm text-white/80">
                    Views: {Number(activeVideo.views || 0).toLocaleString()} | Likes: {Number(activeVideo.likes || 0).toLocaleString()}
                  </p>
                </div>

                {activeVideo.transcript ? (
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Transcript</p>
                    <p className="mt-2 text-sm leading-6 text-white/80">{activeVideo.transcript}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-2">
                  <a
                    href={activeVideo.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm bg-white px-3 py-2 text-xs font-semibold text-black"
                  >
                    Open on TikTok
                  </a>
                  <button
                    type="button"
                    onClick={() => handleAnalyze(activeVideo)}
                    disabled={!hasProAccess}
                    className="rounded-sm bg-[#dbeafe] px-3 py-2 text-xs font-semibold text-[#1e3a8a] disabled:opacity-60"
                  >
                    {hasProAccess ? 'Analyze this video' : 'Pro only'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {searchPlan?.rationale && (
        <div className="rounded-sm border border-[#25d366]/25 bg-[#25d366]/10 px-3 py-2 text-xs text-[#86efac]">
          {searchPlan.query ? `AI Query: ${searchPlan.query}. ` : ''}
          {searchPlan.rationale}
          {Array.isArray(searchPlan.discovery_queries) && searchPlan.discovery_queries.length > 1 ? (
            <div className="mt-2 text-[11px] text-[#bbf7d0]">
              Ran: {searchPlan.discovery_queries.join(', ')}
            </div>
          ) : null}
          {searchPlan.filters_applied ? (
            <div className="mt-1 text-[11px] text-[#bbf7d0]">
              Filters:
              {searchPlan.filters_applied.minViews ? ` min views ${Number(searchPlan.filters_applied.minViews).toLocaleString()}` : ' any views'}
              {searchPlan.filters_applied.minLikes ? `, min likes ${Number(searchPlan.filters_applied.minLikes).toLocaleString()}` : ', any likes'}
              {searchPlan.filters_applied.hookContains ? `, hook contains "${searchPlan.filters_applied.hookContains}"` : ''}
              {searchPlan.filters_applied.hookMode ? ', hook mode on' : ''}
            </div>
          ) : null}
        </div>
      )}

      {!videos.length && !isSearching && (
        <div className="grid min-h-[52vh] place-items-center">
          <div className="flex max-w-sm flex-col items-center text-center">
            <EmptySearchIcon />
            <p className="mt-8 text-3xl font-semibold text-white">Search to get started</p>
            <p className="mt-2 text-sm text-white/55">
              Use a keyword above to search TikTok videos. For country-based platform trends, open Hot Takes.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {videos.map((video) => {
          const key = keyForVideo(video);
          const hasAnalysis = Boolean(analysisByKey[key]);
          const isAnalyzingCard = analyzingKey === key;
          const isSavingCard = savingKey === key;
          const streamUrl = resolveVideoStreamUrl(video);
          const playbackFailed = Boolean(playbackErrors[key]);

          return (
            <article key={video.id} className="rounded-lg p-3" style={{ background: 'var(--app-panel)' }}>
              <div className="h-[260px] w-full overflow-hidden rounded-md bg-black">
                {streamUrl && !playbackFailed ? (
                  <video
                    src={streamUrl}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    poster={video.thumbnail || undefined}
                    className="h-full w-full bg-black object-contain"
                    onError={() =>
                      setPlaybackErrors((prev) => ({
                        ...prev,
                        [key]: 'Playback unavailable for this stream.',
                      }))
                    }
                  />
                ) : (
                  <div className="relative h-full w-full">
                    <img
                      src={video.thumbnail || 'https://placehold.co/640x880/e2e8f0/334155?text=No+Thumbnail'}
                      alt={video.caption || 'TikTok thumbnail'}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-3 bottom-3 rounded-md bg-black/72 px-3 py-2 text-xs text-white/80">
                      {playbackFailed ? playbackErrors[key] : 'Video preview unavailable. Open on TikTok.'}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-1">
                <h3 className="line-clamp-2 text-sm font-semibold ">{video.caption || 'Untitled video'}</h3>
                <p className="text-xs app-muted">@{video.author || 'unknown'}</p>
                <p className="text-xs app-muted">Views: {Number(video.views || 0).toLocaleString()} • Likes: {Number(video.likes || 0).toLocaleString()}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveVideo(video)}
                  className="rounded-sm bg-[#25d366] px-2.5 py-1 text-xs font-semibold text-black"
                >
                  Play Here
                </button>

                <a
                  href={video.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-sm bg-white px-2.5 py-1 text-xs font-semibold text-black"
                >
                  Open
                </a>

                <button
                  onClick={() => handleAnalyze(video)}
                  disabled={isAnalyzingCard || isSavingCard || !hasProAccess}
                  className="rounded-sm bg-[#dbeafe] px-2.5 py-1 text-xs font-semibold text-[#1e3a8a] disabled:opacity-60"
                >
                  {!hasProAccess ? 'Pro only' : isAnalyzingCard ? 'Analyzing...' : 'Analyze'}
                </button>

                {hasAnalysis && (
                  <button
                    onClick={() => handleView(video)}
                    className="rounded-sm bg-black px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    View
                  </button>
                )}

                <button
                  onClick={() => handleSave(video)}
                  disabled={isSavingCard}
                  className="rounded-sm bg-[#111827] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {isSavingCard ? 'Saving...' : savedUrls.has(video.url) ? 'Saved' : 'Save'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {isSearching ? (
        <CubeLoaderOverlay label="Searching TikTok videos…" fullscreen />
      ) : null}
    </section>
  );
}

function readBusinessProfile() {
  try {
    const raw = localStorage.getItem('business_profile');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function resolveVideoStreamUrl(video = {}) {
  return (
    video.videoStreamUrl ||
    video.video_stream_url ||
    video.sourceVideoStreamUrl ||
    video.source_video_stream_url ||
    ''
  );
}

function buildTikTokEmbedUrl(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';

  const match = raw.match(/\/video\/(\d+)/i);
  if (!match?.[1]) return '';

  return `https://www.tiktok.com/embed/v2/${match[1]}`;
}

function EmptySearchIcon() {
  return (
    <svg viewBox="0 0 180 120" className="h-32 w-48" fill="none">
      <circle cx="82" cy="54" r="28" stroke="#25d366" strokeWidth="10" />
      <path d="M102 74 132 104" stroke="#25d366" strokeWidth="10" strokeLinecap="round" />
      <circle cx="82" cy="54" r="8" fill="#25d366" opacity="0.9" />
    </svg>
  );
}

export default TikTokTrending;
