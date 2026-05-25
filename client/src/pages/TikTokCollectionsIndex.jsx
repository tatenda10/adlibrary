import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import folderImage from '../assets/folder.png';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { useApiToast } from '../hooks/useApiToast.js';
import { getCollections } from '../lib/api.js';

function TikTokCollectionsIndex() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { notifyApiError } = useApiToast();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Session token unavailable');
        const data = await getCollections(token, { platform: 'tiktok' });
        if (!cancelled) {
          setCollections(Array.isArray(data?.collections) ? data.collections : []);
        }
      } catch (err) {
        if (!cancelled) notifyApiError(err, 'Failed to load saved searches.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, notifyApiError]);

  return (
    <section className="space-y-4">
      {loading ? (
        <CubeLoaderOverlay label="Loading saved searches…" minHeight="40vh" />
      ) : null}
      {!loading && !collections.length ? (
        <div className="rounded-xl border border-white/8 p-6 text-sm app-muted" style={{ background: 'var(--app-panel)' }}>
          No saved searches yet. Run a TikTok search and save it to see folders here.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Recent {collections.length}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
          {collections.map((collection) => (
            <button
              key={collection.id}
              type="button"
              onClick={() => navigate(`/tiktok/collections/${collection.id}`)}
              className="group flex flex-col items-center text-center transition-transform hover:-translate-y-1"
            >
              <div className="flex h-[92px] w-[112px] items-center justify-center">
                <img
                  src={folderImage}
                  alt=""
                  className="h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.28)]"
                />
              </div>
              <div className="mt-3 max-w-[140px]">
                <h3 className="line-clamp-2 text-base font-medium leading-snug text-white">
                  {collection.name || 'Untitled folder'}
                </h3>
              </div>
            </button>
          ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default TikTokCollectionsIndex;
