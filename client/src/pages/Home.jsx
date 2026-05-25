import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { getDashboardOverview } from '../lib/api.js';
import { useApiToast } from '../hooks/useApiToast.js';

function Home() {
  const { getToken } = useAuth();
  const { notifyApiError } = useApiToast();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) throw new Error('Session token unavailable');
        const data = await getDashboardOverview(token);
        if (!cancelled) setDashboard(data || {});
      } catch (error) {
        if (!cancelled) {
          setDashboard(null);
          notifyApiError(error, 'Failed to load the intelligence dashboard.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [getToken, notifyApiError, retryTick]);

  if (loading) {
    return <CubeLoaderOverlay label="Loading intelligence dashboard..." minHeight="52vh" />;
  }

  if (!dashboard) {
    return (
      <section className="space-y-4">
        <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Intelligence Hub</p>
          <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">The dashboard is temporarily unavailable</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Retry to refresh market trends and the latest official platform updates.
          </p>
          <button
            type="button"
            onClick={() => setRetryTick((value) => value + 1)}
            className="mt-4 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-black"
          >
            Retry dashboard
          </button>
        </header>
      </section>
    );
  }

  const researchActivity = dashboard.market_trends?.research_activity?.points || [];
  const researchTotals = dashboard.market_trends?.research_activity?.totals || {};
  const searchConsole = dashboard.market_trends?.search_console || {};
  const topTopics = dashboard.market_trends?.top_topics || [];
  const platformUpdates = dashboard.platform_updates || [];
  const platformStatus = dashboard.platform_status || [];
  const featuredUpdates = platformUpdates.slice(0, 3);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Intelligence Hub</p>
            <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
              {dashboard.headline?.title || 'Marketing intelligence dashboard'}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              {dashboard.headline?.subtitle || 'Track platform changes and search interest in one place.'}
            </p>
          </div>
          <div className="min-w-[220px] rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Last refreshed</p>
            <p className="mt-1 text-sm font-medium text-white">{formatDateTime(dashboard.headline?.last_updated_at)}</p>
            <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-slate-400">Active content sources</p>
            <p className="mt-1 text-sm text-slate-300">
              {platformStatus.filter((item) => item.ok).length} of {platformStatus.length} live
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Research activity trend" subtitle="What your team has been researching in the last two weeks.">
          <MetricStrip
            items={[
              { label: 'Searches (30d)', value: researchTotals.searches_30d ?? 0 },
              { label: 'Results reviewed', value: researchTotals.results_30d ?? 0 },
              { label: 'Concepts saved', value: researchTotals.bookmarks_count ?? 0 },
            ]}
          />
          <div className="mt-4">
            <LineChart
              points={researchActivity}
              dataKey="searches"
              color="#34d399"
              height={220}
              valueSuffix=""
              emptyLabel="No search activity yet."
            />
          </div>
        </Panel>

        <Panel title="Topic momentum" subtitle="The keywords receiving the most research attention.">
          <div className="space-y-3">
            {topTopics.length ? topTopics.map((topic) => (
              <article key={topic.keyword} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{topic.keyword}</h3>
                    <p className="mt-1 text-xs text-slate-400">Last searched {formatDateTime(topic.last_searched_at)}</p>
                  </div>
                  <div className="text-right text-xs text-slate-300">
                    <p>{topic.searches} searches</p>
                    <p>{topic.results} results</p>
                  </div>
                </div>
                <div className="mt-3">
                  <BarMeter value={topic.searches} maxValue={topTopics[0]?.searches || 1} color="#60a5fa" />
                </div>
              </article>
            )) : <EmptyState message="Run searches across the app and your top topics will appear here." />}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Site performance" subtitle="Track how your own site is trending in search when connected.">
          {searchConsole.connected ? (
            <>
              <MetricStrip
                items={[
                  { label: 'Clicks', value: searchConsole.totals?.clicks ?? 0 },
                  { label: 'Impressions', value: searchConsole.totals?.impressions ?? 0 },
                  { label: 'Avg CTR', value: `${searchConsole.totals?.avg_ctr ?? 0}%` },
                  { label: 'Avg Position', value: searchConsole.totals?.avg_position ?? 0 },
                ]}
              />
              <div className="mt-4">
                <LineChart
                  points={searchConsole.points || []}
                  dataKey="clicks"
                  color="#f59e0b"
                  height={220}
                  valueSuffix=""
                  emptyLabel="No Search Console points returned."
                />
              </div>
              <p className="mt-3 text-xs text-slate-400">Property: {searchConsole.site_url}</p>
            </>
          ) : (
            <EmptyState
              message={
                searchConsole.message ||
                'Site performance data is not connected yet.'
              }
            />
          )}
        </Panel>

        <Panel title="Latest headlines" subtitle="Quick reads from the main platform updates.">
          <div className="space-y-2">
            {featuredUpdates.length ? featuredUpdates.map((item) => (
              <article key={`${item.source}-headline-${item.url}`} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
                    {item.source}{item.published_at ? ` · ${formatDate(item.published_at)}` : ''}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{item.title}</p>
                </div>
              </article>
            )) : <EmptyState message="Fresh platform headlines will appear here." />}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4">
        <Panel title="Official platform updates" subtitle="Fresh updates from Google Ads, TikTok, and Meta sources.">
          <div className="space-y-3">
            {platformUpdates.length ? platformUpdates.map((item) => (
              <article key={`${item.source}-${item.url}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">
                  <span>{item.source}</span>
                  {item.published_at ? <span>{formatDate(item.published_at)}</span> : null}
                </div>
                <h3 className="mt-2 text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{item.excerpt || 'Open the source article to read the update.'}</p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/5"
                >
                  Open source article
                </a>
              </article>
            )) : <EmptyState message="Official platform updates could not be pulled right now." />}
          </div>
        </Panel>
      </section>
    </section>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MetricStrip({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
        </article>
      ))}
    </div>
  );
}

function LineChart({ points, dataKey, color, height, valueSuffix, emptyLabel }) {
  const numericPoints = points.filter((point) => Number.isFinite(Number(point?.[dataKey])));
  if (!numericPoints.length || numericPoints.every((point) => Number(point[dataKey]) === 0)) {
    return <EmptyState message={emptyLabel} />;
  }

  const width = 100;
  const maxValue = Math.max(...numericPoints.map((point) => Number(point[dataKey]) || 0), 1);
  const path = numericPoints
    .map((point, index) => {
      const x = numericPoints.length === 1 ? width / 2 : (index / (numericPoints.length - 1)) * width;
      const y = 100 - ((Number(point[dataKey]) || 0) / maxValue) * 100;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
        <defs>
          <linearGradient id={`fill-${dataKey}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d="M 0 100 L 0 0" stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />
        <path d="M 0 100 L 100 100" stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />
        <path d={`${path} L 100 100 L 0 100 Z`} fill={`url(#fill-${dataKey})`} stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400 md:grid-cols-4">
        {numericPoints.slice(-4).map((point) => (
          <div key={`${point.date}-${point[dataKey]}`}>
            <p>{formatDate(point.date)}</p>
            <p className="mt-1 text-sm text-slate-200">{point[dataKey]}{valueSuffix}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarMeter({ value, maxValue, color }) {
  const width = Math.max(10, Math.round((Number(value || 0) / Math.max(Number(maxValue || 1), 1)) * 100));
  return (
    <div className="h-2 rounded-full bg-white/8">
      <div className="h-2 rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] px-4 py-6 text-sm text-slate-400">
      {message}
    </div>
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString();
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString();
}

export default Home;
