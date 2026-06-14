import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar.jsx';
import { getArticleBySlug, getArticles } from '../lib/api.js';
import logo from '../assets/logo.png';

function Blog() {
  const { slug } = useParams();
  const [items, setItems] = useState([]);
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadList() {
      if (slug) return;
      try {
        setLoading(true);
        setError('');
        const rows = await getArticles('published');
        if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load blog posts.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadList();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    async function loadArticle() {
      if (!slug) {
        setArticle(null);
        return;
      }
      try {
        setLoading(true);
        setError('');
        const data = await getArticleBySlug(slug);
        if (!cancelled) setArticle(data);
      } catch (err) {
        if (!cancelled) {
          setArticle(null);
          setError(err?.message || 'Failed to load this post.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadArticle();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <Navbar />

      <main className="mx-auto w-full max-w-[1280px] px-4 pb-20 pt-28 md:px-6">
        {slug ? (
          <article className="mx-auto max-w-3xl">
            <Link to="/blog" className="text-sm text-emerald-300 hover:text-emerald-200">
              ← Back to Blog
            </Link>
            {loading ? (
              <p className="mt-8 text-sm text-slate-400">Loading post…</p>
            ) : null}
            {error && !loading ? (
              <p className="mt-8 rounded-sm border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>
            ) : null}
            {article && !loading ? (
              <>
                <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-slate-500">Blog</p>
                <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{article.title}</h1>
                <p className="mt-3 text-sm text-slate-400">
                  {article.author || 'ViralAdLibrary Team'} ·{' '}
                  {new Date(article.published_at || article.created_at).toLocaleDateString()}
                </p>
                {article.excerpt ? (
                  <p className="mt-6 text-lg leading-8 text-slate-300">{article.excerpt}</p>
                ) : null}
                {looksLikeHtml(article.content) ? (
                  <div
                    className="article-html mt-8 text-base leading-8 text-slate-200 [&_a]:text-emerald-300 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-400/40 [&_blockquote]:pl-4 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-sm [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
                    dangerouslySetInnerHTML={{ __html: article.content }}
                  />
                ) : (
                  <div className="mt-8 whitespace-pre-wrap text-base leading-8 text-slate-200">{article.content}</div>
                )}
              </>
            ) : null}
          </article>
        ) : (
          <>
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Blog</p>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Ad research, creative strategy, and growth notes</h1>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Market breakdowns, competitor insights, and practical guides for performance marketers and agencies.
              </p>
            </div>

            {loading ? <p className="mt-10 text-sm text-slate-400">Loading posts…</p> : null}
            {error && !loading ? (
              <p className="mt-10 rounded-sm border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>
            ) : null}

            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <article
                  key={item.slug}
                  className="flex flex-col rounded-sm border border-white/10 bg-white/[0.03] p-5 transition hover:border-emerald-400/30"
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    {new Date(item.published_at || item.created_at).toLocaleDateString()}
                  </p>
                  <h2 className="mt-3 text-lg font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">{item.excerpt || 'Read the full post.'}</p>
                  <Link
                    to={`/blog/${item.slug}`}
                    className="mt-5 inline-flex w-fit rounded-sm border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/20"
                  >
                    Read post
                  </Link>
                </article>
              ))}
            </div>

            {!items.length && !loading && !error ? (
              <p className="mt-10 text-sm text-slate-500">No posts published yet. Check back soon.</p>
            ) : null}
          </>
        )}
      </main>

      <footer className="border-t border-white/8 bg-[#050505] py-10">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="ViralAdLibrary logo" className="h-10 w-10 rounded-full object-cover" />
            <p className="text-sm text-slate-400">© {new Date().getFullYear()} ViralAdLibrary</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <Link to="/" className="hover:text-white">
              Home
            </Link>
            <Link to="/blog" className="hover:text-white">
              Blog
            </Link>
            <a href="/#pricing" className="hover:text-white">
              Pricing
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Blog;

function looksLikeHtml(value = '') {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}
