import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import SectionCard from '../components/decision-engine/SectionCard.jsx';
import RadarBriefModal from '../components/competitor-radar/RadarBriefModal.jsx';
import {
  ArrowRightIcon,
  BackIcon,
  ExternalLinkIcon,
  PlusIcon,
  RadarIcon,
} from '../components/competitor-radar/RadarIcons.jsx';
import { useApiToast } from '../hooks/useApiToast.js';
import { createCompetitorWatchlistItem, runCompetitorRadar } from '../lib/api.js';

const RADAR_STORAGE_KEY = 'competitor-radar:last-result';

function CompetitorRadar() {
  const { getToken } = useAuth();
  const { notifyApiError } = useApiToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { competitorId } = useParams();
  const basePath = getRadarBasePath(location.pathname);
  const [brief, setBrief] = useState('');
  const [radar, setRadar] = useState(() => readStoredRadar());
  const [modalOpen, setModalOpen] = useState(false);
  const [working, setWorking] = useState('');
  const [watchlistMessages, setWatchlistMessages] = useState({});

  const competitors = radar?.competitors || [];
  const competitor = competitors.find((item) => item.id === competitorId);
  const canRun = brief.trim().length >= 8 && working !== 'radar';
  const isResultsPage = location.pathname.endsWith('/results');

  const radarMeta = useMemo(() => {
    const searchBrief = radar?.search_brief || {};
    return [
      { label: 'Category', value: searchBrief.category },
      { label: 'Buyer Focus', value: searchBrief.buyer },
      { label: 'Dominant Geo', value: joinList(searchBrief.geo) },
      { label: 'Risk Signals', value: joinList(searchBrief.signals) },
    ].filter((item) => item.value);
  }, [radar]);

  const handleRunRadar = async () => {
    try {
      setWorking('radar');
      setWatchlistMessages({});
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      const data = await runCompetitorRadar(token, { brief });
      setRadar(data || null);
      writeStoredRadar(data || null);
      setModalOpen(false);
      navigate(`${basePath}/results`);
    } catch (err) {
      notifyApiError(err, 'Failed to run competitor radar.');
    } finally {
      setWorking('');
    }
  };

  const handleAddToWatchlist = async (selectedCompetitor) => {
    try {
      setWorking(`watch-${selectedCompetitor.id}`);
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      await createCompetitorWatchlistItem(token, {
        competitor_name: selectedCompetitor.name,
        platform: 'web',
        keyword: selectedCompetitor.website ? websiteHost(selectedCompetitor.website) : selectedCompetitor.name,
      });
      setWatchlistMessages((prev) => ({ ...prev, [selectedCompetitor.id]: 'Added to watchlist' }));
    } catch (err) {
      setWatchlistMessages((prev) => ({
        ...prev,
        [selectedCompetitor.id]: err?.message || 'Could not add to watchlist',
      }));
    } finally {
      setWorking('');
    }
  };

  return (
    <div className="space-y-4">
      {competitorId ? (
        <CompetitorDetailPage
          basePath={basePath}
          competitor={competitor}
          working={working === `watch-${competitor?.id}`}
          message={watchlistMessages[competitor?.id]}
          onAddToWatchlist={() => competitor && handleAddToWatchlist(competitor)}
          onNewRadar={() => setModalOpen(true)}
        />
      ) : isResultsPage ? (
        <RadarResultsPage
          basePath={basePath}
          radar={radar}
          radarMeta={radarMeta}
          competitors={competitors}
          working={working}
          watchlistMessages={watchlistMessages}
          onAddToWatchlist={handleAddToWatchlist}
          onNewRadar={() => setModalOpen(true)}
        />
      ) : (
        <RadarOverviewPage
          basePath={basePath}
          radar={radar}
          radarMeta={radarMeta}
          competitors={competitors}
          onNewRadar={() => setModalOpen(true)}
        />
      )}

      <RadarBriefModal
        open={modalOpen}
        brief={brief}
        working={working}
        canRun={canRun}
        onBriefChange={setBrief}
        onClose={() => setModalOpen(false)}
        onRun={handleRunRadar}
      />
    </div>
  );
}

