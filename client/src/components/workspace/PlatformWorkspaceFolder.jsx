import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CubeLoaderOverlay } from '../CubeLoader.jsx';
import { useApiToast } from '../../hooks/useApiToast.js';
import { getPlatformWorkspaceConfig } from './platformWorkspaceConfig.js';
import {
  enrichWorkspaceItem,
  matchesWorkspaceItemSearch,
  workspaceItemTitle,
  workspaceItemUsername,
} from './platformWorkspaceUtils.js';

export default function PlatformWorkspaceFolder({ platform }) {
  const config = getPlatformWorkspaceConfig(platform);
  const { folderId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { notifyBillingOrApiError } = useApiToast();

  const [folder, setFolder] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState(null);
  const [deletingFolder, setDeletingFolder] = useState(false);

  const enrichedVideos = useMemo(
    () => (Array.isArray(videos) ? videos.map((v) => enrichWorkspaceItem(v, platform)) : []),
    [videos, platform]
  );

  const filteredVideos = useMemo(
    () => enrichedVideos.filter((video) => matchesWorkspaceItemSearch(video, searchQuery, platform)),
    [enrichedVideos, searchQuery, platform]
  );

  const loadFolder = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await config.api.getFolder(token, folderId);
      setFolder(data?.folder || null);
      setVideos(Array.isArray(data?.videos) ? data.videos : []);
    } catch (err) {
      notifyBillingOrApiError(err, 'Could not load this folder.');
      setFolder(null);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [config.api, folderId, getToken, notifyBillingOrApiError]);

  useEffect(() => {
    loadFolder();
  }, [loadFolder]);

  const handleAddVideo = async (event) => {
    event.preventDefault();
    const url = linkInput.trim();
    if (!url) return;

    setAdding(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await config.api.addVideo(token, folderId, { url });
      if (data?.video) {
        setVideos((prev) => [data.video, ...prev]);
        setFolder((prev) =>
          prev ? { ...prev, video_count: (Number(prev.video_count) || 0) + 1 } : prev
        );
      }
      setLinkInput('');
      setAddModalOpen(false);
    } catch (err) {
      notifyBillingOrApiError(err, `Could not add that ${config.label} link.`);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteVideo = async (videoId) => {
    setDeletingVideoId(videoId);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      await config.api.deleteVideo(token, folderId, videoId);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      setFolder((prev) =>
        prev ? { ...prev, video_count: Math.max(0, (Number(prev.video_count) || 0) - 1) } : prev
      );
    } catch (err) {
      notifyBillingOrApiError(err, 'Could not delete link.');
    } finally {
      setDeletingVideoId(null);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folder?.name) return;
    if (!window.confirm(`Delete "${folder.name}" and all saved links inside?`)) return;

    setDeletingFolder(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      await config.api.deleteFolder(token, folderId);
      navigate(config.basePath);
    } catch (err) {
      notifyBillingOrApiError(err, 'Could not delete folder.');
      setDeletingFolder(false);
    }
  };

  const busy = loading || adding || deletingFolder;
  const hasVideos = enrichedVideos.length > 0;
  const showEmptySearch =
    !loading && hasVideos && searchQuery.trim() && filteredVideos.length === 0;
  const contentUrl = (video) => String(video?.[config.urlField] || '').trim();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={config.basePath} className="text-xs text-[#86efac] hover:text-white">
            ← Back to workspace
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-white">{folder?.name || 'Folder'}</h2>
          <p className="mt-1 text-sm text-white/55">
            {folder?.video_count ?? enrichedVideos.length} saved link
            {(folder?.video_count ?? enrichedVideos.length) === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDeleteFolder}
          disabled={busy || !folder}
          className="rounded-sm border border-rose-500/40 px-4 py-2 text-sm text-rose-200 disabled:opacity-50"
        >
          {deletingFolder ? 'Deleting…' : 'Delete folder'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[12rem] flex-1">
          <span className="sr-only">Search saved links</span>
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20L16.5 16.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={config.searchItemsPlaceholder}
            className="block w-full rounded-sm py-2 pl-9 pr-3 text-sm app-input"
          />
        </label>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          disabled={busy}
          aria-label={`Add ${config.label} link`}
          title="Add link"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#25d366] text-xl font-semibold leading-none text-black transition hover:bg-[#2ee574] disabled:opacity-60"
        >
          +
        </button>
      </div>

      {loading ? <CubeLoaderOverlay label="Loading folder…" minHeight="40vh" /> : null}

      {adding ? <CubeLoaderOverlay label="Saving link & fetching details…" minHeight="30vh" /> : null}

      {!loading && !hasVideos && !adding ? (
        <div className="grid min-h-[32vh] place-items-center rounded-sm border border-white/10 bg-white/[0.02]">
          <div className="text-center">
            <p className="text-sm text-white/55">No links in this folder yet.</p>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="mt-3 text-sm font-semibold text-[#86efac] hover:text-white"
            >
              Add your first link
            </button>
          </div>
        </div>
      ) : null}

      {showEmptySearch ? (
        <p className="text-sm text-white/50">No links match your search.</p>
      ) : null}

      {!loading && filteredVideos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredVideos.map((video) => (
            <WorkspaceItemCard
              key={video.id}
              video={video}
              platform={platform}
              config={config}
              contentUrl={contentUrl(video)}
              deleting={deletingVideoId === video.id}
              onDelete={() => handleDeleteVideo(video.id)}
            />
          ))}
        </div>
      ) : null}

      {addModalOpen ? (
        <AddLinkModal
          config={config}
          linkInput={linkInput}
          onLinkChange={setLinkInput}
          onSubmit={handleAddVideo}
          onClose={() => {
            if (adding) return;
            setAddModalOpen(false);
            setLinkInput('');
          }}
          adding={adding}
        />
      ) : null}
    </section>
  );
}

