import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  analyzeVideo,
  buildTikTokStreamUrl,
  extractTikTokStreamSourceUrl,
  intelligentSearchVideos,
  saveRecentTikTokVideos,
  searchVideos,
} from '../lib/api.js';

function normalizeVideo(item, index) {
  const resolvedSourceVideoUrl = resolveVideoStreamUrl(item);
  const resolvedTikTokUrl = resolvePublicTikTokUrl(item);
  const resolvedVideoStreamUrl = buildTikTokStreamUrl(resolvedSourceVideoUrl);

  return {
    id: item.id ?? item.video_id ?? resolvedTikTokUrl ?? `video-${index}`,
    url: resolvedTikTokUrl,
    tiktok_url: resolvedTikTokUrl,
    thumbnail: item.thumbnail ?? item.cover ?? item.covers?.default ?? '',
    sourceVideoStreamUrl: resolvedSourceVideoUrl,
    source_video_stream_url: resolvedSourceVideoUrl,
    videoStreamUrl: resolvedVideoStreamUrl,
    video_stream_url: resolvedVideoStreamUrl,
    caption: item.caption ?? item.desc ?? item.text ?? '',
    author: item.author ?? item.authorMeta?.name ?? '',
    profile_username: item.profile_username ?? item.profileUsername ?? '',
    profile_url: item.profile_url ?? item.profileUrl ?? '',
    views: Number(item.views ?? item.playCount ?? item.stats?.playCount ?? 0),
    likes: Number(item.likes ?? item.diggCount ?? item.stats?.diggCount ?? 0),
    transcript: item.transcript ?? item.subtitleText ?? item.subtitlesText ?? '',
    discovery_keyword: item.discovery_keyword ?? item.discoveryKeyword ?? '',
    source_stage: item.source_stage ?? item.sourceStage ?? '',
    sourceContext: item.sourceContext ?? item.source_context ?? '',
    source_context: item.source_context ?? item.sourceContext ?? '',
  };
}

function resolveVideoStreamUrl(item = {}) {
  const candidates = [
    item.source_video_stream_url,
    item.sourceVideoStreamUrl,
    item.video_stream_url,
    item.videoStreamUrl,
    item.videoUrl,
    item.play_url,
    item.playAddr,
    item.downloadAddr,
    item.videoMeta?.downloadAddr,
    item.videoMeta?.playAddr,
    item.video?.playAddr,
    item.video?.downloadAddr,
    item.video?.play_addr?.url_list?.[0],
    item.video?.download_addr?.url_list?.[0],
    item.play_addr?.url_list?.[0],
    item.download_addr?.url_list?.[0],
    item.media?.video?.url,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      const trimmed = extractTikTokStreamSourceUrl(value);
      if (isApifyArtifactUrl(trimmed)) continue;
      return trimmed;
    }
  }

  return '';
}

function isApifyArtifactUrl(value = '') {
  const url = String(value || '').toLowerCase();
  return url.includes('api.apify.com/v2/key-value-stores/') || url.includes('/records/video-');
}

function isPublicTikTokUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (isApifyArtifactUrl(raw)) return false;
  try {
    const parsed = new URL(raw);
    return parsed.hostname.toLowerCase().includes('tiktok.com');
  } catch {
    return false;
  }
}

function resolvePublicTikTokUrl(item = {}) {
  const candidates = [item.tiktok_url, item.url, item.webVideoUrl, item.shareUrl];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (!isPublicTikTokUrl(trimmed)) continue;
    return trimmed;
  }
  return '';
}

function sortVideos(list, sortBy) {
  const copy = [...list];
  if (sortBy === 'likes') return copy.sort((a, b) => b.likes - a.likes);
  if (sortBy === 'views') return copy.sort((a, b) => b.views - a.views);
  return copy;
}

async function persistRecentVideos(token, videos) {
  try {
    await saveRecentTikTokVideos(token, videos.slice(0, 20));
  } catch (error) {
    console.warn('Failed to persist recent TikTok videos:', error);
  }
}

function useSearch() {
  const { getToken } = useAuth();
  const [videos, setVideos] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPlan, setSearchPlan] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  const runSearch = async (keyword, options = {}) => {
    const query = keyword.trim();
    if (!query) return;

    const {
      limit = 20,
      sortBy = 'relevance',
      intelligent = false,
      prompt = '',
      businessProfile = {},
      minViews = 0,
      minLikes = 0,
      hookContains = '',
      hookMode = false,
    } = options;

    setIsSearching(true);
    setSearchError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');

      if (intelligent) {
        const data = await intelligentSearchVideos(token, {
          prompt: prompt || query,
          keyword: query,
          limit,
          businessProfile,
          minViews,
          minLikes,
          hookContains,
          hookMode,
        });

        const list = Array.isArray(data?.results) ? data.results : [];
        const normalized = list.map(normalizeVideo);
        setVideos(sortVideos(normalized, sortBy));
        await persistRecentVideos(token, normalized);
        setSearchPlan(data?.plan || null);
        return;
      }

      const data = await searchVideos(token, query, limit, {
        minViews,
        minLikes,
        hookContains,
        hookMode,
      });
      const list = Array.isArray(data) ? data : data.results ?? [];
      const normalized = list.map(normalizeVideo);
      setVideos(sortVideos(normalized, sortBy));
      await persistRecentVideos(token, normalized);
      setSearchPlan(data?.plan || null);
    } catch (error) {
      console.error(error);
      setVideos([]);
      setSearchPlan(null);
      setSearchError(error);
    } finally {
      setIsSearching(false);
    }
  };

  const runAnalysis = async (video) => {
    setIsAnalyzing(true);
    setAnalysisError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await analyzeVideo(token, video);
      setAnalysis(data);
      return data;
    } catch (error) {
      console.error(error);
      setAnalysis(null);
      setAnalysisError('Failed to analyze this video.');
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearAnalysis = () => {
    setAnalysis(null);
    setAnalysisError('');
  };

  return {
    videos,
    isSearching,
    searchPlan,
    searchError,
    analysis,
    isAnalyzing,
    analysisError,
    runSearch,
    runAnalysis,
    clearAnalysis,
  };
}

export default useSearch;
