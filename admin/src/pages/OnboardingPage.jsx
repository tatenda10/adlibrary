import { useEffect, useState } from 'react';
import { adminGetOnboardingProfileDetail, adminGetOnboardingProfiles } from '../lib/api.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { AdminButton, AdminCard, AdminPageHeader } from '../components/ui/AdminUi.jsx';

export function OnboardingPage() {
  const { token } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ profiles: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!token || !selectedUserId) {
        setSelectedProfile(null);
        return;
      }
      try {
        setDetailLoading(true);
        const row = await adminGetOnboardingProfileDetail(token, selectedUserId);
        if (!cancelled) setSelectedProfile(row?.profile || null);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load profile detail');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [token, selectedUserId]);

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
                  <AdminButton variant="ghost" onClick={() => setSelectedUserId(profile.user_id)}>
                    View
                  </AdminButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>

      <p className="text-xs text-[#6b7280]">{data.total} onboarding profile{data.total === 1 ? '' : 's'}</p>

      <OnboardingDetailModal
        profile={selectedProfile}
        loading={detailLoading}
        onClose={() => {
          setSelectedUserId(null);
          setSelectedProfile(null);
        }}
      />
    </section>
  );
}

function OnboardingDetailModal({ profile, loading, onClose }) {
  if (!profile && !loading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/75" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-sm border border-white/10 bg-[#0a0a0a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Onboarding profile</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {loading ? 'Loading…' : profile?.brand_name || profile?.email || 'Profile'}
            </h2>
            {profile?.email ? <p className="mt-1 text-sm text-[#9ca3af]">{profile.email}</p> : null}
          </div>
          <AdminButton variant="ghost" onClick={onClose}>
            Close
          </AdminButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? <p className="text-sm text-[#9ca3af]">Loading profile…</p> : null}
          {profile ? <OnboardingDetailBody profile={profile} /> : null}
        </div>
      </div>
    </div>
  );
}

function OnboardingDetailBody({ profile }) {
  const sections = [
    {
      title: 'Basics',
      fields: [
        ['Brand name', profile.brand_name],
        ['Industry', profile.industry],
        ['Niche', profile.niche],
        ['Market / country', profile.country],
        ['Countries', formatList(profile.countries)],
        ['Website', profile.website_url],
        ['Brand size', profile.brand_size],
      ],
    },
    {
      title: 'Audience & story',
      fields: [
        ['Ideal customer', profile.target_audience || profile.preferences?.idealCustomers],
        ['Brand story', profile.story],
      ],
    },
    {
      title: 'Channels & goals',
      fields: [
        ['Suggested channels', profile.suggested_channels_text || formatList(profile.channels)],
        ['Goals', formatJson(profile.goals)],
      ],
    },
    {
      title: 'AI-generated insights',
      fields: [
        ['Tone', formatJson(profile.tone)],
        ['Value props', formatJson(profile.value_props)],
        ['Content pillars', formatJson(profile.content_pillars)],
        ['Last scraped', formatDate(profile.last_scraped_at)],
      ],
    },
    {
      title: 'Meta',
      fields: [
        ['User ID', profile.user_id],
        ['Created', formatDate(profile.created_at)],
        ['Updated', formatDate(profile.updated_at)],
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">{section.title}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {section.fields.map(([label, value]) => (
              <Field key={label} label={label} value={value} wide={label.includes('story') || label.includes('customer')} />
            ))}
          </dl>
        </div>
      ))}

      {profile.preferences ? (
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#7f8ba0]">Raw preferences JSON</p>
          <pre className="mt-2 overflow-auto rounded-sm border border-white/8 bg-black/40 p-4 text-[11px] leading-5 text-[#c6d0db]">
            {JSON.stringify(profile.preferences, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value, wide = false }) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <div className={`rounded-sm border border-white/8 bg-black/20 px-3 py-2.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-[#6b7280]">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-[#e5e7eb]">{display}</dd>
    </div>
  );
}

function formatList(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value);
}

function formatJson(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(' · ');
  if (typeof value === 'object') {
    if (value.summary) return String(value.summary);
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}
