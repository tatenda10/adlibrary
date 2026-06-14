import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminGetArticles } from '../lib/api.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { AdminCard, AdminMetricCard, AdminPageHeader, AdminButton } from '../components/ui/AdminUi.jsx';

export function DashboardPage() {
  const { token } = useAdminAuth();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await adminGetArticles(token);
        if (!cancelled) setArticles(Array.isArray(rows) ? rows : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token) load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const metrics = useMemo(() => {
    const total = articles.length;
    const published = articles.filter((a) => a.status === 'published').length;
    const drafts = total - published;
    return { total, published, drafts };
  }, [articles]);

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Overview"
        title="Welcome back"
        description="Publish blog posts, monitor drafts, and manage the public /blog feed from here."
        actions={
          <>
            <Link to="/articles/new">
              <AdminButton>New article</AdminButton>
            </Link>
            <Link to="/articles/all">
              <AdminButton variant="secondary">All articles</AdminButton>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Total articles" value={loading ? '…' : metrics.total} accent />
        <AdminMetricCard label="Published" value={loading ? '…' : metrics.published} detail="Live on public blog" />
        <AdminMetricCard label="Drafts" value={loading ? '…' : metrics.drafts} detail="Not visible yet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Quick actions</p>
          <ul className="mt-4 space-y-2 text-sm text-[#c6d0db]">
            <li>
              <Link to="/articles/new" className="text-emerald-300 hover:text-emerald-200">
                Write a new blog post →
              </Link>
            </li>
            <li>
              <Link to="/articles/all" className="text-emerald-300 hover:text-emerald-200">
                Review published & draft posts →
              </Link>
            </li>
            <li>
              <Link to="/users" className="text-[#9ca3af] hover:text-white">
                User management (scaffold) →
              </Link>
            </li>
          </ul>
        </AdminCard>

        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#7f8ba0]">Publishing flow</p>
          <p className="mt-3 text-sm leading-6 text-[#9ca3af]">
            Create an article in <span className="text-white">New article</span>, set status to{' '}
            <span className="text-emerald-300">published</span>, and it appears on the marketing site blog
            automatically.
          </p>
        </AdminCard>
      </div>
    </section>
  );
}
