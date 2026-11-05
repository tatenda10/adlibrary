import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { adminGetOnboardingProfileDetail } from '../lib/api.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { AdminButton, AdminCard, AdminPageHeader } from '../components/ui/AdminUi.jsx';

const ROLE_LABELS = {
  founder: 'Founder',
  media_buyer: 'Solo media buyer',
  in_house: 'In-house growth',
  agency: 'Agency / operator',
};

export function OnboardingUserPage() {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [journey, setJourney] = useState(null);

  const days = Number(searchParams.get('days') || 90);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || !userId) return;
      setLoading(true);
      setError('');
      try {
        const data = await adminGetOnboardingProfileDetail(token, userId, { days });
        if (!cancelled) setJourney(data || null);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load user onboarding');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, userId, days]);

  const profile = journey?.profile || {};
  const flow = journey?.flow || {};
  const events = journey?.events || [];
  const roleLabel = ROLE_LABELS[flow.audience_role] || flow.audience_role || 'No role yet';
  const title = profile.email || profile.username || profile.brand_name || userId;

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <AdminPageHeader
        eyebrow="Onboarding user"
        title={loading ? 'Loading…' : title}
        description="Everything this person entered in onboarding, plus their event timeline."
        actions={
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="ghost" onClick={() => navigate(-1)}>
              Back
            </AdminButton>
            <Link
              to="/onboarding"
              className="inline-flex items-center rounded-sm border border-white/10 px-3 py-2 text-sm text-[#c6d0db] hover:bg-white/5"
            >
              All profiles
            </Link>
          </div>
        }
      />

      {error ? (
        <p className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : null}

      {loading ? <p className="text-sm text-[#9ca3af]">Loading user flow…</p> : null}

      {!loading && journey ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Flow" value={roleLabel} />
            <StatCard label="Saved step" value={String(flow.onboarding_step || 1)} />
            <StatCard label="Completed setup" value={flow.onboarding_completed ? 'Yes' : 'No'} accent={flow.onboarding_completed} />
          </div>

          <AdminCard>
            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Account</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Email" value={profile.email} />
              <Field label="Username" value={profile.username} />
              <Field label="User ID" value={journey.user_id || userId} />
              <Field label="Plan picked" value={flow.plan} />
            </dl>
          </AdminCard>

          <AdminCard>
            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">What they entered</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Brand name" value={flow.brand_name || profile.brand_name} />
              <Field label="Website" value={flow.website_url || profile.website_url} />
              <Field label="Industry" value={flow.industry || profile.industry} />
              <Field label="Niche" value={flow.niche || profile.niche} />
              <Field label="Countries" value={formatList(flow.countries || profile.countries)} />
              <Field label="Channels" value={formatList(flow.channels || profile.channels)} />
              <Field label="Story / angles" value={flow.story || profile.story} wide />
              <Field
                label="Ideal customer"
                value={flow.ideal_customer || profile.target_audience || profile.preferences?.idealCustomers}
                wide
              />
            </dl>
          </AdminCard>

          <AdminCard>
            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Brand insights</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Tone" value={formatJson(profile.tone)} wide />
              <Field label="Value props" value={formatJson(profile.value_props)} wide />
              <Field label="Content pillars" value={formatJson(profile.content_pillars)} wide />
              <Field label="Last scraped" value={formatDate(profile.last_scraped_at)} />
              <Field label="Profile updated" value={formatDate(profile.updated_at)} />
            </dl>
          </AdminCard>

          <AdminCard>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Event timeline</p>
                <p className="mt-1 text-sm text-[#9ca3af]">
                  Onboarding events for this user{days ? ` · last ${days} days` : ''}.
                </p>
              </div>
              <p className="text-sm text-[#c6d0db]">{events.length} events</p>
            </div>
            <ul className="mt-4 space-y-2">
              {events.map((event, index) => (
                <li
                  key={`${event.event_name}-${index}`}
                  className="rounded-sm border border-white/8 bg-black/20 px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-white">{event.event_name}</p>
                    <p className="text-xs text-[#7f8ba0]">{formatDate(event.created_at)}</p>
                  </div>
                  <p className="mt-1 text-xs text-[#9ca3af]">
                    {event.page_path || '—'}
                    {event.props?.step_key ? ` · step ${event.props.step_key}` : ''}
                    {event.props?.audience_role ? ` · ${event.props.audience_role}` : ''}
                    {event.props?.plan_key ? ` · plan ${event.props.plan_key}` : ''}
                  </p>
                </li>
              ))}
              {!events.length ? (
                <li className="text-sm text-[#9ca3af]">No onboarding events stored for this user.</li>
              ) : null}
            </ul>
          </AdminCard>
        </>
      ) : null}
    </section>
  );
}

function StatCard({ label, value, accent = false }) {
  return (
    <AdminCard>
      <p className="text-[11px] uppercase tracking-[0.12em] text-[#7f8ba0]">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${accent ? 'text-emerald-300' : 'text-white'}`}>{value || '—'}</p>
    </AdminCard>
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
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}
