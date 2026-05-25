function requestKey(video) {
  return video.url || video.tiktok_url || video.id;
}

export function videoSavedSet(bookmarks) {
  return new Set(
    bookmarks
      .map((item) => item.tiktok_url)
      .filter(Boolean)
  );
}

export function isVideoSaved(bookmarksSet, video) {
  return bookmarksSet.has(requestKey(video));
}
