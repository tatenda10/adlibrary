import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { analyzeVideo } from '../lib/api.js';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import useBookmarks from '../hooks/useBookmarks.js';
import { useApiToast } from '../hooks/useApiToast.js';

function TikTokPredictor() {
  const { getToken } = useAuth();
  const { notifyApiError, showWarning } = useApiToast();
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [durationSec, setDurationSec] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const { saveBookmark, error: bookmarkError } = useBookmarks({ autoLoad: false });
  const [result, setResult] = useState(null);

  const fileMeta = useMemo(() => {
    if (!file) return null;
    return {
      name: file.name,
      type: file.type || 'unknown',
      sizeMb: (file.size / (1024 * 1024)).toFixed(2),
      durationSec: durationSec ? durationSec.toFixed(1) : 'unknown',
    };
  }, [file, durationSec]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(nextFile);
    setDurationSec(0);
    setResult(null);
    setSavedOk(false);

    if (!nextFile) {
      setPreviewUrl('');
      return;
    }

    const nextPreview = URL.createObjectURL(nextFile);
    setPreviewUrl(nextPreview);
  };

  const handleAnalyze = async (event) => {
    event.preventDefault();
    setResult(null);

    const url = String(tiktokUrl || '').trim();
    if (!url && !fileMeta) {
      showWarning('Provide a TikTok link or upload a video.');
      return;
    }

    const sourceParts = [];
    if (url) sourceParts.push(`TikTok URL: ${url}`);
    if (fileMeta) {
      sourceParts.push(
        `Upload metadata: filename=${fileMeta.name}, mime=${fileMeta.type}, size_mb=${fileMeta.sizeMb}, duration_sec=${fileMeta.durationSec}`
      );
    }
    if (notes.trim()) sourceParts.push(`User notes: ${notes.trim()}`);

    const hasRemoteVideo = /^https?:\/\//i.test(url);
    const payload = {
      id: `predictor-${Date.now()}`,
      url: url || `uploaded://${fileMeta?.name || 'video'}`,
      caption: notes.trim() || 'Uploaded ad creative',
      author: 'predictor-user',
      transcript: notes.trim(),
      sourceContext: sourceParts.join(' | '),
      videoStreamUrl: hasRemoteVideo ? previewUrl || '' : '',
    };

    setIsAnalyzing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const analysis = await analyzeVideo(token, payload);
      setResult({
        video: payload,
        analysis,
      });
    } catch (err) {
      console.error(err);
      notifyApiError(err, 'Failed to analyze this ad.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analysis = result?.analysis || null;
  const ratings = analysis?.ratings || {};

  const handleSave = async () => {
    if (!result?.analysis || !result?.video) return;

    setIsSaving(true);
    setSavedOk(false);
    const sourceLabel = String(result.video.url || '').startsWith('uploaded://') ? 'upload' : 'tiktok_link';

    const response = await saveBookmark(
      {
        ...result.video,
        tags: {
          source: 'predictor',
          source_label: sourceLabel,
          note_text: notes.trim() || null,
          virality_score: result.analysis.virality_score ?? null,
          virality_label: result.analysis.virality_label || null,
        },
      },
      result.analysis
    );

    setSavedOk(Boolean(response?.ok));
    setIsSaving(false);
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg p-5" style={{ background: 'var(--app-panel)' }}>
        <h2 className="text-lg font-semibold">Predictor</h2>
        <p className="mt-2 text-sm app-muted">
          Upload a creative or paste a TikTok link to get a fast ad rating, virality prediction, and improvement recommendations.
        </p>
      </div>

      <form onSubmit={handleAnalyze} className="rounded-lg p-5 space-y-4" style={{ background: 'var(--app-panel)' }}>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-semibold">TikTok Link</span>
            <input
              value={tiktokUrl}
              onChange={(event) => setTiktokUrl(event.target.value)}
              placeholder="https://www.tiktok.com/@user/video/..."
              className="w-full rounded-sm px-3 py-2 text-sm"
              style={{ background: 'var(--app-panel-2)', border: 'none' }}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-semibold">Upload Video</span>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="w-full rounded-sm px-3 py-2 text-sm"
              style={{ background: 'var(--app-panel-2)', border: 'none' }}
            />
          </label>
        </div>

        <label className="block space-y-2 text-sm">
          <span className="font-semibold">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What is the goal, audience, and offer?"
            className="h-24 w-full rounded-sm px-3 py-2 text-sm"
            style={{ background: 'var(--app-panel-2)', border: 'none' }}
          />
        </label>

        {fileMeta && (
          <div className="rounded-sm p-3 text-xs" style={{ background: 'var(--app-panel-2)' }}>
            File: {fileMeta.name} | {fileMeta.type} | {fileMeta.sizeMb} MB | Duration: {fileMeta.durationSec}s
          </div>
        )}

        <button
          type="submit"
          disabled={isAnalyzing}
          className="rounded-sm bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze & Predict'}
        </button>

      </form>

      {isAnalyzing ? <CubeLoaderOverlay label="Analyzing video…" fullscreen /> : null}

      {(previewUrl || analysis) && (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <article className="rounded-lg p-3" style={{ background: 'var(--app-panel)' }}>
            <div className="h-[520px] w-full overflow-hidden rounded-md bg-slate-100">
              {previewUrl ? (
                <video
                  src={previewUrl}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(event) => setDurationSec(event.currentTarget.duration || 0)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center px-4 text-center text-xs app-muted">
                  Uploaded video preview appears here.
                </div>
              )}
            </div>
          </article>

          {analysis ? (
            <article className="rounded-lg p-4" style={{ background: 'var(--app-panel)' }}>
              <p className="text-xs uppercase tracking-[0.16em] app-muted">Predictor Result</p>
              <h3 className="mt-1 text-xl font-semibold">Ad Rating + Virality Forecast</h3>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Virality Score" value={`${Number(analysis.virality_score || 0).toFixed(0)} / 100`} />
                <MetricCard label="Virality Tier" value={analysis.virality_label || 'Unknown'} />
                <MetricCard label="Overall" value={`${Number(ratings.overall || 0).toFixed(1)} / 10`} />
                <MetricCard label="Hook" value={`${Number(ratings.hook || 0).toFixed(1)} / 10`} />
              </div>

              <div className="mt-4 grid gap-3">
                <Section title="Estimated Performance" value={analysis.estimated_performance} />
                <Section title="Hook" value={analysis.hook} />
                <Section title="Structure" value={analysis.structure} />
                <Section title="CTA" value={analysis.cta} />
                <Section title="Viral Factor" value={analysis.viral_factor} />
                <Section title="Suggested Test Budget (USD)" value={analysis.suggested_test_budget_usd} />
                <section className="rounded-sm p-3" style={{ background: 'var(--app-panel-2)' }}>
                  <h4 className="text-xs uppercase tracking-[0.14em] app-muted">Recommendations</h4>
                  <div className="mt-2 space-y-1">
                    {(analysis.recommendations || []).length ? (
                      analysis.recommendations.map((item, index) => (
                        <p key={`${item}-${index}`} className="text-sm">- {item}</p>
                      ))
                    ) : (
                      <p className="text-sm">No recommendations returned.</p>
                    )}
                  </div>
                </section>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-sm bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : 'Save to Notes + Saved Videos'}
                </button>
                {savedOk && <p className="text-xs text-emerald-600">Saved successfully.</p>}
                {bookmarkError && <p className="text-xs text-rose-600">{bookmarkError}</p>}
              </div>
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value }) {
  return (
    <section className="rounded-sm p-3" style={{ background: 'var(--app-panel-2)' }}>
      <p className="text-xs uppercase tracking-[0.14em] app-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </section>
  );
}

function Section({ title, value }) {
  return (
    <section className="rounded-sm p-3" style={{ background: 'var(--app-panel-2)' }}>
      <h4 className="text-xs uppercase tracking-[0.14em] app-muted">{title}</h4>
      <p className="mt-1 text-sm whitespace-pre-wrap">{value || 'No data returned.'}</p>
    </section>
  );
}

export default TikTokPredictor;
