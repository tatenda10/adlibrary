import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import useBookmarks from '../hooks/useBookmarks.js';

function Bookmarks() {
  const { bookmarks, loading, error, removeBookmark } = useBookmarks({ autoLoad: true });

  return (
    <section className="space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] app-muted">Library</p>
        <h3 className="mt-1 text-xl font-semibold">Saved Bookmarks</h3>
      </header>

      {loading ? <CubeLoaderOverlay label="Loading bookmarks…" minHeight="40vh" /> : null}
      {error && <p className="text-sm text-rose-500">{error}</p>}

      {!loading && !error && !bookmarks.length && (
        <div className="app-card p-8 text-center text-sm app-muted">No bookmarks yet.</div>
      )}

      {!loading && !error && bookmarks.length > 0 && (
        <div className="space-y-3">
          {bookmarks.map((bookmark) => (
            <article key={bookmark.id} className="app-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold">{bookmark.caption || bookmark.tiktok_url}</h4>
                  <p className="text-xs app-muted">@{bookmark.author || 'unknown'}</p>
                </div>
                <button
                  onClick={() => removeBookmark(bookmark.id)}
                  className="rounded-md border px-3 py-1.5 text-xs font-semibold"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default Bookmarks;
