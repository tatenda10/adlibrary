import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useBookmarks from '../hooks/useBookmarks.js';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { getAnalysisRecord, storeAnalysisRecord } from '../lib/analysis-store.js';
import { API_URL } from '../lib/api.js';

function TikTokAnalysisPage() {
  const navigate = useNavigate();
  const { key } = useParams();
  const decodedKey = decodeURIComponent(key || '');
  const [toastMessage, setToastMessage] = useState('');

  const { bookmarks, saveBookmark, removeBookmark, error: bookmarkError, loading } = useBookmarks({ autoLoad: true });

  const storedRecord = getAnalysisRecord(decodedKey);
  const bookmarkRecord = useMemo(() => {
    const item = bookmarks.find((b) => String(b.tiktok_url || '').trim() === decodedKey && b.ai_analysis);
    if (!item) return null;

    return {
      video: {
        id: item.id,
        url: item.tiktok_url,
        tiktok_url: item.tiktok_url,
        thumbnail: item.thumbnail,
        caption: item.caption,
        author: item.author,
        views: item.views,
        likes: item.likes,
      },
      analysis: item.ai_analysis,
      analyzedAt: item.created_at || new Date().toISOString(),
    };
  }, [bookmarks, decodedKey]);

  const record = storedRecord || bookmarkRecord;
  const isInstagram = isInstagramUrl(record?.video?.url) || isInstagramUrl(record?.video?.instagram_url);

  const savedBookmarks = useMemo(() => {
    if (isInstagram) return [];
    return bookmarks.filter(
      (item) => String(item.tiktok_url || '').trim() === String(record?.video?.url || '').trim(),
    );
  }, [bookmarks, record, isInstagram]);

  useEffect(() => {
    if (!storedRecord && bookmarkRecord) {
      storeAnalysisRecord(decodedKey, bookmarkRecord);
    }
  }, [storedRecord, bookmarkRecord, decodedKey]);

  useEffect(() => {
    if (!toastMessage) return undefined;

    const timer = window.setTimeout(() => {
      setToastMessage('');
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  if (!record || !record.video || !record.analysis) {
    if (loading) {
      return <CubeLoaderOverlay label="Loading analysis..." minHeight="40vh" />;
    }

    return (
      <section className="space-y-4">
        <div className="rounded-lg app-card p-6 text-sm app-muted">
          Analysis record not found. Analyze in Trending or Saved, then click View Analysis.
        </div>
        <button
          onClick={() => navigate('/tiktok/trending')}
          className="rounded bg-[#7a54f8] px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Trending
        </button>
      </section>
    );
  }

  const { video, analysis } = record;
  const ratings = analysis?.ratings || {};
  const mediaUrl = String(video?.videoStreamUrl || video?.video_stream_url || '').trim();
  const thumbnailUrl = resolveAnalysisThumbnail(video);
  const authorLabel = String(video?.author || video?.source_profile || 'unknown').replace(/^@/, '');
  const primaryTitle = video.caption || analysis.hook || 'Untitled creative';
  const quickTake = analysis.estimated_performance || analysis.viral_factor || 'No high-level summary returned.';
  const recommendations = Array.isArray(analysis.recommendations)
    ? analysis.recommendations.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  const handleSaveAnalyzed = async () => {
    if (isInstagram) return;

    if (savedBookmarks.length) {
      await Promise.all(savedBookmarks.map((item) => removeBookmark(item.id)));
      setToastMessage('Removed from Saved.');
      return;
    }

    await saveBookmark(video, analysis);
    setToastMessage('Saved, find it under the Saved tab.');
  };

  return (
    <section className="space-y-4">
      {toastMessage ? (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div className="animate-[toastFloat_220ms_ease-out] rounded-full bg-[#161616] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_34px_rgba(0,0,0,0.38)] ring-1 ring-white/8">
            {toastMessage}
          </div>
        </div>
      ) : null}

      {bookmarkError ? (
        <div className="rounded-md app-panel-soft px-3 py-2 text-xs text-rose-700">
          {bookmarkError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] app-muted">AI Analysis</p>
          <h2 className="mt-1 text-2xl font-semibold">Full Breakdown</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={video.url || '#'}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm bg-[#ef4444] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Open
          </a>
          {!isInstagram ? (
            <button
              onClick={handleSaveAnalyzed}
              className="rounded-sm bg-[#7c3aed] px-3 py-1.5 text-xs font-semibold text-white"
            >
              {savedBookmarks.length ? 'Unsave' : 'Save'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <article className="space-y-4">
          <div className="overflow-hidden rounded-md border border-white/10 bg-black">
            <div className="h-[520px] w-full overflow-hidden">
              {mediaUrl ? (
                <video
                  src={mediaUrl}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  poster={thumbnailUrl || undefined}
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={thumbnailUrl || 'https://placehold.co/640x880/e2e8f0/334155?text=No+Thumbnail'}
                  alt={video.caption || 'Creative thumbnail'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy={isInstagram ? 'no-referrer' : undefined}
                />
              )}
            </div>
          </div>

          <section className="rounded-md border border-white/10 bg-black/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] app-muted">Creative Snapshot</p>
            <h3 className="mt-2 line-clamp-4 text-lg font-semibold text-white">{primaryTitle}</h3>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
              <span>@{authorLabel}</span>
              {video.type ? <span>- {video.type}</span> : null}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <MiniMetric label="Views" value={Number(video.views || 0).toLocaleString()} />
              <MiniMetric label="Likes" value={Number(video.likes || 0).toLocaleString()} />
              <MiniMetric label="Comments" value={Number(video.comments || 0).toLocaleString()} />
              <MiniMetric label="Platform" value={isInstagram ? 'Instagram' : 'TikTok'} />
            </div>
          </section>
        </article>

        <article className="space-y-4">
          <section className="rounded-md border border-white/10 bg-black/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] app-muted">Quick Take</p>
            <p className="mt-2 text-base leading-7 text-white/90">{quickTake}</p>
          </section>

          <section className="rounded-md border border-white/10 bg-black/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] app-muted">Scorecard</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <RatingCard label="Overall" value={ratings.overall} />
              <RatingCard label="Hook" value={ratings.hook} />
              <RatingCard label="Creative" value={ratings.creative} />
              <RatingCard label="CTA" value={ratings.cta} />
              <RatingCard label="Clarity" value={ratings.clarity} />
              <RatingCard label="Scalability" value={ratings.scalability} />
            </div>
          </section>

          {recommendations.length ? (
            <section className="rounded-md border border-white/10 bg-black/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] app-muted">Priority Moves</p>
              <div className="mt-3 grid gap-2">
                {recommendations.slice(0, 5).map((item) => (
                  <div key={item} className="rounded-sm border border-white/8 bg-white/[0.02] px-3 py-3 text-sm text-white/85">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Hook" value={analysis.hook} />
            <Section title="CTA" value={analysis.cta} />
            <Section title="Structure" value={analysis.structure} />
            <Section title="Content Angle" value={analysis.content_angle} />
            <Section title="Viral Factor" value={analysis.viral_factor} />
            <Section title="Replication Tips" value={analysis.replication_tips} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Section title="Transcript" value={analysis.transcript} />
            <div className="space-y-4">
              <Section title="Estimated Performance" value={analysis.estimated_performance} />
              <Section title="Suggested Test Budget (USD)" value={analysis.suggested_test_budget_usd} />
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function RatingCard({ label, value }) {
  const score = Number(value);
  const valid = Number.isFinite(score);

  return (
    <section className="rounded-md border border-white/8 bg-black p-3">
      <p className="text-xs uppercase tracking-[0.14em] app-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{valid ? score.toFixed(1) : '0.0'} / 10</p>
    </section>
  );
}

function Section({ title, value }) {
  return (
    <section className="rounded-md border border-white/10 bg-black/70 p-4">
      <h3 className="text-xs uppercase tracking-[0.14em] app-muted">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/88">{value || 'No data returned.'}</p>
    </section>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-sm border border-white/8 bg-white/[0.02] px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function isInstagramUrl(value) {
  return /instagram\.com/i.test(String(value || ''));
}

function resolveAnalysisThumbnail(video) {
  const raw = String(video?.thumbnail || '').trim();
  if (!raw) return '';
  if (!isInstagramUrl(video?.url) && !isInstagramUrl(video?.instagram_url) && !/cdninstagram|fbcdn/i.test(raw)) {
    return raw;
  }
  return `${API_URL}/api/instagram/media-proxy?url=${encodeURIComponent(raw)}`;
}

export default TikTokAnalysisPage;
