function BookmarkLibrary({ items, onDelete }) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-600 bg-slate-950/45 p-8 text-center text-sm text-slate-300">
        No bookmarks saved yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((bookmark) => (
        <article key={bookmark.id} className="rounded-xl border border-slate-700/70 bg-slate-950/55 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">{bookmark.caption || bookmark.tiktok_url}</h3>
              <p className="text-xs text-slate-400">@{bookmark.author || 'unknown'}</p>
            </div>
            <button
              onClick={() => onDelete(bookmark.id)}
              className="rounded-md border border-rose-400/60 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/15"
            >
              Delete
            </button>
          </div>

          {bookmark.ai_analysis && (
            <details className="mt-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300">AI Analysis</summary>
              <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-200">{JSON.stringify(bookmark.ai_analysis, null, 2)}</pre>
            </details>
          )}
        </article>
      ))}
    </div>
  );
}

export default BookmarkLibrary;
