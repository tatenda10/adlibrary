import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { useApiToast } from '../hooks/useApiToast.js';
import { getArticleBySlug, getArticles } from '../lib/api.js';

function Articles() {
  const { slug } = useParams();
  const [items, setItems] = useState([]);
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const { notifyApiError } = useApiToast();

  useEffect(() => {
    let cancelled = false;
    async function loadList() {
      try {
        setLoading(true);
        const rows = await getArticles('published');
        if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
      } catch (err) {
        if (!cancelled) notifyApiError(err, 'Failed to load articles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!slug) loadList();
    return () => {
      cancelled = true;
    };
  }, [notifyApiError, slug]);

  useEffect(() => {
    let cancelled = false;
    async function loadArticle() {
      if (!slug) {
        setArticle(null);
        return;
      }
      try {
        setLoading(true);
        const data = await getArticleBySlug(slug);
        if (!cancelled) setArticle(data);
      } catch (err) {
        if (!cancelled) notifyApiError(err, 'Failed to load article');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadArticle();
    return () => {
      cancelled = true;
    };
  }, [notifyApiError, slug]);

  if (slug) {
    return (
      <section className="space-y-4">
        <article className="app-card border p-4" style={{ borderColor: 'var(--app-border)', background: '#0a0a0a' }}>
          <Link to="/articles" className="text-xs app-muted hover:text-white">← Back to Articles</Link>
          {loading ? <CubeLoaderOverlay label="Loading story…" minHeight="24vh" /> : null}
          {article ? (
            <>
              <h1 className="mt-3 text-2xl font-semibold">{article.title}</h1>
              <p className="mt-2 text-xs app-muted">{article.author} • {new Date(article.published_at || article.created_at).toLocaleDateString()}</p>
              {article.excerpt ? <p className="mt-4 text-sm app-muted">{article.excerpt}</p> : null}
              <div className="mt-5 whitespace-pre-wrap text-sm leading-7">{article.content}</div>
            </>
          ) : null}
        </article>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <article className="app-card border p-4" style={{ borderColor: 'var(--app-border)', background: '#0a0a0a' }}>
        <p className="text-xs uppercase tracking-[0.18em] app-muted">Articles</p>
        <h2 className="mt-1 text-xl font-semibold">Incoming Stories</h2>
        <p className="mt-2 max-w-2xl text-sm app-muted">
          Publish your market research, creative breakdowns, and strategy stories here so the team can learn from one feed.
        </p>
      </article>

      {loading ? <CubeLoaderOverlay label="Loading stories…" minHeight="40vh" /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article key={item.slug} className="app-card border p-4" style={{ borderColor: 'var(--app-border)', background: '#0b0b0b' }}>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="border px-2 py-1 app-muted" style={{ borderColor: 'var(--app-border)' }}>
                Story
              </span>
              <span className="text-emerald-400">Published</span>
            </div>
            <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
            <p className="mt-2 text-xs app-muted">{item.excerpt || 'No excerpt yet.'}</p>
            <p className="mt-3 text-[11px] app-muted">{item.author || 'Team'} • {new Date(item.published_at || item.created_at).toLocaleDateString()}</p>
            <Link to={`/articles/${item.slug}`} className="mt-4 inline-flex border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--app-border)' }}>
              Open Story
            </Link>
          </article>
        ))}
        {!items.length && !loading ? <p className="text-xs app-muted">No stories published yet.</p> : null}
      </div>
    </section>
  );
}

export default Articles;
