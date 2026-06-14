import { useEffect, useState } from 'react';
import { adminGetUsers } from '../lib/api.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { AdminBadge, AdminCard, AdminMetricCard, AdminPageHeader } from '../components/ui/AdminUi.jsx';

export function UsersPage() {
  const { token } = useAdminAuth();
  const [data, setData] = useState({ users: [], total: 0, metrics: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const rows = await adminGetUsers(token);
        if (!cancelled) setData(rows || { users: [], total: 0, metrics: null });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token) load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const metrics = data.metrics || {};
  const year = new Date().getFullYear();

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Accounts"
        title="Users"
        description="Live from your Clerk account — real emails, sign-up dates, plus local plan and login metrics."
      />

      {error ? <p className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetricCard
          label="Total registered"
          value={loading ? '…' : metrics.total ?? data.total ?? 0}
          detail="All users in Clerk"
          accent
        />
        <AdminMetricCard
          label={`New in ${year}`}
          value={loading ? '…' : metrics.newThisYear ?? 0}
          detail="Registrations since Jan 1"
        />
        <AdminMetricCard
          label="New this month"
          value={loading ? '…' : metrics.newThisMonth ?? 0}
          detail="Registrations this calendar month"
        />
      </div>

      <AdminCard className="overflow-x-auto p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-[11px] uppercase tracking-[0.12em] text-[#7f8ba0]">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium">Logins</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-[#9ca3af]">
                  Loading users from Clerk…
                </td>
              </tr>
            ) : null}
            {!loading && data.users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-[#9ca3af]">
                  No users in Clerk yet.
                </td>
              </tr>
            ) : null}
            {data.users.map((user) => {
              const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
              return (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    {displayName ? <p className="font-medium text-white">{displayName}</p> : null}
                    <p className={displayName ? 'mt-0.5 text-sm text-[#d1d5db]' : 'font-medium text-white'}>{user.email}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-[#6b7280]">{user.id}</p>
                    {user.username ? <p className="text-xs text-[#9ca3af]">@{user.username}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <AdminBadge tone={user.subscription_status === 'active' ? 'success' : 'default'}>
                      {user.plan_key || 'unsubscribed'}
                    </AdminBadge>
                  </td>
                  <td className="px-4 py-3 text-[#9ca3af]">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3 text-[#9ca3af]">{formatDate(user.last_login_at) || '—'}</td>
                  <td className="px-4 py-3 text-white">{user.login_count ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminCard>

      <p className="text-xs text-[#6b7280]">{data.total} users shown from Clerk (newest first)</p>
    </section>
  );
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}
