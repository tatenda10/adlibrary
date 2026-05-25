import { Link } from 'react-router-dom';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import useBookmarks from '../hooks/useBookmarks.js';
import { keyForVideo } from '../lib/analysis-store.js';

function Notes() {
  const { bookmarks, loading, error } = useBookmarks({ autoLoad: true });

  const noteEntries = bookmarks
    .filter((item) => item?.tags && (item.tags.note_text || item.tags.source === 'predictor'))
    .map((item) => {
      const noteText = String(item.tags?.note_text || '').trim();
      const viralityScore = item.tags?.virality_score;
      const viralityLabel = item.tags?.virality_label;
      const key = encodeURIComponent(
        keyForVideo({
          id: item.id,
          url: item.tiktok_url,
          tiktok_url: item.tiktok_url,
        })
      );

      return {
        id: item.id,
        caption: item.caption || item.tiktok_url,
        author: item.author || 'unknown',
        tiktokUrl: item.tiktok_url,
        noteText: noteText || 'No note text provided.',
        viralityScore,
        viralityLabel,
        createdAt: item.created_at,
        analysisKey: key,
      };
    });

  return (
    <section className="space-y-4">
      <header className="rounded-lg app-card p-5">
        <p className="text-xs uppercase tracking-[0.2em] app-muted">Knowledge</p>
        <h2 className="mt-1 text-xl font-semibold">Notes</h2>
        <p className="mt-2 text-sm app-muted">
          Predictor saves appear here with your note text, virality estimate, and links to the saved analysis.
        </p>
      </header>

      {loading ? <CubeLoaderOverlay label="Loading notes…" minHeight="40vh" /> : null}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!loading && !error && !noteEntries.length && (
        <div className="rounded-lg app-card p-6 text-sm app-muted">
          No notes yet. Run Predictor, then click Save to Notes.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {noteEntries.map((entry) => (
          <article key={entry.id} className="rounded-lg app-card p-4">
            <h3 className="text-sm font-semibold">{entry.caption}</h3>
            <p className="mt-1 text-xs app-muted">@{entry.author}</p>

            <p className="mt-3 text-sm whitespace-pre-wrap">{entry.noteText}</p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded border [border-color:var(--app-border)] px-2 py-1">
                Virality: {entry.viralityScore ?? 'N/A'} {entry.viralityLabel ? `(${entry.viralityLabel})` : ''}
              </span>
              <span className="rounded border [border-color:var(--app-border)] px-2 py-1">
                Saved: {new Date(entry.createdAt).toLocaleString()}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={entry.tiktokUrl || '#'}
                target="_blank"
                rel="noreferrer"
                className="rounded border [border-color:var(--app-border)] px-2.5 py-1 text-xs font-semibold app-muted"
              >
                Open
              </a>
              <Link
                to={`/tiktok/analysis/${entry.analysisKey}`}
                className="rounded border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-600"
              >
                View Analysis
              </Link>
              <Link
                to="/tiktok/saved"
                className="rounded border border-indigo-300 px-2.5 py-1 text-xs font-semibold text-indigo-600"
              >
                Open Saved Videos
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Notes;
