import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { CubeLoaderOverlay } from '../CubeLoader.jsx';
import folderIcon from '../../assets/folder.png';
import { useApiToast } from '../../hooks/useApiToast.js';
import { getPlatformWorkspaceConfig } from './platformWorkspaceConfig.js';
import { matchesFolderSearch } from './platformWorkspaceUtils.js';

export default function PlatformWorkspace({ platform }) {
  const config = getPlatformWorkspaceConfig(platform);
  const { getToken } = useAuth();
  const { notifyBillingOrApiError } = useApiToast();

  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const filteredFolders = useMemo(
    () => folders.filter((folder) => matchesFolderSearch(folder, searchQuery)),
    [folders, searchQuery]
  );

  const loadFolders = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await config.api.getFolders(token);
      setFolders(Array.isArray(data?.folders) ? data.folders : []);
    } catch (err) {
      notifyBillingOrApiError(err, 'Could not load workspace folders.');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [config.api, getToken, notifyBillingOrApiError]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const handleCreateFolder = async (event) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;

    setCreating(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await config.api.createFolder(token, { name });
      if (data?.folder) {
        setFolders((prev) => [data.folder, ...prev]);
      }
      setFolderName('');
      setModalOpen(false);
    } catch (err) {
      notifyBillingOrApiError(err, 'Could not create folder.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFolder = async (folderId, folderLabel) => {
    if (!window.confirm(`Delete "${folderLabel}" and all saved links inside?`)) return;

    setDeletingId(folderId);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      await config.api.deleteFolder(token, folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
    } catch (err) {
      notifyBillingOrApiError(err, 'Could not delete folder.');
    } finally {
      setDeletingId(null);
    }
  };

  const showEmptySearch =
    !loading && folders.length > 0 && searchQuery.trim() && filteredFolders.length === 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-white/45">{config.label}</p>
          <h2 className="text-xl font-semibold text-white">Workspace</h2>
          <p className="mt-1 text-sm text-white/55">{config.description}</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-sm bg-[#25d366] px-5 py-2 text-sm font-semibold text-black"
        >
          New folder
        </button>
      </div>

      <label className="relative block max-w-md">
        <span className="sr-only">Search folders</span>
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
          placeholder={config.searchFoldersPlaceholder}
          className="block w-full rounded-sm py-2 pl-9 pr-3 text-sm app-input"
        />
      </label>

      {loading ? <CubeLoaderOverlay label="Loading workspace…" minHeight="40vh" /> : null}

      {!loading && !folders.length ? (
        <div className="grid min-h-[36vh] place-items-center rounded-sm border border-white/10 bg-white/[0.02]">
          <p className="text-center text-sm text-white/55">
            No folders yet. Click <strong className="text-white/80">New folder</strong> to get started.
          </p>
        </div>
      ) : null}

      {showEmptySearch ? (
        <p className="text-sm text-white/50">No folders match your search.</p>
      ) : null}

      {!loading && filteredFolders.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredFolders.map((folder) => (
            <div key={folder.id} className="group relative flex flex-col items-center text-center">
              <Link
                to={`${config.basePath}/${folder.id}`}
                className="flex flex-col items-center transition-transform hover:-translate-y-1"
              >
                <div className="flex h-[92px] w-[112px] items-center justify-center drop-shadow-[0_10px_18px_rgba(0,0,0,0.28)]">
                  <img src={folderIcon} alt="" className="h-full w-full object-contain" />
                </div>
                <h3 className="mt-3 line-clamp-2 max-w-[140px] text-base font-medium leading-snug text-white">
                  {folder.name}
                </h3>
                <p className="mt-1 text-xs text-white/45">
                  {folder.video_count || 0} saved link{(folder.video_count || 0) === 1 ? '' : 's'}
                </p>
              </Link>
              <button
                type="button"
                disabled={deletingId === folder.id}
                onClick={() => handleDeleteFolder(folder.id, folder.name)}
                className="mt-2 text-[11px] text-rose-300/80 hover:text-rose-200 disabled:opacity-50"
              >
                {deletingId === folder.id ? 'Deleting…' : 'Delete folder'}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-folder-title"
        >
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-w-md rounded-sm border border-white/10 p-5"
            style={{ background: 'var(--app-panel)' }}
          >
            <h3 id="new-folder-title" className="text-lg font-semibold text-white">
              New folder
            </h3>
            <p className="mt-1 text-sm text-white/55">Name your folder (e.g. Hooks, Competitors, Q2 tests).</p>
            <label className="mt-4 block">
              <span className="text-xs text-white/55">Folder name</span>
              <input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                autoFocus
                maxLength={255}
                placeholder="My folder"
                className="mt-1 block w-full rounded-sm px-3 py-2 text-sm app-input"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setFolderName('');
                }}
                className="rounded-sm border border-white/15 px-4 py-2 text-sm text-white/70"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !folderName.trim()}
                className="rounded-sm bg-[#25d366] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
