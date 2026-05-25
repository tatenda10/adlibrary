import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useBookmarks from '../hooks/useBookmarks.js';
import useSearch from '../hooks/useSearch.js';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { keyForVideo, storeAnalysisRecord } from '../lib/analysis-store.js';

function TikTokSaved() {
  const navigate = useNavigate();
  const { bookmarks, loading, error, removeBookmark } = useBookmarks({ autoLoad: true });
  const { runAnalysis } = useSearch();
  const [analyzingKey, setAnalyzingKey] = useState('');

  const analysisByKey = useMemo(() => {
    const next = {};

    for (const item of bookmarks) {
      if (!item?.ai_analysis) continue;
      const video = toVideoShape(item);
      const key = keyForVideo(video);
      if (!key) continue;

      next[key] = item.ai_analysis;
      storeAnalysisRecord(key, {
        video,
        analysis: item.ai_analysis,
        analyzedAt: item.created_at || new Date().toISOString(),
      });
    }

    return next;
  }, [bookmarks]);

  const handleAnalyze = async (item) => {
    const video = toVideoShape(item);
    const key = keyForVideo(video);
    if (!key) return;

    setAnalyzingKey(key);
    const result = await runAnalysis({
      url: video.url,
      caption: video.caption,
      author: video.author,
    });
    setAnalyzingKey('');

    if (!result) return;

    storeAnalysisRecord(key, {
      video,
      analysis: result,
      analyzedAt: new Date().toISOString(),
    });

    navigate(`/tiktok/analysis/${encodeURIComponent(key)}`);
  };

  const handleView = (item) => {
    const video = toVideoShape(item);
    const key = keyForVideo(video);
    if (!key) return;

    const analysis = analysisByKey[key] || item.ai_analysis;
    if (analysis) {
      storeAnalysisRecord(key, {
        video,
        analysis,
        analyzedAt: item.created_at || new Date().toISOString(),
      });
    }

    navigate(`/tiktok/analysis/${encodeURIComponent(key)}`);
  };

  return (
    <section className="space-y-4">
      {loading ? <CubeLoaderOverlay label="Loading saved videos…" minHeight="40vh" /> : null}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!loading && !error && !bookmarks.length && (
        <div className="rounded-lg p-6 text-sm app-muted" style={{ background: 'var(--app-panel)' }}>
          No saved TikTok videos yet.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {bookmarks.map((item) => {
          const video = toVideoShape(item);
          const key = keyForVideo(video);
          const hasAnalysis = Boolean(analysisByKey[key] || item.ai_analysis);
          const isAnalyzingCard = analyzingKey === key;

          return (
            <article key={item.id} className="rounded-lg p-3" style={{ background: 'var(--app-panel)' }}>
              <img
                src={item.thumbnail || 'https://placehold.co/640x880/e2e8f0/334155?text=No+Thumbnail'}
                alt={item.caption || 'Saved TikTok thumbnail'}
                className="h-[260px] w-full rounded-md object-cover"
              />

              <div className="mt-3 space-y-1">
                <h3 className="line-clamp-2 text-sm font-semibold">{item.caption || item.tiktok_url}</h3>
                <p className="text-xs app-muted">@{item.author || 'unknown'}</p>
                <p className="text-xs app-muted">
                  Views: {Number(item.views || 0).toLocaleString()} • Likes: {Number(item.likes || 0).toLocaleString()}
                </p>
                {item?.tags?.source === 'predictor' && (
                  <p className="text-xs text-indigo-600">
                    Predictor{item?.tags?.virality_score != null ? ` • Virality ${item.tags.virality_score}` : ''}
                    {item?.tags?.virality_label ? ` (${item.tags.virality_label})` : ''}
                  </p>
                )}
                {item?.tags?.note_text && (
                  <p className="line-clamp-2 text-xs app-muted">Note: {item.tags.note_text}</p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={item.tiktok_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-sm bg-white px-2.5 py-1 text-xs font-semibold text-black"
                >
                  Open
                </a>
                {!hasAnalysis && (
                  <button
                    onClick={() => handleAnalyze(item)}
                    disabled={isAnalyzingCard}
                    className="rounded-sm bg-[#dbeafe] px-2.5 py-1 text-xs font-semibold text-[#1e3a8a] disabled:opacity-60"
                  >
                    {isAnalyzingCard ? 'Analyzing...' : 'Analyze'}
                  </button>
                )}
                {hasAnalysis && (
                  <button
                    onClick={() => handleView(item)}
                    className="rounded-sm bg-black px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    View Analysis
                  </button>
                )}
                <button
                  onClick={() => removeBookmark(item.id)}
                  className="rounded-sm bg-[#fee2e2] px-2.5 py-1 text-xs font-semibold text-[#991b1b]"
                >
                  Remove
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function toVideoShape(item) {
  return {
    id: item.id,
    url: item.tiktok_url,
    tiktok_url: item.tiktok_url,
    thumbnail: item.thumbnail,
    caption: item.caption,
    author: item.author,
    views: item.views,
    likes: item.likes,
  };
}

export default TikTokSaved;
