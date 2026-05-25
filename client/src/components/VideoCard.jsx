function metric(value) {
  return Number(value || 0).toLocaleString();
}

function VideoCard({ video, onAnalyze, onBookmark, isBookmarked }) {
  return (
    <article className="rounded-xl border border-slate-700/70 bg-slate-950/55 p-4">
      <img
        src={video.thumbnail || 'https://placehold.co/720x960/0f172a/e2e8f0?text=No+Thumbnail'}
        alt={video.caption || 'TikTok video thumbnail'}
        className="h-56 w-full rounded-lg object-cover"
      />

      <div className="mt-3 space-y-2">
        <h3 className="line-clamp-2 text-sm font-semibold text-white">{video.caption || 'Untitled video'}</h3>
        <p className="text-xs text-slate-400">@{video.author || 'unknown'}</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
          <span>Views: {metric(video.views)}</span>
          <span>Likes: {metric(video.likes)}</span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onAnalyze(video)}
          className="flex-1 rounded-md border border-cyan-400/60 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/15"
        >
          Analyze
        </button>
        <button
          onClick={() => onBookmark(video)}
          className="flex-1 rounded-md bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400"
        >
          {isBookmarked ? 'Saved' : 'Bookmark'}
        </button>
      </div>
    </article>
  );
}

export default VideoCard;
