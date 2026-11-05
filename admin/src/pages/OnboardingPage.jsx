import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminGetOnboardingProfiles } from '../lib/api.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { AdminCard, AdminPageHeader } from '../components/ui/AdminUi.jsx';

export function OnboardingPage() {
  const { token } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ profiles: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) return;
      try {
        setLoading(true);
        setError('');
        const rows = await adminGetOnboardingProfiles(token, { search, limit: 200 });
        if (!cancelled) setData(rows || { profiles: [], total: 0 });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load onboarding data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = window.setTimeout(load, search ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, search]);

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Product"
        title="Onboarding"
        description="Brand and audience data users submit during the onboarding flow."
        actions={
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, brand, website…"
            className="rounded-sm border border-white/10 bg-[#0f0f10] px-3 py-2 text-sm text-white"
          />
        }
      />

      {error ? <p className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <AdminCard className="admin-scroll-x p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-[11px] uppercase tracking-[0.12em] text-[#7f8ba0]">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Brand</th>
              <th className="px-4 py-3 font-medium">Industry</th>
              <th className="px-4 py-3 font-medium">Market</th>
              <th className="px-4 py-3 font-medium">Website</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-[#9ca3af]">
                  Loading onboarding profiles…
                </td>
              </tr>
            ) : null}
            {!loading && data.profiles.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-[#9ca3af]">
                  No onboarding profiles yet. Data appears here after users complete onboarding steps.
                </td>
              </tr>
            ) : null}
            {data.profiles.map((profile) => (
              <tr key={profile.user_id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{profile.email || '—'}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-[#6b7280]">{profile.user_id}</p>
                </td>
                <td className="px-4 py-3 text-white">{profile.brand_name || '—'}</td>
                <td className="px-4 py-3 text-[#c6d0db]">{profile.industry || profile.niche || '—'}</td>
                <td className="px-4 py-3 text-[#c6d0db]">{profile.country || '—'}</td>
                <td className="max-w-[180px] truncate px-4 py-3 text-emerald-300" title={profile.website_url}>
                  {profile.website_url || '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-[#9ca3af]">
                  {formatDate(profile.updated_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/onboarding/${encodeURIComponent(profile.user_id)}`}
                    className="inline-flex rounded-sm border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#d1d5db] hover:bg-white/5"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>

      <p className="text-xs text-[#6b7280]">{data.total} onboarding profile{data.total === 1 ? '' : 's'}</p>
    </section>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}
