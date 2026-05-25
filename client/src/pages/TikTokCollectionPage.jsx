import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate, useParams } from 'react-router-dom';
import useSearch from '../hooks/useSearch.js';
import useBookmarks from '../hooks/useBookmarks.js';
import { buildTikTokStreamUrl, deleteCollection, duplicateCollection, extractTikTokStreamSourceUrl, getCollection, updateCollection } from '../lib/api.js';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { keyForVideo, storeAnalysisRecord } from '../lib/analysis-store.js';

function resolveTikTokEmbedUrl(video) {
  const directId = String(video?.id || '').trim();
  if (/^\d{8,}$/.test(directId)) {
    return `https://www.tiktok.com/player/v1/${directId}?controls=1&music_info=0&description=0`;
  }

  const rawUrl = String(video?.url || video?.tiktok_url || '').trim();
  if (!rawUrl) return '';

  const match = rawUrl.match(/\/video\/(\d{8,})/i);
  if (!match) return '';

  return `https://www.tiktok.com/player/v1/${match[1]}?controls=1&music_info=0&description=0`;
}

function TikTokCollectionPage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [renameStatus, setRenameStatus] = useState('');
  const [analysisByKey, setAnalysisByKey] = useState({});
  const [analyzingKey, setAnalyzingKey] = useState('');
  const [savingKey, setSavingKey] = useState('');

  const { runAnalysis } = useSearch();
  const { bookmarks, saveBookmark } = useBookmarks({ autoLoad: true });
  const savedUrls = useMemo(() => new Set(bookmarks.map((item) => item.tiktok_url)), [bookmarks]);
  const videos = useMemo(
    () =>
      (Array.isArray(collection?.results) ? collection.results : []).map((video) => {
        const sourceVideoStreamUrl = String(
          extractTikTokStreamSourceUrl(
            video.sourceVideoStreamUrl ||
              video.source_video_stream_url ||
              video.videoStreamUrl ||
              video.video_stream_url ||
              ''
          )
        ).trim();

        return {
          ...video,
          sourceVideoStreamUrl,
          source_video_stream_url: sourceVideoStreamUrl,
          videoStreamUrl: buildTikTokStreamUrl(sourceVideoStreamUrl),
          video_stream_url: buildTikTokStreamUrl(sourceVideoStreamUrl),
          embedUrl: resolveTikTokEmbedUrl(video),
        };
      }),
    [collection?.results]
  );

  useEffect(() => {
    if (!videos.length) return;

    console.groupCollapsed('[TikTokCollectionPage] Saved collection video URLs');
    videos.forEach((video, index) => {
      console.log(`Video ${index + 1}`, {
        id: video.id,
        caption: video.caption,
        tiktokUrl: video.url || video.tiktok_url || '',
        sourceVideoStreamUrl: video.sourceVideoStreamUrl || video.source_video_stream_url || '',
        proxiedVideoStreamUrl: video.videoStreamUrl || video.video_stream_url || '',
      });
    });
    console.groupEnd();
  }, [videos]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token || !id) return;
        const data = await getCollection(token, id);
        if (!cancelled) {
          setCollection(data?.collection || null);
          setName(data?.collection?.name || '');
        }
      } catch (err) {
        if (!cancelled) setRenameStatus(err?.message || 'Failed to load collection.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id]);

  useEffect(() => {
    if (!renameStatus) return undefined;
    const timer = window.setTimeout(() => setRenameStatus(''), 2200);
    return () => window.clearTimeout(timer);
  }, [renameStatus]);

  const ensureAnalysis = async (video) => {
    const key = keyForVideo(video);
    if (!key) return null;
    if (analysisByKey[key]) return analysisByKey[key];

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

  const handleAnalyze = async (video) => {
    const result = await ensureAnalysis(video);
    if (!result) return;
    navigate(`/tiktok/analysis/${encodeURIComponent(keyForVideo(video))}`);
  };

  const handleView = (video) => {
    navigate(`/tiktok/analysis/${encodeURIComponent(keyForVideo(video))}`);
  };

  const handleSave = async (video) => {
    const key = keyForVideo(video);
    if (!key) return;
    setSavingKey(key);
    const analysis = analysisByKey[key] || null;
    await saveBookmark(video, analysis);
    setSavingKey('');
  };

  const handleRename = () => {
    if (!collection?.id || !name.trim()) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Session token unavailable');
        const data = await updateCollection(token, collection.id, { name });
        const updated = data?.collection;
        if (!updated) return;
        setCollection(updated);
        setName(updated.name);
        setRenameStatus('Collection renamed.');
      } catch (err) {
        setRenameStatus(err?.message || 'Failed to rename collection.');
      }
    })();
  };

  const handleArchive = async () => {
    if (!collection?.id) return;
    try {
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      await updateCollection(token, collection.id, { is_archived: true });
      navigate('/tiktok/collections');
    } catch (err) {
      setRenameStatus(err?.message || 'Failed to archive collection.');
    }
  };

  const handleDuplicate = async () => {
    if (!collection?.id) return;
    try {
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      const data = await duplicateCollection(token, collection.id);
      if (data?.collection?.id) navigate(`/tiktok/collections/${data.collection.id}`);
    } catch (err) {
      setRenameStatus(err?.message || 'Failed to duplicate collection.');
    }
  };

  const handleDelete = async () => {
    if (!collection?.id) return;
    try {
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      await deleteCollection(token, collection.id);
      navigate('/tiktok/collections');
    } catch (err) {
      setRenameStatus(err?.message || 'Failed to delete collection.');
    }
  };

  if (loading) {
    return <CubeLoaderOverlay label="Loading collection…" minHeight="40vh" />;
  }

  if (!collection) {
    return (
      <section className="space-y-4">
        <div className="rounded-lg p-6 text-sm app-muted" style={{ background: 'var(--app-panel)' }}>
          Collection not found.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] app-muted">Searched Folder</p>
          <h2 className="text-2xl font-semibold text-white">{collection.name}</h2>
          <p className="mt-1 text-xs app-muted">
            Stored results for "{collection.keyword}". This page loads the saved video URLs directly without rerunning the search.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-w-[240px] flex-1 rounded-sm px-3 py-2 text-sm"
            style={{ background: 'var(--app-panel)', border: 'none' }}
            placeholder="Collection name"
          />
          <button
            type="button"
            onClick={handleRename}
            disabled={!name.trim()}
            className="rounded-sm bg-[#ef4444] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            className="rounded-sm bg-white/10 px-4 py-2 text-sm font-semibold text-white"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={handleArchive}
            className="rounded-sm bg-amber-500/80 px-4 py-2 text-sm font-semibold text-black"
          >
            Archive
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-sm bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Delete
          </button>
        </div>

        {renameStatus ? (
          <div className="rounded-sm bg-white/5 px-3 py-2 text-xs text-white/70">{renameStatus}</div>
        ) : null}

        {collection.plan?.rationale ? (
          <div className="rounded-sm border border-[#25d366]/25 bg-[#25d366]/10 px-3 py-2 text-xs text-[#86efac]">
            {collection.plan.query ? `AI Query: ${collection.plan.query}. ` : ''}
            {collection.plan.rationale}
          </div>
        ) : null}
      </header>

      {!videos.length ? (
        <div className="rounded-lg p-6 text-sm app-muted" style={{ background: 'var(--app-panel)' }}>
          This collection does not have saved video results yet.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {videos.map((video, index) => {
          const key = keyForVideo(video) || `collection-video-${index}`;
          const hasAnalysis = Boolean(analysisByKey[key]);
          const isAnalyzingCard = analyzingKey === key;
          const isSavingCard = savingKey === key;

          return (
            <article key={key} className="rounded-lg p-3" style={{ background: 'var(--app-panel)' }}>
              <div className="h-[260px] w-full overflow-hidden rounded-md bg-black">
                {video.videoStreamUrl ? (
                  <video
                    src={video.videoStreamUrl}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    poster={video.thumbnail || undefined}
                    onLoadedMetadata={(event) => {
                      console.log('[TikTokCollectionPage] video loaded metadata', {
                        id: video.id,
                        currentSrc: event.currentTarget.currentSrc,
                        tiktokUrl: video.url || video.tiktok_url || '',
                        sourceVideoStreamUrl: video.sourceVideoStreamUrl || video.source_video_stream_url || '',
                        proxiedVideoStreamUrl: video.videoStreamUrl || video.video_stream_url || '',
                      });
                    }}
                    onError={(event) => {
                      const mediaError = event.currentTarget.error;
                      console.error('[TikTokCollectionPage] video playback error', {
                        id: video.id,
                        currentSrc: event.currentTarget.currentSrc,
                        tiktokUrl: video.url || video.tiktok_url || '',
                        sourceVideoStreamUrl: video.sourceVideoStreamUrl || video.source_video_stream_url || '',
                        proxiedVideoStreamUrl: video.videoStreamUrl || video.video_stream_url || '',
                        mediaError: mediaError
                          ? {
                              code: mediaError.code,
                              message: mediaError.message || '',
                            }
                          : null,
                      });
                    }}
                    className="h-full w-full bg-black object-contain"
                  />
                ) : video.embedUrl ? (
                  <iframe
                    src={video.embedUrl}
                    title={video.caption || 'TikTok video'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full border-0 bg-black"
                  />
                ) : (
                  <img
                    src={video.thumbnail || 'https://placehold.co/640x880/e2e8f0/334155?text=No+Thumbnail'}
                    alt={video.caption || 'TikTok thumbnail'}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="mt-3 space-y-1">
                <h3 className="line-clamp-2 text-sm font-semibold">{video.caption || 'Untitled video'}</h3>
                <p className="text-xs app-muted">@{video.author || 'unknown'}</p>
                <p className="text-xs app-muted">
                  Views: {Number(video.views || 0).toLocaleString()} • Likes: {Number(video.likes || 0).toLocaleString()}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
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
                  disabled={isAnalyzingCard || isSavingCard}
                  className="rounded-sm bg-[#dbeafe] px-2.5 py-1 text-xs font-semibold text-[#1e3a8a] disabled:opacity-60"
                >
                  {isAnalyzingCard ? 'Analyzing...' : 'Analyze'}
                </button>
                {hasAnalysis ? (
                  <button
                    onClick={() => handleView(video)}
                    className="rounded-sm bg-black px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    View
                  </button>
                ) : null}
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
    </section>
  );
}

export default TikTokCollectionPage;