function AddLinkModal({ config, linkInput, onLinkChange, onSubmit, onClose, adding }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-link-title"
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-sm border border-white/10 p-5"
        style={{ background: 'var(--app-panel)' }}
      >
        <h3 id="add-link-title" className="text-lg font-semibold text-white">
          {config.addModalTitle}
        </h3>
        <p className="mt-1 text-sm text-white/55">{config.addModalHelp}</p>
        <label className="mt-4 block">
          <span className="text-xs text-white/55">Link</span>
          <input
            value={linkInput}
            onChange={(e) => onLinkChange(e.target.value)}
            autoFocus
            placeholder={config.linkPlaceholder}
            className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={adding}
            className="rounded-sm border border-white/15 px-4 py-2 text-sm text-white/70 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={adding || !linkInput.trim()}
            className="rounded-sm bg-[#25d366] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {adding ? 'Adding…' : 'Add link'}
          </button>
        </div>
      </form>
    </div>
  );
}

function WorkspaceItemCard({ video, platform, config, contentUrl, deleting, onDelete }) {
  const title = workspaceItemTitle(video, platform);
  const username = workspaceItemUsername(video, platform);
  const [posterFailed, setPosterFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [playVideo, setPlayVideo] = useState(false);
  const playbackUrl = String(
    video?.playbackUrl || video?.playback_url || video?.source_video_stream_url || ''
  ).trim();

  useEffect(() => {
    setPosterFailed(false);
    setVideoFailed(false);
    setPlayVideo(false);
  }, [video?.id, video?.thumbnail, playbackUrl]);

  const showPoster = Boolean(video.thumbnail) && !posterFailed;
  const showDirectVideo =
    platform === 'facebook' && Boolean(playbackUrl) && !videoFailed && (playVideo || !showPoster);
  const showPlayOverlay = platform === 'facebook' && showPoster && Boolean(playbackUrl) && !playVideo;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-sm border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label="Remove link"
        className="absolute right-2 top-2 z-10 rounded-sm bg-black/75 px-2 py-0.5 text-xs text-rose-200 opacity-0 transition group-hover:opacity-100 hover:bg-black/90 disabled:opacity-50"
      >
        {deleting ? '…' : '×'}
      </button>
      <div className="relative aspect-[9/14] w-full overflow-hidden bg-black/40">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
            referrerPolicy="no-referrer"
          />
        ) : null}
        {video.embedUrl ? (
          <iframe
            src={video.embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="relative z-[1] h-full w-full border-0 bg-transparent"
          />
        ) : showDirectVideo ? (
          <video
            key={playbackUrl}
            src={playbackUrl}
            poster={showPoster ? video.thumbnail : undefined}
            className="relative z-[1] h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
            referrerPolicy="no-referrer"
            onError={() => {
              setVideoFailed(true);
              setPlayVideo(false);
            }}
          />
        ) : video.thumbnail ? (
          <button
            type="button"
            className="relative z-[1] block h-full w-full border-0 bg-transparent p-0 text-left"
            onClick={() => {
              if (showPlayOverlay) {
                setPlayVideo(true);
                return;
              }
              if (contentUrl) {
                window.open(contentUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            aria-label={showPlayOverlay ? 'Play saved Facebook video' : config.openExternalLabel}
          >
            <img
              src={video.thumbnail}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setPosterFailed(true)}
            />
            {showPlayOverlay ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                <span className="rounded-full bg-white/95 px-4 py-2 text-xs font-bold text-black shadow-lg">
                  Play video
                </span>
              </span>
            ) : null}
          </button>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#134e2a]/30 to-black/80 text-xs text-white/40">
            {contentUrl ? (
              <a
                href={contentUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#86efac] hover:text-white"
              >
                {config.openExternalLabel}
              </a>
            ) : (
              'No preview'
            )}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {username ? <p className="truncate text-xs text-[#86efac]">{username}</p> : null}
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{title}</p>
        {platform === 'facebook' && contentUrl ? (
          <a
            href={contentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-[#86efac] hover:text-white"
          >
            Open on Facebook
          </a>
        ) : null}
      </div>
    </article>
  );
}
