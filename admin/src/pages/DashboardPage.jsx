import { useEffect, useMemo, useState } from 'react';
import { adminGetArticles } from '../lib/api.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';

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
    <section className="space-y-4">
      <h3 className="text-xl font-semibold text-white">Overview</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Total Articles" value={loading ? '...' : metrics.total} />
        <MetricCard label="Published" value={loading ? '...' : metrics.published} />
        <MetricCard label="Drafts" value={loading ? '...' : metrics.drafts} />
      </div>
      <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
        <h4 className="text-sm font-semibold text-white">Admin Areas</h4>
        <p className="mt-2 text-sm text-[#9ca3af]">
          Use the sidebar to navigate between user management, article publishing, and platform settings.
        </p>
      </div>
    </section>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[#7f8ba0]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
