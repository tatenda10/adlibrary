import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBilling } from '../components/billing/BillingContext.jsx';
import {
  API_URL,
  searchInstagram,
  intelligentSearchInstagram,
  analyzeVideo,
  getInstagramWorkspaceFolders,
  addInstagramWorkspaceVideo,
} from '../lib/api.js';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { keyForVideo, storeAnalysisRecord } from '../lib/analysis-store.js';
import folderImage from '../assets/folder.png';
import { useApiToast } from '../hooks/useApiToast.js';

const INSTAGRAM_SOURCES = [
  {
    id: 'profile_posts',
    label: 'Posts',
    helper: 'Search public profiles with the standard Instagram scraper.',
  },
  {
    id: 'reels',
    label: 'Reels',
    helper: 'Switch to the Apify Instagram reel scraper for reel-first research.',
  },
];

const IG_CONTROL =
  'h-10 min-h-10 shrink-0 rounded-sm app-input px-3 text-sm leading-none';
const IG_BUTTON =
  'inline-flex h-10 min-h-10 shrink-0 items-center justify-center rounded-sm px-4 text-sm font-medium leading-none';

function InstagramAds() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { subscription } = useBilling();
  const { notifyApiError, showWarning } = useApiToast();
  const [query, setQuery] = useState('');
  const [prompt, setPrompt] = useState('');
  const [limit, setLimit] = useState(48);
  const [sortBy, setSortBy] = useState('recent');
  const [intelligent, setIntelligent] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [sourceUrls, setSourceUrls] = useState([]);
  const [searchPlan, setSearchPlan] = useState(null);
  const [profileSeeds, setProfileSeeds] = useState([]);
  const [analysisByKey, setAnalysisByKey] = useState({});
  const [analyzingKey, setAnalyzingKey] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [drilldownProfile, setDrilldownProfile] = useState('');
  const [workspaceFolders, setWorkspaceFolders] = useState([]);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSavingFolderId, setWorkspaceSavingFolderId] = useState('');
  const [workspacePost, setWorkspacePost] = useState(null);
  const [savedWorkspaceUrls, setSavedWorkspaceUrls] = useState(() => new Set());
  const source = location.pathname.includes('/instagram/reels') ? 'reels' : 'profile_posts';
  const activeSource = INSTAGRAM_SOURCES.find((option) => option.id === source) || INSTAGRAM_SOURCES[0];
  const hasProAccess = Boolean(subscription?.is_pro);
  const filteredWorkspaceFolders = useMemo(() => {
    const q = workspaceSearch.trim().toLowerCase();
    if (!q) return workspaceFolders;
    return workspaceFolders.filter((folder) => String(folder?.name || '').toLowerCase().includes(q));
  }, [workspaceFolders, workspaceSearch]);
  const sortedResults = useMemo(() => sortInstagramResults(results, sortBy), [results, sortBy]);

  const runSearch = async (event) => {
    event.preventDefault();
    if (!(query || prompt).trim()) return;
    if (intelligent && !hasProAccess) {
      navigate('/billing?checkoutPlan=pro');
      return;
    }

    setIsSearching(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const businessProfile = readBusinessProfile();
      const data = intelligent
        ? await intelligentSearchInstagram({
            token,
            prompt: prompt || query,
            query: query || prompt,
            limit,
            businessProfile,
            source,
          })
        : await searchInstagram({ token, query, limit, source });

      setResults(Array.isArray(data?.results) ? data.results : []);
      setSourceUrls(Array.isArray(data?.sourceUrls) ? data.sourceUrls : []);
      setSearchPlan(data?.plan || null);
      setProfileSeeds(Array.isArray(data?.profileSeeds) ? data.profileSeeds : []);
    } catch (err) {
      console.error(err);
      setResults([]);
      setSourceUrls([]);
      setSearchPlan(null);
      setProfileSeeds([]);
      notifyApiError(
        err?.upgrade_prompt
          ? `${err?.message || 'Failed to fetch Instagram posts.'} ${err.upgrade_prompt}`
          : err,
        'Failed to fetch Instagram posts.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const runProfileDrilldown = async (profileSeed) => {
    const nextQuery = normalizeInstagramProfileSeed(profileSeed);
    if (!nextQuery) return;

    setIsSearching(true);
    setDrilldownProfile(nextQuery);

    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await searchInstagram({ token, query: nextQuery, limit, source });

      setQuery(nextQuery);
      setPrompt('');
      setIntelligent(false);
      setResults(Array.isArray(data?.results) ? data.results : []);
      setSourceUrls(Array.isArray(data?.sourceUrls) ? data.sourceUrls : []);
      setSearchPlan(null);
      setProfileSeeds([]);
    } catch (err) {
      console.error(err);
      setResults([]);
      setSourceUrls([]);
      setSearchPlan(null);
      setProfileSeeds([]);
      notifyApiError(err, 'Failed to drill into Instagram profile.');
    } finally {
      setIsSearching(false);
      setDrilldownProfile('');
    }
  };

  const ensureAnalysis = async (post) => {
    const key = keyForVideo(post);
    if (!key) return null;
    if (analysisByKey[key]) return analysisByKey[key];

    setAnalyzingKey(key);
    const token = await getToken();
    if (!token) throw new Error('No session token available');
    const result = await analyzeVideo(token, {
      url: post.url,
      caption: post.caption,
      author: post.author,
      transcript: '',
    });
    setAnalyzingKey('');

    if (!result) return null;

    setAnalysisByKey((prev) => ({ ...prev, [key]: result }));
    storeAnalysisRecord(key, {
      video: post,
      analysis: result,
      analyzedAt: new Date().toISOString(),
    });

    return result;
  };

  const handleAnalyze = async (post) => {
    if (!hasProAccess) {
      navigate('/billing?checkoutPlan=pro');
      return;
    }
    await ensureAnalysis(post);
  };

  const openWorkspaceModal = async (post) => {
    const contentUrl = pickInstagramContentUrl(post);
    if (!contentUrl) {
      showWarning('This Instagram result does not have a valid post URL to save.');
      return;
    }

    setWorkspaceModalOpen(true);
    setWorkspacePost(post);
    setWorkspaceSearch('');

    if (workspaceFolders.length) return;

    try {
      setWorkspaceLoading(true);
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await getInstagramWorkspaceFolders(token);
      setWorkspaceFolders(Array.isArray(data?.folders) ? data.folders : []);
    } catch (err) {
      console.error(err);
      notifyApiError(err, 'Failed to load workspace folders.');
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const handleSaveToWorkspace = async (folderId) => {
    const contentUrl = pickInstagramContentUrl(workspacePost);
    if (!contentUrl || !folderId) return;

    try {
      setWorkspaceSavingFolderId(String(folderId));
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      await addInstagramWorkspaceVideo(token, folderId, { url: contentUrl });
      setSavedWorkspaceUrls((prev) => {
        const next = new Set(prev);
        next.add(contentUrl);
        return next;
      });
      setWorkspaceModalOpen(false);
      setWorkspacePost(null);
      setSavingKey('');
    } catch (err) {
      console.error(err);
      notifyApiError(err, 'Failed to save to workspace.');
    } finally {
      setWorkspaceSavingFolderId('');
    }
  };

  const handleView = (post) => {
    const key = encodeURIComponent(keyForVideo(post));
    navigate(`/instagram/analysis/${key}`);
  };

  return (
    <section className="space-y-4">
      <form onSubmit={runSearch} className="rounded-lg p-5 space-y-4" style={{ background: 'var(--app-panel)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-300/90">
              Instagram Research
            </p>
            <p className="text-sm app-muted">
              {intelligent
                ? 'Start with a niche or competitor idea. We will surface relevant Instagram profiles, then let you drill into the ones worth studying.'
                : activeSource.helper}
            </p>
          </div>

        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              intelligent
                ? 'Brand, niche, or competitor seed like nike, ai companions, skincare founders'
                : source === 'reels'
                  ? 'Instagram username or profile URL for reels'
                  : 'Instagram username or profile URL'
            }
            className={`min-w-[260px] flex-1 ${IG_CONTROL}`}
          />

          <select
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className={IG_CONTROL}
          >
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={72}>72</option>
            <option value={96}>96</option>
          </select>

          <button
            type="button"
            onClick={() => {
              if (!intelligent && !hasProAccess) {
                navigate('/billing?checkoutPlan=pro');
                return;
              }
              setIntelligent((prev) => !prev);
              setPrompt('');
            }}
            className={`${IG_BUTTON} border text-white/85`}
            style={{
              borderColor: intelligent ? 'rgba(255,255,255,0.2)' : 'var(--app-border)',
              background: intelligent ? 'var(--app-panel-2)' : 'transparent',
            }}
          >
            Intelligent Search {intelligent ? 'On' : 'Off'}
          </button>

          <button
            type="submit"
            disabled={isSearching}
            className={`${IG_BUTTON} bg-emerald-400 text-black disabled:opacity-60`}
          >
            {isSearching ? 'Searching...' : source === 'reels' ? 'Search Reels' : 'Search'}
          </button>
        </div>

        {!hasProAccess ? (
          <div className="rounded-sm border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">
            Pro unlocks intelligent profile expansion and post analysis on Instagram.
            <button
              type="button"
              onClick={() => navigate('/billing?checkoutPlan=pro')}
              className="ml-2 font-semibold text-white underline underline-offset-2"
            >
              Upgrade to Pro
            </button>
          </div>
        ) : null}

        {intelligent ? (
          <div className="rounded-sm border p-4" style={{ borderColor: 'var(--app-border)', background: 'var(--app-panel-2)' }}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the market or brand set you want to study. Example: Find the top Instagram profiles for AI companion apps and relationship chatbots."
              className="h-28 w-full rounded-sm app-input px-3 py-3 text-sm"
            />
            <p className="mt-3 text-xs app-muted">
              Use this when you do not know the exact handle yet. The app will suggest relevant Instagram profiles you can open directly.
            </p>
          </div>
        ) : null}

        {searchPlan?.rationale ? (
          <div className="rounded-sm border p-3 text-sm" style={{ borderColor: 'rgba(52, 211, 153, 0.18)', background: 'rgba(5, 150, 105, 0.08)' }}>
            <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-300/90">Search Plan</p>
            <p className="mt-2 text-white/85">
              {searchPlan.query ? `AI lead profile: ${searchPlan.query}. ` : ''}
              {searchPlan.rationale}
            </p>
          </div>
        ) : null}

        {profileSeeds.length ? (
          <div className="space-y-2">
            <p className="text-xs app-muted">AI profile seeds</p>
            <div className="flex flex-wrap gap-2">
              {profileSeeds.map((seed) => {
                const normalizedSeed = normalizeInstagramProfileSeed(seed);
                return (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => runProfileDrilldown(seed)}
                    disabled={isSearching}
                    className="rounded-sm border px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    style={{ borderColor: 'var(--app-border)', background: 'var(--app-panel-2)' }}
                  >
                    {drilldownProfile === normalizedSeed && isSearching ? `Opening ${seed}...` : seed}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {sourceUrls.length ? (
          <div className="space-y-2">
            <p className="text-xs app-muted">Scraped profiles</p>
            <div className="flex flex-wrap gap-2">
              {sourceUrls.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => runProfileDrilldown(url)}
                  disabled={isSearching}
                  className="rounded-sm border px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  style={{ borderColor: 'var(--app-border)', background: 'var(--app-panel-2)' }}
                >
                  {formatInstagramProfileLabel(url)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </form>

      {isSearching ? <CubeLoaderOverlay label="Searching Instagram…" fullscreen /> : null}

      {!results.length && !isSearching ? (
        <div className="rounded-lg p-6 text-sm app-muted" style={{ background: 'var(--app-panel)' }}>
          Search a known Instagram profile directly, or turn on intelligent search to discover the right profiles before you drill into their content.
        </div>
      ) : null}

      {results.length ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
          style={{ background: 'var(--app-panel)' }}
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] app-muted">Profile View</p>
            <p className="mt-1 text-sm text-white/75">
              {results.length} result{results.length === 1 ? '' : 's'} loaded
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs app-muted">Sort</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className={IG_CONTROL}
            >
              <option value="recent">Recent</option>
              <option value="likes_desc">Most liked</option>
              <option value="comments_desc">Most comments</option>
              <option value="views_desc">Most viewed</option>
            </select>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sortedResults.map((post) => {
          const key = keyForVideo(post);
          const hasAnalysis = Boolean(analysisByKey[key]);
          const isAnalyzingCard = analyzingKey === key;
          const isSavingCard = savingKey === key;
          const thumbnailUrl = buildInstagramMediaUrl(post.thumbnail);

          return (
            <article key={post.id} className="rounded-lg p-3" style={{ background: 'var(--app-panel)' }}>
              <div className="h-[280px] w-full overflow-hidden rounded-md bg-slate-100/20">
                {post.video_stream_url ? (
                  <video
                    src={post.video_stream_url}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    poster={thumbnailUrl || undefined}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={thumbnailUrl || 'https://placehold.co/640x880/e2e8f0/334155?text=No+Media'}
                    alt={post.caption || 'Instagram post'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              <div className="mt-3 space-y-1">
                <h3 className="line-clamp-2 text-sm font-semibold">{post.caption || 'Instagram post'}</h3>
                <p className="text-xs app-muted">@{post.author || 'unknown'}</p>
                {post.source_profile ? (
                  <button
                    type="button"
                    onClick={() => runProfileDrilldown(post.source_profile)}
                    className="text-left text-xs text-sky-300 underline underline-offset-2"
                  >
                    Source profile: @{post.source_profile}
                  </button>
                ) : null}
                <p className="text-xs app-muted">
                  Likes: {Number(post.likes || 0).toLocaleString()} | Comments: {Number(post.comments || 0).toLocaleString()}
                </p>
                {post.views ? <p className="text-xs app-muted">Views: {Number(post.views).toLocaleString()}</p> : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={post.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-sm bg-white px-2.5 py-1 text-xs font-semibold text-black"
                >
                  Open
                </a>
                {post.source_profile ? (
                  <button
                    onClick={() => runProfileDrilldown(post.source_profile)}
                    disabled={isSearching}
                    className="rounded-sm bg-[#1f2937] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {drilldownProfile === normalizeInstagramProfileSeed(post.source_profile) && isSearching ? 'Opening...' : 'Open Profile Feed'}
                  </button>
                ) : null}
                <button
                  onClick={() => handleAnalyze(post)}
                  disabled={isAnalyzingCard || isSavingCard || !hasProAccess}
                  className="rounded-sm bg-[#dbeafe] px-2.5 py-1 text-xs font-semibold text-[#1e3a8a] disabled:opacity-60"
                >
                  {!hasProAccess ? 'Pro only' : isAnalyzingCard ? 'Analyzing...' : 'Analyze'}
                </button>
                {hasAnalysis ? (
                  <button
                    onClick={() => handleView(post)}
                    className="rounded-sm bg-black px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    View
                  </button>
                ) : null}
                <button
                  onClick={() => openWorkspaceModal(post)}
                  disabled={isSavingCard}
                  className="rounded-sm bg-[#111827] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {savedWorkspaceUrls.has(pickInstagramContentUrl(post)) ? 'Saved' : 'Save'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {workspaceModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-6xl rounded-lg p-6" style={{ background: 'var(--app-panel)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Save to workspace folder</h3>
                <p className="mt-1 text-sm app-muted">
                  Choose an Instagram workspace folder for this post or reel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWorkspaceModalOpen(false);
                  setWorkspacePost(null);
                  setWorkspaceError('');
                }}
                className="rounded-sm px-2 py-1 text-sm text-white/70"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <input
                value={workspaceSearch}
                onChange={(event) => setWorkspaceSearch(event.target.value)}
                placeholder="Search folders..."
                className="w-full rounded-sm px-3 py-2 text-sm"
                style={{ background: 'var(--app-panel-2)', border: 'none' }}
              />
            </div>

            <div className="mt-5 max-h-[620px] overflow-y-auto">
              {workspaceLoading ? (
                <p className="text-sm app-muted">Loading folders...</p>
              ) : filteredWorkspaceFolders.length ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
                  {filteredWorkspaceFolders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => handleSaveToWorkspace(folder.id)}
                      disabled={workspaceSavingFolderId === String(folder.id)}
                      className="group flex flex-col items-center text-center disabled:opacity-60"
                    >
                      <div className="flex h-[96px] w-[116px] items-center justify-center drop-shadow-[0_10px_18px_rgba(0,0,0,0.28)] transition-transform group-hover:-translate-y-1">
                        <img
                          src={folderImage}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <p className="mt-3 line-clamp-2 max-w-[160px] text-base font-medium leading-snug text-white">
                        {folder.name}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {workspaceSavingFolderId === String(folder.id)
                          ? 'Saving...'
                          : `${folder.video_count || 0} saved link${(folder.video_count || 0) === 1 ? '' : 's'}`}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm app-muted">No folders found. Create one in the Instagram workspace first.</p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/instagram/workspace')}
                className="rounded-sm bg-black px-3 py-2 text-sm font-semibold text-white"
              >
                Open Workspace
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function normalizeInstagramProfileSeed(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.replace(/^@/, '').replace(/\/+$/, '');
}

function formatInstagramProfileLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) return raw.startsWith('@') ? raw : `@${raw}`;

  try {
    const parsed = new URL(raw);
    const handle = parsed.pathname.split('/').filter(Boolean)[0] || raw;
    return handle.startsWith('@') ? handle : `@${handle}`;
  } catch {
    return raw;
  }
}

function pickInstagramContentUrl(post) {
  return String(post?.url || post?.instagram_url || '').trim();
}

function buildInstagramMediaUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return `${API_URL}/api/instagram/media-proxy?url=${encodeURIComponent(raw)}`;
}

function sortInstagramResults(items, sortBy) {
  const rows = Array.isArray(items) ? [...items] : [];
  const getTime = (item) => {
    const value = Date.parse(String(item?.timestamp || ''));
    return Number.isFinite(value) ? value : 0;
  };
  const getNumber = (value) => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };

  if (sortBy === 'likes_desc') {
    return rows.sort((a, b) => getNumber(b.likes) - getNumber(a.likes) || getTime(b) - getTime(a));
  }
  if (sortBy === 'comments_desc') {
    return rows.sort((a, b) => getNumber(b.comments) - getNumber(a.comments) || getTime(b) - getTime(a));
  }
  if (sortBy === 'views_desc') {
    return rows.sort((a, b) => getNumber(b.views) - getNumber(a.views) || getTime(b) - getTime(a));
  }
  return rows.sort((a, b) => getTime(b) - getTime(a) || getNumber(b.likes) - getNumber(a.likes));
}

function readBusinessProfile() {
  try {
    const raw = localStorage.getItem('business_profile');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default InstagramAds;