function RadarOverviewPage({ basePath, radar, radarMeta, competitors, onNewRadar }) {
  if (!radar) {
    return (
      <section className="rounded-lg border border-dashed border-white/12 bg-[#101012] p-5">
        <div className="flex max-w-xl flex-col items-start">
          <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-violet-500 text-white">
            <PlusIcon className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-white">Create the first radar</h2>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Use the plus button to describe the competitors you want to find.
          </p>
          <button
            type="button"
            onClick={onNewRadar}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-sm border border-white/12 px-3 text-xs font-semibold text-white hover:border-violet-400/45 hover:bg-violet-400/10"
          >
            <RadarIcon className="h-3.5 w-3.5" />
            Open brief
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <MarketOverview radar={radar} radarMeta={radarMeta} onNewRadar={onNewRadar} />
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Competitor Watch</h2>
          <Link
            to={`${basePath}/results`}
            className="inline-flex h-8 items-center gap-2 rounded-sm bg-violet-500 px-3 text-xs font-bold text-white hover:bg-violet-400"
          >
            Results
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {competitors.slice(0, 4).map((competitor) => (
            <CompetitorWatchCard
              key={competitor.id}
              basePath={basePath}
              competitor={competitor}
              working={false}
              message=""
              onAddToWatchlist={() => {}}
              compact
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function RadarResultsPage({
  basePath,
  radar,
  radarMeta,
  competitors,
  working,
  watchlistMessages,
  onAddToWatchlist,
  onNewRadar,
}) {
  if (!radar) {
    return (
      <SectionCard title="No results yet" subtitle="Create a radar first.">
        <button
          type="button"
          onClick={onNewRadar}
          className="inline-flex h-9 items-center gap-2 rounded-sm bg-violet-500 px-3 text-xs font-bold text-white hover:bg-violet-400"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          New radar
        </button>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-5">
      <MarketOverview radar={radar} radarMeta={radarMeta} onNewRadar={onNewRadar} />

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Competitor Watch</h2>
            <p className="mt-1 text-[11px] text-slate-500">{competitors.length} companies mapped from this radar brief.</p>
          </div>
          <div className="flex gap-1.5">
            <IconButton label="Filter competitors"><FilterIcon className="h-3.5 w-3.5" /></IconButton>
            <IconButton label="Sort competitors"><SortIcon className="h-3.5 w-3.5" /></IconButton>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {competitors.map((competitor) => (
            <CompetitorWatchCard
              key={competitor.id}
              basePath={basePath}
              competitor={competitor}
              working={working === `watch-${competitor.id}`}
              message={watchlistMessages[competitor.id]}
              onAddToWatchlist={() => onAddToWatchlist(competitor)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function MarketOverview({ radar, radarMeta, onNewRadar }) {
  const filledMeta = radarMeta.length
    ? radarMeta
    : [
        { label: 'Category', value: 'Not set' },
        { label: 'Buyer Focus', value: 'Not set' },
        { label: 'Dominant Geo', value: 'Not set' },
        { label: 'Risk Signals', value: 'Not set' },
      ];

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold text-slate-300">Market Overview</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold uppercase text-emerald-300">
            {radar.generation_mode === 'ai' ? 'Real time data' : 'Radar map'}
          </span>
          <button
            type="button"
            onClick={onNewRadar}
            className="flex h-7 w-7 items-center justify-center rounded-sm bg-violet-500 text-white hover:bg-violet-400"
            aria-label="Create new radar"
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {filledMeta.slice(0, 4).map((item, index) => (
          <MarketOverviewCard key={item.label} label={item.label} value={item.value} index={index} />
        ))}
      </div>
    </section>
  );
}

function MarketOverviewCard({ label, value, index }) {
  const meta = [
    { kicker: 'Category', accent: 'text-violet-300', note: '+12.4% growth' },
    { kicker: 'Buyer Focus', accent: 'text-cyan-300', note: 'Primary target demographics' },
    { kicker: 'Dominant Geo', accent: 'text-slate-200', note: 'Expanded in radar scope' },
    { kicker: 'Risk Signals', accent: 'text-amber-300', note: '3 critical alerts' },
  ][index] || { kicker: label, accent: 'text-slate-200', note: 'Radar signal' };

  return (
    <div className="rounded-sm border border-white/10 bg-[#171719] p-3 shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
      <p className="text-[9px] font-black uppercase text-slate-500">{meta.kicker || label}</p>
      <p className={`mt-2 truncate text-base font-black ${meta.accent}`}>{value}</p>
      <p className="mt-1 truncate text-[10px] text-slate-500">{meta.note}</p>
    </div>
  );
}

function CompetitorWatchCard({ basePath, competitor, working, message, onAddToWatchlist, compact = false }) {
  const tone = getConfidenceTone(competitor.confidence);
  const year = getOperatingYear(competitor.operating_since);

  return (
    <article className="group overflow-hidden rounded-sm border border-white/10 bg-[#151517] shadow-[0_12px_28px_rgba(0,0,0,0.24)] transition hover:-translate-y-0.5 hover:border-violet-400/35">
      <div className={`relative h-24 ${getCompetitorArtClass(competitor.name)}`}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.07)_0,transparent_42%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.14),transparent_24%)]" />
        <div className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-lg border border-black/20 bg-white text-xs font-black text-black shadow-lg">
          {getInitials(competitor.name)}
        </div>
        <span className={`absolute bottom-3 right-3 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${tone.badge}`}>
          {competitor.confidence || 'low'}
        </span>
      </div>

      <div className="p-3">
        <div className="min-h-[86px]">
          <h2 className="truncate text-sm font-semibold text-white">{competitor.name}</h2>
          <p className="mt-0.5 text-[10px] text-slate-500">{year}</p>
          <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-slate-300">{competitor.why_relevant || competitor.audience}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            to={`${basePath}/competitors/${competitor.id}`}
            className="inline-flex h-8 items-center justify-center rounded-sm bg-violet-500 px-2 text-xs font-bold text-white hover:bg-violet-400"
          >
            Details
          </Link>
          <button
            type="button"
            onClick={compact ? undefined : onAddToWatchlist}
            disabled={working || compact}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-sm border border-white/12 bg-[#111113] px-2 text-xs font-bold text-white hover:border-violet-400/45 disabled:opacity-60"
          >
            <PlusIcon className="h-3 w-3" />
            {working ? 'Adding' : 'Watch'}
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          {competitor.website ? (
            <a
              href={competitor.website}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 truncate text-[10px] font-semibold text-cyan-300 hover:text-cyan-200"
              aria-label={`Open ${competitor.name} website`}
            >
              {websiteHost(competitor.website)}
            </a>
          ) : (
            <span className="text-[10px] text-slate-600">website pending</span>
          )}
          {message ? <span className="shrink-0 text-[10px] text-slate-500">{message}</span> : null}
        </div>
      </div>
    </article>
  );
}

function CompetitorDetailPage({ basePath, competitor, working, message, onAddToWatchlist, onNewRadar }) {
  if (!competitor) {
    return (
      <SectionCard title="Competitor not found" subtitle="This radar result is unavailable.">
        <div className="flex flex-wrap gap-2">
          <Link
            to={`${basePath}/results`}
            className="inline-flex h-9 items-center gap-2 rounded-sm border border-white/12 px-3 text-xs font-semibold text-white hover:bg-white/10"
          >
            <BackIcon className="h-3.5 w-3.5" />
            Back to results
          </Link>
          <button
            type="button"
            onClick={onNewRadar}
            className="inline-flex h-9 items-center gap-2 rounded-sm bg-violet-500 px-3 text-xs font-semibold text-white hover:bg-violet-400"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New radar
          </button>
        </div>
      </SectionCard>
    );
  }

  const stats = buildCompetitorStats(competitor);
  const features = buildFeatureList(competitor);
  const swot = buildSwot(competitor);
  const activity = buildActivity(competitor);
  const tone = getConfidenceTone(competitor.confidence);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`${basePath}/results`} className="text-slate-400 hover:text-white" aria-label="Back to results">
            <BackIcon className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-500">
              Competitor Watch <span className="mx-2 text-slate-700">&gt;</span>
              <span className="text-violet-300">{competitor.name}</span>
            </p>
            <h2 className="mt-1 text-lg font-black uppercase text-white">Radar Brief</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddToWatchlist}
          disabled={working}
          className="inline-flex h-9 items-center gap-2 rounded-sm border border-white/12 bg-[#19191c] px-3 text-xs font-bold text-white hover:border-violet-400/45 disabled:opacity-60"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {working ? 'Adding...' : 'Watch'}
        </button>
      </div>

      <section className="overflow-hidden rounded-lg border border-white/10 bg-[#18181b] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
        <div className={`h-32 ${getCompetitorArtClass(competitor.name)}`} />
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(340px,0.45fr)] md:p-8">
          <div className="min-w-0">
            <div className="-mt-24 mb-6 flex h-24 w-24 items-center justify-center rounded-lg border border-white/10 bg-[#111113] text-2xl font-black text-white shadow-xl">
              {getInitials(competitor.name)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-white">{competitor.name}</h1>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${tone.badge}`}>{competitor.confidence}</span>
            </div>
            <p className="mt-3 max-w-3xl text-sm italic leading-6 text-slate-300">"{competitor.positioning || competitor.why_relevant}"</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {buildTags(competitor).map((tag, index) => (
                <span key={tag} className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${getTagClass(index)}`}>
                  {tag}
                </span>
              ))}
            </div>
            {message ? <p className="mt-3 text-xs text-slate-400">{message}</p> : null}
          </div>
          <div className="grid grid-cols-3 gap-4 self-end">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-[10px] font-black uppercase text-slate-500">{stat.label}</p>
                <p className="mt-1 text-lg font-black text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ReportPanel title="Product Info" icon={<SmallBadgeIcon className="h-4 w-4" />}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ProductInfoTile label="Website" value={competitor.website ? websiteHost(competitor.website) : 'Not verified'} href={competitor.website} />
          <ProductInfoTile label="Offer" value={competitor.offer || 'Offer requires verification'} />
          <ProductInfoTile label="Audience" value={competitor.audience || 'Audience requires verification'} />
          <ProductInfoTile label="Positioning" value={competitor.positioning || 'Positioning requires verification'} />
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Product Signals</p>
            <ul className="mt-3 space-y-3 text-sm text-slate-200">
              {features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-black">
                    <CheckIcon className="h-2.5 w-2.5" />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-sm border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-black uppercase text-slate-500">Best Data Sources</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {buildProductSourceRows(competitor).map((row) => (
                <SourceRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </div>
        </div>
      </ReportPanel>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportPanel title="Ads & Creative Intel" icon={<TrendMiniIcon className="h-4 w-4" />}>
          <div className="grid gap-3">
            {buildAdIntelCards(competitor).map((item) => (
              <IntelCard key={item.label} label={item.label} value={item.value} source={item.source} />
            ))}
          </div>
        </ReportPanel>

        <ReportPanel title="Social Signals" icon={<SocialIcon className="h-4 w-4" />}>
          <div className="space-y-3">
            {buildSocialRows(competitor).map((row) => (
              <SocialSignalRow key={row.label} label={row.label} value={row.value} source={row.source} />
            ))}
          </div>
          <div className="mt-5">
            <div className="flex items-end justify-between gap-3">
              <p className="text-xs font-black uppercase text-slate-500">Research Confidence</p>
              <p className={`text-xl font-black ${tone.text}`}>{tone.percent}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full ${tone.bar}`} style={{ width: `${tone.percent}%` }} />
            </div>
          </div>
        </ReportPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.45fr)_minmax(0,1fr)]">
        <ReportPanel title="Strategic SWOT" icon={<SwotIcon className="h-4 w-4" />}>
          <div className="grid gap-3 sm:grid-cols-2">
            {swot.map((item) => (
              <div key={item.label} className={`border-l-2 bg-black/25 p-3 ${item.border}`}>
                <p className={`text-xs font-black uppercase ${item.text}`}>{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.value}</p>
              </div>
            ))}
          </div>
        </ReportPanel>

        <ReportPanel title="Recent Activity" icon={<ClockIcon className="h-4 w-4" />}>
          <div className="space-y-6">
            {activity.map((item, index) => (
              <div key={item.title} className="relative flex gap-4">
                <div className="relative flex w-7 justify-center">
                  <span className={`mt-1 h-5 w-5 rounded-full border-4 ${index === 0 ? 'border-violet-400 bg-violet-950' : 'border-white/15 bg-[#18181b]'}`} />
                  {index < activity.length - 1 ? <span className="absolute bottom-[-24px] top-7 w-px bg-white/10" /> : null}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">{item.date}</p>
                  <p className="mt-1 text-sm font-bold text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </ReportPanel>
      </div>
    </div>
  );
}

function ReportPanel({ title, icon, children }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#18181b] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-violet-300">{icon}</span>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ProductInfoTile({ label, value, href }) {
  const content = (
    <>
      <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white">{value}</p>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="group rounded-sm border border-white/10 bg-black/25 p-3 hover:border-cyan-300/45"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">{content}</div>
          <ExternalLinkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300 opacity-80 group-hover:opacity-100" />
        </div>
      </a>
    );
  }

  return <div className="rounded-sm border border-white/10 bg-black/25 p-3">{content}</div>;
}

function SourceRow({ label, value }) {
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-300">{value}</p>
    </div>
  );
}

function IntelCard({ label, value, source }) {
  return (
    <div className="rounded-sm border border-white/10 bg-black/25 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase text-violet-300">{label}</p>
        <span className="rounded-sm border border-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-400">{source}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-200">{value}</p>
    </div>
  );
}

function SocialSignalRow({ label, value, source }) {
  return (
    <div className="grid gap-2 rounded-sm border border-white/10 bg-black/25 p-3 md:grid-cols-[150px_minmax(0,1fr)_120px] md:items-center">
      <p className="text-xs font-black uppercase text-cyan-300">{label}</p>
      <p className="text-sm leading-6 text-slate-200">{value}</p>
      <p className="text-[10px] font-bold uppercase text-slate-500 md:text-right">{source}</p>
    </div>
  );
}

function IconButton({ label, children }) {
  return (
    <button
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded-sm border border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function getRadarBasePath(pathname) {
  return pathname.startsWith('/app/competitor-analysis') ? '/app/competitor-analysis' : '/app/competitor-radar';
}

function readStoredRadar() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem(RADAR_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeStoredRadar(radar) {
  if (typeof window === 'undefined') return;
  if (!radar) {
    window.localStorage.removeItem(RADAR_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(RADAR_STORAGE_KEY, JSON.stringify(radar));
}

function joinList(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value || '').trim();
}

function websiteHost(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return String(value || '').replace(/^https?:\/\//, '').replace(/^www\./, '');
  }
}

function getInitials(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'AI';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function getOperatingYear(value = '') {
  const text = String(value || '').trim();
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : text || 'N/V';
}

function getConfidenceTone(value = '') {
  const confidence = String(value || 'low').toLowerCase();
  if (confidence === 'high') {
    return {
      percent: 88,
      badge: 'bg-rose-500 text-white',
      text: 'text-rose-300',
      bar: 'bg-rose-400',
    };
  }
  if (confidence === 'medium') {
    return {
      percent: 72,
      badge: 'bg-emerald-500 text-black',
      text: 'text-cyan-300',
      bar: 'bg-cyan-300',
    };
  }
  return {
    percent: 48,
    badge: 'bg-slate-700 text-slate-200',
    text: 'text-slate-300',
    bar: 'bg-slate-500',
  };
}

function getCompetitorArtClass(name = '') {
  const variants = [
    'bg-[linear-gradient(135deg,#2d1b53,#163b39)]',
    'bg-[linear-gradient(135deg,#101827,#3b2a68)]',
    'bg-[linear-gradient(135deg,#3b1d2e,#4c3320)]',
    'bg-[linear-gradient(135deg,#0f2b2d,#403162)]',
    'bg-[linear-gradient(135deg,#27143f,#1d3a4b)]',
    'bg-[linear-gradient(135deg,#44223c,#153a32)]',
  ];
  const sum = String(name).split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return variants[sum % variants.length];
}

function buildTags(competitor) {
  return [
    competitor.category,
    ...(competitor.channels || []).slice(0, 2),
  ].filter(Boolean).slice(0, 3);
}

function getTagClass(index) {
  const classes = [
    'border-violet-400/35 bg-violet-400/10 text-violet-300',
    'border-cyan-400/35 bg-cyan-400/10 text-cyan-300',
    'border-amber-400/35 bg-amber-400/10 text-amber-300',
  ];
  return classes[index % classes.length];
}

function buildCompetitorStats(competitor) {
  return [
    { label: 'Founding', value: getOperatingYear(competitor.operating_since) },
    { label: 'Segment', value: shortText(competitor.category, 14) },
    { label: 'Signal', value: String(competitor.confidence || 'low').toUpperCase() },
  ];
}

function buildFeatureList(competitor) {
  const channels = competitor.channels?.length ? competitor.channels.join(' + ') : 'Website-led presence';
  return [
    competitor.offer || 'Offer requires verification',
    `${channels} distribution`,
    competitor.audience || 'Audience requires verification',
  ];
}

function buildProductSourceRows(competitor) {
  return [
    {
      label: 'Current',
      value: 'AI synthesis from the radar brief and saved brand profile.',
    },
    {
      label: 'Website',
      value: competitor.website ? 'Crawl homepage, pricing, docs, footer, and structured metadata.' : 'Find official website first, then crawl product pages.',
    },
    {
      label: 'Company',
      value: 'Enrich with Clearbit/Apollo, Crunchbase, WHOIS/domain age, or company registries.',
    },
    {
      label: 'Reviews',
      value: 'Pull G2, Trustpilot, app-store, Reddit, and marketplace reviews where relevant.',
    },
  ];
}

function buildAdIntelCards(competitor) {
  const name = competitor.name || 'competitor';
  return [
    {
      label: 'Active Ads',
      value: `Search Meta, TikTok, Google, and YouTube ad libraries for ${name}. Track active status, first-seen date, formats, landing pages, and repeated hooks.`,
      source: 'Ad APIs',
    },
    {
      label: 'Creative Angles',
      value: competitor.why_relevant || 'Classify creative by pain point, promise, proof, CTA, offer, and funnel stage.',
      source: 'LLM tags',
    },
    {
      label: 'Offer Tracking',
      value: competitor.offer || 'Capture pricing, trial, bundle, guarantee, discount, and lead magnet changes over time.',
      source: 'Crawl + ads',
    },
  ];
}

function buildSocialRows(competitor) {
  const channels = competitor.channels?.length ? competitor.channels : ['Instagram', 'TikTok', 'YouTube'];
  return [
    {
      label: 'Profiles',
      value: `Find official profiles across ${channels.slice(0, 4).join(', ')} and normalize follower counts, bios, links, and posting cadence.`,
      source: 'Social APIs',
    },
    {
      label: 'Creatives',
      value: 'Collect recent posts/reels/videos, then tag hooks, formats, topics, CTAs, comments, and recurring visual patterns.',
      source: 'Scrapers',
    },
    {
      label: 'Audience',
      value: competitor.audience || 'Infer audience from comments, reviews, bio language, ad copy, and landing page claims.',
      source: 'LLM + NLP',
    },
  ];
}

function buildSwot(competitor) {
  return [
    {
      label: 'Strengths',
      value: competitor.positioning || 'Clear market positioning in the radar brief.',
      border: 'border-cyan-300',
      text: 'text-cyan-300',
    },
    {
      label: 'Weaknesses',
      value: competitor.operating_age_note || 'Operating history and evidence still need verification.',
      border: 'border-rose-300',
      text: 'text-rose-300',
    },
    {
      label: 'Opportunities',
      value: competitor.why_relevant || 'Use this competitor to find hooks, offers, and audience language gaps.',
      border: 'border-violet-400',
      text: 'text-violet-300',
    },
    {
      label: 'Threats',
      value: competitor.offer || 'Competing offer could pull attention from similar buyer intent.',
      border: 'border-amber-300',
      text: 'text-amber-300',
    },
  ];
}

function buildActivity(competitor) {
  const steps = competitor.next_verification_steps?.length
    ? competitor.next_verification_steps
    : ['Verify official website', 'Review offer and positioning', 'Compare audience and creative signals'];
  return steps.slice(0, 3).map((step, index) => ({
    date: ['Today', 'Next', 'Later'][index] || 'Next',
    title: ['Source verification', 'Offer review', 'Audience comparison'][index] || 'Research step',
    text: step,
  }));
}

function shortText(value, max = 16) {
  const text = String(value || 'N/V');
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function CheckIcon({ className = 'h-3 w-3' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SmallBadgeIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4Z" />
      <path d="M9 12h6M12 9v6" strokeLinecap="round" />
    </svg>
  );
}

function TrendMiniIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 16l5-5 4 4 7-8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SocialIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M7 8a4 4 0 1 0 0.01 0M17 6a3 3 0 1 0 0.01 0M17 16a3 3 0 1 0 0.01 0" />
      <path d="M10.5 9.5l3.8-1.9M10.5 14.4l3.9 1.3" strokeLinecap="round" />
    </svg>
  );
}

function SwotIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z" />
    </svg>
  );
}

function ClockIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  );
}

function SortIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 7h12M8 12h9M8 17h5M4 7h.01M4 12h.01M4 17h.01" strokeLinecap="round" />
    </svg>
  );
}

export default CompetitorRadar;
