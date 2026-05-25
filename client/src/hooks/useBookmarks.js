import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { createBookmark, deleteBookmark, getBookmarks } from '../lib/api.js';

function useBookmarks({ autoLoad }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { isSignedIn, getToken } = useAuth();

  const loadBookmarks = useCallback(async () => {
    if (!isSignedIn) {
      setBookmarks([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await getBookmarks(token);
      setBookmarks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Failed to load bookmarks.');
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (autoLoad) {
      loadBookmarks();
    }
  }, [autoLoad, loadBookmarks]);

  const saveBookmark = async (video, analysis) => {
    if (!isSignedIn) {
      setError('Please sign in to save videos.');
      return { ok: false };
    }

    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');

      const resolvedUrl =
        video?.url ||
        video?.tiktok_url ||
        video?.webVideoUrl ||
        video?.videoStreamUrl ||
        video?.video_stream_url ||
        '';

      const payload = {
        ...video,
        url: resolvedUrl,
        tiktok_url: video?.tiktok_url || resolvedUrl,
        webVideoUrl: video?.webVideoUrl || resolvedUrl,
        source_video_stream_url: video?.source_video_stream_url || video?.sourceVideoStreamUrl || null,
        video_stream_url: video?.video_stream_url || video?.videoStreamUrl || null,
      };

      const saved = await createBookmark(token, payload, analysis);
      setBookmarks((current) => {
        const exists = current.some((item) => item.id === saved.id || item.tiktok_url === saved.tiktok_url);
        return exists ? current : [saved, ...current];
      });
      setError('');
      return { ok: true, item: saved };
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Failed to save bookmark.');
      return { ok: false, error: err };
    }
  };

  const removeBookmark = async (bookmarkId) => {
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      await deleteBookmark(token, bookmarkId);
      setBookmarks((current) => current.filter((item) => item.id !== bookmarkId));
      setError('');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Failed to remove bookmark.');
    }
  };

  return {
    bookmarks,
    loading,
    error,
    loadBookmarks,
    saveBookmark,
    removeBookmark,
  };
}

export default useBookmarks;
