import { buildTikTokStreamUrl, extractTikTokStreamSourceUrl } from './api.js';

const STORAGE_KEY = 'tiktok_search_collections';
const EVENT_NAME = 'tiktok-search-collections-updated';

function normalizeCollectionVideo(video = {}) {
  const sourceVideoStreamUrl = String(
    extractTikTokStreamSourceUrl(
      video.sourceVideoStreamUrl ||
        video.source_video_stream_url ||
        video.rawVideoStreamUrl ||
        video.raw_video_stream_url ||
        video.videoStreamUrl ||
        video.video_stream_url ||
        ''
    )
  ).trim();
  const proxiedVideoStreamUrl =
    String(video.videoStreamUrl || video.video_stream_url || '').trim() ||
    buildTikTokStreamUrl(sourceVideoStreamUrl);

  return {
    ...video,
    sourceVideoStreamUrl,
    source_video_stream_url: sourceVideoStreamUrl,
    videoStreamUrl: proxiedVideoStreamUrl,
    video_stream_url: proxiedVideoStreamUrl,
  };
}

function readSearchCollections() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((item) => ({
          ...item,
          results: Array.isArray(item?.results) ? item.results.map(normalizeCollectionVideo) : [],
        }))
      : [];
  } catch {
    return [];
  }
}

function writeSearchCollections(collections) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function saveSearchCollection({
  id,
  name,
  keyword,
  limit,
  sortBy,
  intelligent,
  prompt,
  results = [],
  plan = null,
}) {
  const collections = readSearchCollections();
  const trimmedName = String(name || keyword || 'Untitled collection').trim();
  const entry = {
    id: id || `collection-${Date.now()}`,
    name: trimmedName,
    keyword,
    limit,
    sortBy,
    intelligent,
    prompt,
    results: Array.isArray(results) ? results.map(normalizeCollectionVideo) : [],
    plan,
    updatedAt: new Date().toISOString(),
  };

  const next = collections.filter((item) => item.id !== entry.id);
  next.unshift(entry);
  writeSearchCollections(next.slice(0, 30));
  return entry;
}

function renameSearchCollection(id, name) {
  const collections = readSearchCollections();
  const trimmedName = String(name || '').trim();
  if (!trimmedName) return null;

  const next = collections.map((item) =>
    item.id === id ? { ...item, name: trimmedName, updatedAt: new Date().toISOString() } : item,
  );
  writeSearchCollections(next);
  return next.find((item) => item.id === id) || null;
}

function getSearchCollection(id) {
  return readSearchCollections().find((item) => item.id === id) || null;
}

export {
  EVENT_NAME as TIKTOK_SEARCH_COLLECTIONS_EVENT,
  getSearchCollection,
  readSearchCollections,
  renameSearchCollection,
  saveSearchCollection,
};
