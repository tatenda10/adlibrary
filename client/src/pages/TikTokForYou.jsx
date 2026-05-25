import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import useSearch from '../hooks/useSearch.js';
import useBookmarks from '../hooks/useBookmarks.js';
import { keyForVideo, storeAnalysisRecord } from '../lib/analysis-store.js';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { getRecentTikTokVideos } from '../lib/api.js';

function TikTokForYou() {
  const navigate = useNavigate();
  const { getToken, isSignedIn } = useAuth();
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const profile = readProfile();
  const { runAnalysis, runSearch, isSearching } = useSearch();
  const { bookmarks, saveBookmark, error: bookmarkError } = useBookmarks({ autoLoad: true });

  const [analysisByKey, setAnalysisByKey] = useState({});
  const [analyzingKey, setAnalyzingKey] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const savedUrls = useMemo(() => new Set(bookmarks.map((item) => item.tiktok_url)), [bookmarks]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecent() {
      try {
        if (!isSignedIn) {
          if (!cancelled) {
            setRecent([]);
            setLoadingRecent(false);
          }
          return;
        }

        const token = await getToken();
        if (!token) {
          if (!cancelled) {
            setRecent([]);
            setLoadingRecent(false);
          }
          return;
        }

        const videos = await getRecentTikTokVideos(token);
        if (!cancelled) {
          setRecent(pickSessionRecent(Array.isArray(videos) ? videos : []));
        }
      } catch {
        if (!cancelled) {
          setRecent([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingRecent(false);
        }
      }
    }

    loadRecent();

    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  const handleAnalyze = async (video) => {
    const key = keyForVideo(video);
    if (!key) return;

    setAnalyzingKey(key);
    const result = await runAnalysis(video);
    setAnalyzingKey('');

    if (!result) return;

    setAnalysisByKey((prev) => ({ ...prev, [key]: result }));
    storeAnalysisRecord(key, {
      video,
      analysis: result,
      analyzedAt: new Date().toISOString(),
    });

    navigate(`/tiktok/analysis/${encodeURIComponent(key)}`);
  };

  const handleSave = async (video) => {
    const key = keyForVideo(video);
    if (!key) return;

    setSavingKey(key);
    const analysis = analysisByKey[key] || null;
    await saveBookmark(video, analysis);
    setSavingKey('');
  };

  const handleSync = async () => {
    const lastSearch = readLastSearch();

    if (lastSearch?.keyword) {
      await runSearch(lastSearch.keyword, {
        limit: Number(lastSearch.limit || 20),
        sortBy: lastSearch.sortBy || 'relevance',
        intelligent: Boolean(lastSearch.intelligent),
        prompt: lastSearch.prompt || '',
        businessProfile: lastSearch.businessProfile || {},
        minViews: Number(lastSearch.minViews || 0),
        minLikes: Number(lastSearch.minLikes || 0),
        hookContains: lastSearch.hookContains || '',
        hookMode: Boolean(lastSearch.hookMode),
      });
    }

    try {
      const token = await getToken();
      if (!token) return;
      const videos = await getRecentTikTokVideos(token);
      setRecent(pickSessionRecent(Array.isArray(videos) ? videos : [], true));
    } catch {
      // Keep the current session list when refresh fails.
    }
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] app-muted">For You</p>
          <h3 className="text-2xl font-semibold">Personalized TikTok picks</h3>
          <p className="mt-1 text-xs app-muted">
            For You uses your latest Trending search results and your business context to surface a tighter shortlist of videos to review next.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSync}
          disabled={isSearching}
          className="rounded-sm bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
        >
          {isSearching ? 'Syncing...' : 'Sync'}
        </button>
      </header>

      {(profile.businessName || profile.website) && (
        <div className="rounded-lg p-4 text-sm" style={{ background: 'var(--app-panel)' }}>
          <p className="font-semibold">Business Context</p>
          <p className="mt-1">{profile.businessName || 'Business'} {profile.website ? `- ${profile.website}` : ''}</p>
          {profile.description && <p className="mt-1 text-xs app-muted">{profile.description}</p>}
        </div>
      )}

      {bookmarkError && (
        <div className="rounded-lg p-3 text-xs text-rose-700" style={{ background: 'var(--app-panel-2)' }}>
          {bookmarkError}
        </div>
      )}

      {loadingRecent ? <CubeLoaderOverlay label="Loading recent videos…" minHeight="40vh" /> : null}
      {isSearching ? <CubeLoaderOverlay label="Syncing videos…" fullscreen /> : null}

      {!recent.length && !loadingRecent && (
        <div className="rounded-lg p-6 text-sm app-muted" style={{ background: 'var(--app-panel)' }}>
          Run a search in Trending first. For You will adapt using your business profile and recent search results.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        {recent.map((item, index) => (
          <article key={(item.id || item.url || index) + '-foryou'} className="rounded-lg p-3" style={{ background: 'var(--app-panel)' }}>
            <div className="aspect-[9/14] w-full overflow-hidden rounded-md bg-slate-100/20">
              {item.videoStreamUrl ? (
                <video
                  src={item.videoStreamUrl}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  poster={item.thumbnail || undefined}
                  className="h-full w-full bg-black object-contain"
                />
              ) : (
                <img
                  src={item.thumbnail || 'https://placehold.co/640x880/e2e8f0/334155?text=No+Thumbnail'}
                  alt={item.caption || 'Recommended TikTok'}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <h3 className="mt-3 line-clamp-2 text-sm font-semibold">{item.caption || 'Recommended video'}</h3>
            <p className="mt-1 text-xs app-muted">
              {profile.niche ? `Matched to ${profile.niche} niche and your recent searches.` : 'Based on your recent searches.'}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={item.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="rounded-sm bg-[#ef4444] px-2.5 py-1 text-xs font-semibold text-white"
              >
                Open
              </a>
              <button
                onClick={() => handleAnalyze(item)}
                disabled={analyzingKey === keyForVideo(item) || savingKey === keyForVideo(item)}
                className="rounded-sm bg-[#25d366] px-2.5 py-1 text-xs font-semibold text-black disabled:opacity-60"
              >
                {analyzingKey === keyForVideo(item) ? 'Analyzing...' : 'Analyze'}
              </button>
              {analysisByKey[keyForVideo(item)] && (
                <button
                  onClick={() => navigate(`/tiktok/analysis/${encodeURIComponent(keyForVideo(item))}`)}
                  className="rounded-sm bg-[#4f46e5] px-2.5 py-1 text-xs font-semibold text-white"
                >
                  View
                </button>
              )}
              <button
                onClick={() => handleSave(item)}
                disabled={savingKey === keyForVideo(item)}
                className="rounded-sm bg-[#7c3aed] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
              >
                {savingKey === keyForVideo(item) ? 'Saving...' : savedUrls.has(item.url) ? 'Saved' : 'Save'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function pickSessionRecent(recent = [], forceRefresh = false) {
  const SESSION_KEY = 'tiktok_for_you_session_ids';
  const SESSION_LIMIT = 5;

  try {
    if (!recent.length) return [];

    if (forceRefresh) {
      sessionStorage.removeItem(SESSION_KEY);
    }

    const existing = sessionStorage.getItem(SESSION_KEY);
    const sessionIds = existing ? JSON.parse(existing) : [];
    const stableSessionIds = Array.isArray(sessionIds) ? sessionIds.slice(0, SESSION_LIMIT) : [];
    const byId = new Map(recent.map((item, index) => [videoKey(item, index), normalizeVideo(item)]));

    const selected = [];
    const selectedIds = [];
    const used = new Set();

    for (const id of stableSessionIds) {
      if (byId.has(id) && !used.has(id)) {
        selected.push(byId.get(id));
        selectedIds.push(id);
        used.add(id);
      }
    }

    for (let index = 0; index < recent.length && selected.length < SESSION_LIMIT; index += 1) {
      const id = videoKey(recent[index], index);
      if (!used.has(id)) {
        selected.push(normalizeVideo(recent[index]));
        selectedIds.push(id);
        used.add(id);
      }
    }

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(selectedIds));
    return selected;
  } catch {
    return [];
  }
}

function normalizeVideo(item) {
  return {
    ...item,
    id: item.id ?? '',
    url: item.url ?? item.tiktok_url ?? '',
    thumbnail: item.thumbnail ?? item.cover ?? '',
    videoStreamUrl: item.videoStreamUrl ?? item.video_stream_url ?? '',
    caption: item.caption ?? item.desc ?? item.text ?? '',
  };
}

function videoKey(item, index) {
  return String(item.id || item.url || item.tiktok_url || `for-you-${index}`);
}

function readProfile() {
  try {
    const raw = localStorage.getItem('business_profile');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readLastSearch() {
  try {
    const raw = localStorage.getItem('tiktok_last_search');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default TikTokForYou;
