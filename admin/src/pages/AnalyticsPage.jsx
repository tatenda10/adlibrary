import { useEffect, useMemo, useState } from 'react';
import {
  adminGetAnalytics,
  adminGetAnalyticsEventDetail,
  adminGetAnalyticsEvents,
  adminGetAnalyticsFunnels,
  adminGetAnalyticsOnboarding,
  adminGetAnalyticsSignIn,
} from '../lib/api.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { AdminBadge, AdminCard, AdminMetricCard, AdminPageHeader } from '../components/ui/AdminUi.jsx';
import { GaFunnelChart, LocalFunnelChart } from '../components/analytics/GaFunnelChart.jsx';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'events', label: 'All events' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'signin', label: 'Sign-in' },
  { id: 'funnels', label: 'Funnels' },
];

export function AnalyticsPage() {
  const { token } = useAdminAuth();
  const [tab, setTab] = useState('overview');
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [events, setEvents] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [signin, setSignin] = useState(null);
  const [funnels, setFunnels] = useState(null);
  const [funnelOpen, setFunnelOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [eventDetail, setEventDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) return;
      try {
        setLoading(true);
        setError('');

        if (tab === 'overview') {
          const data = await adminGetAnalytics(token, { days });
          if (!cancelled) setOverview(data || null);
        } else if (tab === 'events') {
          const data = await adminGetAnalyticsEvents(token, { days });
          if (!cancelled) {
            setEvents(data || null);
            setSelectedEvent('');
            setEventDetail(null);
          }
        } else if (tab === 'onboarding') {
          const data = await adminGetAnalyticsOnboarding(token, { days: Math.max(days, 30) });
          if (!cancelled) setOnboarding(data || null);
        } else if (tab === 'signin') {
          const data = await adminGetAnalyticsSignIn(token, { days: Math.max(days, 30) });
          if (!cancelled) setSignin(data || null);
        } else if (tab === 'funnels') {
          const data = await adminGetAnalyticsFunnels(token, {
            days: Math.max(days, 30),
            openFunnel: funnelOpen,
          });
          if (!cancelled) setFunnels(data || null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, tab, days, funnelOpen]);

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!token || !selectedEvent) {
        setEventDetail(null);
        return;
      }
      try {
        setDetailLoading(true);
        const data = await adminGetAnalyticsEventDetail(token, selectedEvent, { days });
        if (!cancelled) setEventDetail(data || null);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load event detail');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [token, selectedEvent, days]);

  const topEvent = overview?.by_event?.[0];
  const totalEvents = useMemo(
    () => (overview?.by_event || []).reduce((n, row) => n + Number(row.total || 0), 0),
    [overview]
  );

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Product analytics"
        title="Analytics"
        description="Events mirrored from Firebase into your database, plus optional GA4 funnel reports from Firebase Console."
        actions={
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-sm border border-white/10 bg-[#0f0f10] px-3 py-2 text-sm text-white"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-white/8 pb-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-sm px-3 py-2 text-sm font-semibold transition ${
              tab === item.id
                ? 'bg-emerald-400/15 text-emerald-300'
                : 'text-[#9ca3af] hover:bg-white/5 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      {tab === 'overview' ? (
        <OverviewTab loading={loading} totalEvents={totalEvents} topEvent={topEvent} overview={overview} />
      ) : null}

      {tab === 'events' ? (
        <EventsTab
          loading={loading}
          events={events}
          selectedEvent={selectedEvent}
          onSelectEvent={setSelectedEvent}
          eventDetail={eventDetail}
          detailLoading={detailLoading}
        />
      ) : null}

      {tab === 'onboarding' ? <OnboardingTab loading={loading} data={onboarding} /> : null}

      {tab === 'signin' ? <SignInTab loading={loading} data={signin} /> : null}

      {tab === 'funnels' ? (
        <FunnelsTab
          loading={loading}
          data={funnels}
          funnelOpen={funnelOpen}
          onFunnelOpenChange={setFunnelOpen}
          days={Math.max(days, 30)}
        />
      ) : null}
    </section>
  );
}

function OverviewTab({ loading, totalEvents, topEvent, overview }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Events tracked" value={loading ? '…' : String(totalEvents)} accent />
        <AdminMetricCard label="Unique event types" value={loading ? '…' : String(overview?.by_event?.length || 0)} />
        <AdminMetricCard
          label="Top event"
          value={loading ? '…' : topEvent?.event_name || '—'}
          detail={topEvent ? `${topEvent.total} hits` : 'Browse the app to populate data'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Top events</p>
          {loading ? <p className="mt-4 text-sm text-[#9ca3af]">Loading…</p> : null}
          <ul className="mt-4 space-y-2">
            {(overview?.by_event || []).slice(0, 15).map((row) => (
              <li key={row.event_name} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-white">{row.event_name}</span>
                <span className="shrink-0 font-semibold text-emerald-300">{row.total}</span>
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Top pages</p>
          <ul className="mt-4 space-y-2">
            {(overview?.by_page || []).slice(0, 15).map((row) => (
              <li key={row.page_path} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-[#c6d0db]">{row.page_path}</span>
                <span className="shrink-0 text-white">{row.total}</span>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>

      <AdminCard>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#7f8ba0]">Recent activity</p>
        <ul className="mt-4 space-y-2">
          {(overview?.recent || []).slice(0, 25).map((row) => (
            <ActivityRow key={row.id} row={row} />
          ))}
        </ul>
      </AdminCard>
    </>
  );
}

function EventsTab({ loading, events, selectedEvent, onSelectEvent, eventDetail, detailLoading }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <AdminCard className="overflow-x-auto p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-[11px] uppercase tracking-[0.12em] text-[#7f8ba0]">
            <tr>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Users</th>
              <th className="px-4 py-3 font-medium">Sessions</th>
              <th className="px-4 py-3 font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-[#9ca3af]">
                  Loading events…
                </td>
              </tr>
            ) : null}
            {(events?.events || []).map((row) => (
              <tr
                key={row.event_name}
                onClick={() => onSelectEvent(row.event_name)}
                className={`cursor-pointer border-b border-white/5 hover:bg-white/[0.03] ${
                  selectedEvent === row.event_name ? 'bg-emerald-400/[0.06]' : ''
                }`}
              >
                <td className="px-4 py-3 font-medium text-white">{row.event_name}</td>
                <td className="px-4 py-3 text-emerald-300">{row.total}</td>
                <td className="px-4 py-3 text-[#9ca3af]">{row.unique_users}</td>
                <td className="px-4 py-3 text-[#9ca3af]">{row.unique_sessions}</td>
                <td className="px-4 py-3 text-xs text-[#6b7280]">{formatDate(row.last_seen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>

      <AdminCard>
        {!selectedEvent ? (
          <p className="text-sm text-[#9ca3af]">Select an event to inspect daily volume, properties, and recent hits.</p>
        ) : detailLoading ? (
          <p className="text-sm text-[#9ca3af]">Loading {selectedEvent}…</p>
        ) : (
          <EventDetailPanel detail={eventDetail} />
        )}
      </AdminCard>
    </div>
  );
}

function EventDetailPanel({ detail }) {
  if (!detail) return null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Event detail</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{detail.event_name}</h2>
        <p className="mt-1 text-sm text-[#9ca3af]">
          {detail.summary?.total || 0} hits · {detail.summary?.unique_users || 0} users ·{' '}
          {detail.summary?.unique_sessions || 0} sessions
        </p>
      </div>

      {(detail.by_day || []).length ? (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[#7f8ba0]">Daily volume</p>
          <ul className="mt-2 space-y-1">
            {detail.by_day.map((row) => (
              <li key={row.day} className="flex justify-between text-sm">
                <span className="text-[#c6d0db]">{formatDay(row.day)}</span>
                <span className="text-white">
                  {row.total} <span className="text-[#6b7280]">({row.unique_users} users)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(detail.prop_breakdown || []).length ? (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[#7f8ba0]">Top properties</p>
          <ul className="mt-2 space-y-1">
            {detail.prop_breakdown.map((row) => (
              <li key={`${row.prop}-${row.value}`} className="flex justify-between gap-3 text-sm">
                <span className="truncate text-[#c6d0db]">
                  {row.prop}: {row.value}
                </span>
                <span className="shrink-0 text-emerald-300">{row.total}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-[#7f8ba0]">Recent hits</p>
        <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
          {(detail.recent || []).slice(0, 20).map((row) => (
            <ActivityRow key={row.id} row={row} compact />
          ))}
        </ul>
      </div>
    </div>
  );
}

function toFunnelSteps(rows = []) {
  return (rows || []).map((step, index, arr) => {
    const users = Number(step.unique_users || 0);
    const nextUsers = Number(arr[index + 1]?.unique_users || 0);
    const abandonments = index < arr.length - 1 ? Math.max(users - nextUsers, 0) : 0;
    return {
      step_index: index + 1,
      name: step.label,
      event: step.key,
      active_users: users,
      step_completion_rate: users > 0 && index < arr.length - 1 ? nextUsers / users : users > 0 ? 1 : 0,
      abandonments,
      abandonment_rate: users > 0 ? abandonments / users : 0,
    };
  });
}

function OnboardingTab({ loading, data }) {
  if (loading) return <p className="text-sm text-[#9ca3af]">Loading onboarding analytics…</p>;
  if (!data) return null;

  const funnelSteps = toFunnelSteps(data.funnel);
  const billingSteps = toFunnelSteps(data.billing_funnel);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Completion rate"
          value={`${data.completion_rate || 0}%`}
          detail="Started → completed onboarding"
          accent
        />
        <AdminMetricCard
          label="Started"
          value={String(data.funnel?.find((s) => s.key === 'onboarding_started')?.unique_users || 0)}
          detail="Unique users"
        />
        <AdminMetricCard
          label="Completed"
          value={String(data.funnel?.find((s) => s.key === 'onboarding_completed')?.unique_users || 0)}
          detail="Finished setup"
        />
        <AdminMetricCard
          label="Paid"
          value={String(data.billing_funnel?.find((s) => s.key === 'onboarding_billing_payment_success')?.unique_users || 0)}
          detail={`${data.billing_conversion_rate || 0}% unlock → paid`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GaFunnelChart
          title="Onboarding (all roles)"
          subtitle="Combined setup questions"
          badge={<AdminBadge>Database copy</AdminBadge>}
          steps={funnelSteps}
          summary={{
            entered: funnelSteps[0]?.active_users || 0,
            completed: funnelSteps.find((s) => s.event === 'onboarding_completed')?.active_users || 0,
            overall_conversion: (data.completion_rate || 0) / 100,
          }}
        />

        <GaFunnelChart
          title="Billing (all roles)"
          subtitle="Combined unlock → plan → pay"
          badge={<AdminBadge>Database copy</AdminBadge>}
          steps={billingSteps}
          summary={{
            entered: billingSteps[0]?.active_users || 0,
            completed: billingSteps.find((s) => s.event === 'onboarding_billing_payment_success')?.active_users || 0,
            overall_conversion: (data.billing_conversion_rate || 0) / 100,
          }}
        />
      </div>

      {(data.role_breakdown || []).length ? (
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Flows by role</p>
          <p className="mt-1 text-xs text-[#7f8ba0]">
            Which onboarding path people chose: founder, media buyer, in-house, or agency.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.12em] text-[#7f8ba0]">
                <tr>
                  <th className="py-2 pr-4 font-medium">Flow</th>
                  <th className="py-2 pr-4 font-medium">Entered</th>
                  <th className="py-2 pr-4 font-medium">Completed</th>
                  <th className="py-2 pr-4 font-medium">Unlock</th>
                  <th className="py-2 pr-4 font-medium">Paid</th>
                  <th className="py-2 font-medium">Unlock → paid</th>
                </tr>
              </thead>
              <tbody>
                {data.role_breakdown.map((row) => (
                  <tr key={row.role} className="border-t border-white/8">
                    <td className="py-2 pr-4 text-white">{row.label}</td>
                    <td className="py-2 pr-4 text-[#9ca3af]">{row.started}</td>
                    <td className="py-2 pr-4 text-[#9ca3af]">{row.completed}</td>
                    <td className="py-2 pr-4 text-[#9ca3af]">{row.unlock_viewed}</td>
                    <td className="py-2 pr-4 text-[#9ca3af]">{row.paid}</td>
                    <td className="py-2 text-[#9ca3af]">
                      {row.unlock_viewed
                        ? `${Math.round((row.paid / row.unlock_viewed) * 1000) / 10}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      ) : null}

      {(data.role_funnels || []).some((row) => row.started || row.completed) ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.role_funnels
            .filter((row) => row.started || row.completed || row.paid)
            .map((row) => (
              <div key={row.role} className="grid gap-4">
                <GaFunnelChart
                  title={`${row.label} · setup`}
                  subtitle="This role’s onboarding questions"
                  badge={<AdminBadge>{row.completion_rate}% completed</AdminBadge>}
                  steps={toFunnelSteps(row.funnel)}
                  summary={{
                    entered: row.started,
                    completed: row.completed,
                    overall_conversion: (row.completion_rate || 0) / 100,
                  }}
                />
                <GaFunnelChart
                  title={`${row.label} · billing`}
                  subtitle="This role’s unlock → pay"
                  badge={<AdminBadge>{row.paid} paid</AdminBadge>}
                  steps={toFunnelSteps(row.billing_funnel)}
                  summary={{
                    entered: row.billing_funnel?.[0]?.unique_users || 0,
                    completed: row.paid,
                    overall_conversion:
                      (row.billing_funnel?.[0]?.unique_users || 0) > 0
                        ? row.paid / row.billing_funnel[0].unique_users
                        : 0,
                  }}
                />
              </div>
            ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {(data.billing_outcomes || []).length ? (
          <AdminCard>
            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Billing outcomes</p>
            <p className="mt-1 text-xs text-[#7f8ba0]">
              Card details are entered on the payment page. “Returned without paying” means they left checkout before completing.
            </p>
            <ul className="mt-4 space-y-2">
              {data.billing_outcomes.map((row) => (
                <li key={row.key} className="flex justify-between text-sm">
                  <span className="text-white">{row.label}</span>
                  <span className="text-[#9ca3af]">
                    {row.total} hits · {row.unique_users} users
                  </span>
                </li>
              ))}
            </ul>
          </AdminCard>
        ) : null}

        {(data.plan_breakdown || []).length ? (
          <AdminCard>
            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Plans selected</p>
            <ul className="mt-4 space-y-2">
              {data.plan_breakdown.map((row) => (
                <li key={row.plan_key} className="flex justify-between text-sm">
                  <span className="text-white capitalize">{row.plan_key}</span>
                  <span className="text-[#9ca3af]">
                    {row.total} hits · {row.unique_users} users
                  </span>
                </li>
              ))}
            </ul>
          </AdminCard>
        ) : null}
      </div>

      {(data.question_answers || []).length ? (
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Question answers</p>
          <ul className="mt-4 space-y-2">
            {data.question_answers.map((row) => (
              <li key={row.key} className="flex justify-between text-sm">
                <span className="text-white">{row.label}</span>
                <span className="text-[#9ca3af]">
                  {row.total} answers · {row.unique_users} users
                </span>
              </li>
            ))}
          </ul>
        </AdminCard>
      ) : null}

      {(data.step_breakdown || []).length ? (
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Screen views</p>
          <ul className="mt-4 space-y-2">
            {data.step_breakdown.map((row) => (
              <li key={row.step_key} className="flex justify-between text-sm">
                <span className="text-white">{row.label || row.step_key}</span>
                <span className="text-[#9ca3af]">
                  {row.views} views · {row.unique_users} users
                </span>
              </li>
            ))}
          </ul>
        </AdminCard>
      ) : null}

      {(data.dropoffs || []).length ? (
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-rose-300">Left on this step</p>
          <ul className="mt-4 space-y-2">
            {data.dropoffs.map((row) => (
              <li key={`${row.role || 'unknown'}::${row.step_key}`} className="flex justify-between text-sm">
                <span className="text-white">
                  {row.label || row.step_key}
                  {row.role && row.role !== 'unknown' ? ` · ${row.role}` : ''}
                </span>
                <span className="text-[#9ca3af]">
                  {row.total} leaves · {row.unique_users} users
                </span>
              </li>
            ))}
          </ul>
        </AdminCard>
      ) : null}

      <AdminCard>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#7f8ba0]">Recent onboarding activity</p>
        <ul className="mt-4 space-y-2">
          {(data.recent || []).slice(0, 20).map((row) => (
            <ActivityRow key={row.id} row={row} />
          ))}
        </ul>
      </AdminCard>
    </>
  );
}

function SignInTab({ loading, data }) {
  if (loading) return <p className="text-sm text-[#9ca3af]">Loading sign-in analytics…</p>;
  if (!data) return null;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard
          label="Client sign-in events"
          value={String(data.client_events?.total || 0)}
          detail={`${data.client_events?.unique_users || 0} unique users tracked`}
          accent
        />
        <AdminMetricCard
          label="Active users (server)"
          value={String(data.active_users_server || 0)}
          detail="Users with API activity in range"
        />
        <AdminMetricCard
          label="Unique sign-in sessions"
          value={String(data.client_events?.unique_sessions || 0)}
          detail="From user_signed_in events"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Sign-ins by day</p>
          <ul className="mt-4 space-y-2">
            {(data.by_day || []).map((row) => (
              <li key={row.day} className="flex justify-between text-sm">
                <span className="text-[#c6d0db]">{formatDay(row.day)}</span>
                <span className="text-white">
                  {row.total} <span className="text-[#6b7280]">({row.unique_users} users)</span>
                </span>
              </li>
            ))}
            {!data.by_day?.length ? <li className="text-sm text-[#9ca3af]">No user_signed_in events yet — sign in once to test.</li> : null}
          </ul>
        </AdminCard>

        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Recent server logins</p>
          <ul className="mt-4 space-y-2">
            {(data.recent_server_logins || []).slice(0, 15).map((row) => (
              <li key={row.id} className="rounded-sm border border-white/8 bg-black/20 px-3 py-2 text-sm">
                <p className="font-medium text-white">{row.email}</p>
                <p className="mt-1 text-xs text-[#9ca3af]">
                  Last login {formatDate(row.last_login_at)} · {row.login_count} total logins
                </p>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>

      <AdminCard>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#7f8ba0]">Recent client sign-in events</p>
        <ul className="mt-4 space-y-2">
          {(data.recent_client_logins || []).slice(0, 20).map((row) => (
            <ActivityRow key={row.id} row={row} />
          ))}
        </ul>
      </AdminCard>
    </>
  );
}

function FunnelsTab({ loading, data, funnelOpen, onFunnelOpenChange, days }) {
  if (loading) return <p className="text-sm text-[#9ca3af]">Loading funnel analytics…</p>;
  if (!data) return null;

  const ga4 = data.ga4_funnel || {};

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#9ca3af]">
          Standard funnel exploration layout — closed funnel matches GA4 sequential paths; open funnel counts events in any order.
        </p>
        <div className="inline-flex rounded-sm border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            onClick={() => onFunnelOpenChange(false)}
            className={`rounded-sm px-3 py-1.5 text-xs font-semibold ${
              !funnelOpen ? 'bg-emerald-400/15 text-emerald-300' : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            Closed funnel
          </button>
          <button
            type="button"
            onClick={() => onFunnelOpenChange(true)}
            className={`rounded-sm px-3 py-1.5 text-xs font-semibold ${
              funnelOpen ? 'bg-emerald-400/15 text-emerald-300' : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            Open funnel
          </button>
        </div>
      </div>

      {ga4.configured ? (
        <GaFunnelChart
          title="Firebase / GA4"
          subtitle={ga4.funnel_name || 'Signup → onboarding → billing'}
          badge={<AdminBadge tone="success">Live from GA4</AdminBadge>}
          steps={ga4.steps || []}
          summary={ga4.summary}
          isOpenFunnel={Boolean(ga4.is_open_funnel)}
          showOpenColumn
        />
      ) : (
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-amber-300">GA4 funnel unavailable</p>
          <p className="mt-3 text-sm leading-6 text-[#9ca3af]">
            Configure <code className="text-white">GA4_PROPERTY_ID</code> and service account credentials in{' '}
            <code className="text-white">server/.env</code> to load funnels from Firebase / Google Analytics.
          </p>
          {ga4.message ? <p className="mt-3 text-xs text-rose-300">{ga4.message}</p> : null}
        </AdminCard>
      )}

      <LocalFunnelChart funnel={data.local_onboarding_funnel || []} completionRate={data.local_completion_rate || 0} />

      {data.ga4_events?.configured ? (
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">All GA4 events · last {days} days</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/8 text-[10px] uppercase tracking-[0.12em] text-[#7f8ba0]">
                <tr>
                  <th className="px-3 py-2 font-medium">Event name</th>
                  <th className="px-3 py-2 font-medium text-right">Event count</th>
                  <th className="px-3 py-2 font-medium text-right">Active users</th>
                </tr>
              </thead>
              <tbody>
                {(data.ga4_events.events || []).slice(0, 20).map((row) => (
                  <tr key={row.event_name} className="border-b border-white/5">
                    <td className="px-3 py-2 font-mono text-xs text-white">{row.event_name}</td>
                    <td className="px-3 py-2 text-right text-[#c6d0db]">{row.event_count}</td>
                    <td className="px-3 py-2 text-right text-emerald-300">{row.active_users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      ) : null}
    </>
  );
}

function ActivityRow({ row, compact = false }) {
  return (
    <li className={`rounded-sm border border-white/8 bg-black/20 px-3 py-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-white">{row.event_name}</span>
        <span className="text-[#6b7280]">{formatDate(row.created_at)}</span>
      </div>
      <p className="mt-1 text-[#9ca3af]">
        {row.page_path || '—'}
        {row.user_id ? ` · user ${row.user_id.slice(0, 12)}…` : ' · anonymous'}
        {row.props?.step_key ? ` · step ${row.props.step_key}` : ''}
        {row.props?.audience_role ? ` · ${row.props.audience_role}` : ''}
      </p>
    </li>
  );
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function formatDay(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}
