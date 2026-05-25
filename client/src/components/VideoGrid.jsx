import VideoCard from './VideoCard.jsx';

function VideoGrid({ videos, onAnalyze, onBookmark, bookmarkIds }) {
  if (!videos.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-600 bg-slate-950/45 p-8 text-center text-sm text-slate-300">
        No results yet. Search for a TikTok niche keyword to load videos.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onAnalyze={onAnalyze}
          onBookmark={onBookmark}
          isBookmarked={bookmarkIds.has(video.id)}
        />
      ))}
    </div>
  );
}

export default VideoGrid;
