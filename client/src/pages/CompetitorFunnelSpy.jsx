import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useApiToast } from '../hooks/useApiToast.js';
import { runCompetitorFunnelSpy } from '../lib/api.js';
import BulkCreativePanel from '../components/facebook/BulkCreativePanel.jsx';
import { buildIntelFromFunnelSpy } from '../lib/bulkCreativeIntel.js';

const DEFAULT_FORM = {
  competitorInput: '',
  country: 'US',
  limit: 48,
};

function CompetitorFunnelSpy() {
  const { getToken } = useAuth();
  const { notifyApiError } = useApiToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null);

  const topPages = result?.landing_pages || [];
  const topTakeaways = result?.report?.winner_takeaways || [];
  const pageTeardowns = result?.page_teardowns || [];
  const bulkIntel = useMemo(
    () => (result ? buildIntelFromFunnelSpy(result, 0) : null),
    [result]
  );

  const summaryStats = useMemo(() => {
    const totalPages = topPages.length;
    const totalAds = Number(result?.total_ads || 0);
    const strongestPage = topPages[0];
    return {
      totalAds,
      totalPages,
      strongestPage,
    };
  }, [result, topPages]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRun = async () => {
    try {
      setWorking(true);
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      const data = await runCompetitorFunnelSpy(token, {
        competitorInput: form.competitorInput,
        country: form.country,
        limit: Number(form.limit || 48),
      });
      setResult(data || null);
    } catch (error) {
      notifyApiError(error, 'Failed to run competitor funnel spy.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-sm border border-white/10 bg-[radial-gradient(circle_at_15%_15%,rgba(34,197,94,0.12),transparent_32%),linear-gradient(180deg,#0b0b0b_0%,#090909_100%)] p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Competitor Funnel Spy</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold text-white md:text-4xl">
              Find which landing pages are actually carrying a competitor&apos;s spend.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Start from a competitor brand, Facebook page, or Meta Ad Library URL. We pull their active ads, group them by landing page, rank the likely winners, and turn the post-click funnel into a clean report.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <StatIntro
                label="Input"
                text="Brand name, Facebook page, or Meta Ad Library URL"
              />
              <StatIntro
                label="Ranking"
                text="Ad count, longevity, and repeated page support"
              />
              <StatIntro
                label="Output"
                text="Winning pages, page notes, and practical takeaways"
              />
            </div>
          </div>

          <div className="rounded-sm border border-white/10 bg-black/25 p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Run setup</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Competitor input
                </label>
                <input
                  value={form.competitorInput}
                  onChange={(event) => handleChange('competitorInput', event.target.value)}
                  placeholder="Jones Road Beauty or Meta Ad Library URL"
                  className="w-full rounded-sm border border-white/12 bg-[#101010] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Country
                  </label>
                  <select
                    value={form.country}
                    onChange={(event) => handleChange('country', event.target.value)}
                    className="w-full rounded-sm border border-white/12 bg-[#101010] px-4 py-3 text-sm text-white outline-none"
                  >
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Ad limit
                  </label>
                  <select
                    value={form.limit}
                    onChange={(event) => handleChange('limit', Number(event.target.value))}
                    className="w-full rounded-sm border border-white/12 bg-[#101010] px-4 py-3 text-sm text-white outline-none"
                  >
                    <option value={24}>24 ads</option>
                    <option value={48}>48 ads</option>
                    <option value={72}>72 ads</option>
                    <option value={96}>96 ads</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={working || form.competitorInput.trim().length < 3}
                  className="rounded-sm bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {working ? 'Running Funnel Breakdown...' : 'Run Funnel Breakdown'}
                </button>
                <Link
                  to="/facebook/ads"
                  className="rounded-sm border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                >
                  Open Facebook Research
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!result ? (
        <section className="rounded-sm border border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-slate-400">
          Run a competitor to see the ad intake, landing-page clusters, and the report sections generated from the strongest pages.
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Ads pulled" value={String(summaryStats.totalAds)} detail={result.country} />
            <MetricCard label="Landing pages ranked" value={String(summaryStats.totalPages)} detail="Unique post-click destinations" />
            <MetricCard
              label="Top winner"
              value={summaryStats.strongestPage?.domain || 'N/A'}
              detail={summaryStats.strongestPage ? `${summaryStats.strongestPage.ad_count} ads supporting` : 'No winner ranked yet'}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-sm border border-white/10 bg-white/[0.03] p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Executive summary</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">What this funnel run surfaced</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">{result.report?.summary}</p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-sm border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">Top insights</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-200">
                    {(result.report?.top_insights || []).map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-sm border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">Action items</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-200">
                    {(result.report?.action_items || []).map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>

            <article className="rounded-sm border border-white/10 bg-white/[0.03] p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Winner takeaways</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Top pages worth reviewing first</h2>

              <div className="mt-5 space-y-4">
                {topTakeaways.length ? topTakeaways.map((item, index) => (
                  <div key={`${item.url}-${index}`} className="rounded-sm border border-white/10 bg-black/25 p-4">
                    <p className="truncate text-sm font-semibold text-white">{item.url}</p>
                    <p className="mt-2 text-sm text-slate-300">{item.why_it_matters}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">Offer</p>
                    <p className="mt-1 text-sm text-slate-300">{item.offer_observation}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">CTA</p>
                    <p className="mt-1 text-sm text-slate-300">{item.cta_observation}</p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-400">No winner notes yet.</p>
                )}
              </div>
            </article>
          </section>

          <section className="rounded-sm border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Landing page ranking</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Pages carrying the account</h2>
              </div>
              <p className="text-sm text-slate-400">{topPages.length} ranked pages</p>
            </div>

            <div className="mt-6 space-y-4">
              {topPages.map((page, index) => (
                <article key={page.url} className="rounded-sm border border-white/10 bg-black/25 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">Rank {index + 1}</p>
                      <h3 className="mt-1 truncate text-lg font-semibold text-white">{page.domain || page.url}</h3>
                      <a href={page.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-emerald-300 hover:text-emerald-200">
                        {page.url}
                      </a>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm lg:min-w-[280px]">
                      <MiniMetric label="Score" value={String(page.score)} />
                      <MiniMetric label="Ads" value={String(page.ad_count)} />
                      <MiniMetric label="Avg days live" value={String(page.average_longevity_days)} />
                      <MiniMetric label="Advertisers" value={String(page.advertiser_count)} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Sample ads</p>
                      {(page.sample_ads || []).map((ad) => (
                        <div key={ad.id} className="rounded-sm border border-white/10 bg-[#0f0f0f] p-3">
                          <p className="text-sm font-semibold text-white">{ad.advertiser}</p>
                          {ad.title ? <p className="mt-1 text-sm text-slate-300">{ad.title}</p> : null}
                          {ad.body ? <p className="mt-2 line-clamp-3 text-sm text-slate-400">{ad.body}</p> : null}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Signals</p>
                      <div className="rounded-sm border border-white/10 bg-[#0f0f0f] p-3">
                        <p className="text-sm text-white">Formats: {page.format_mix.video} video / {page.format_mix.static} static</p>
                        <p className="mt-2 text-sm text-slate-300">CTAs: {(page.ctas || []).join(', ') || 'Not captured'}</p>
                        <p className="mt-2 text-sm text-slate-300">Platforms: {(page.platforms || []).join(', ') || 'Not captured'}</p>
                        <p className="mt-2 text-sm text-slate-300">Advertisers: {(page.advertisers || []).join(', ') || 'Not captured'}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {bulkIntel ? <BulkCreativePanel intel={bulkIntel} /> : null}

          <section className="rounded-sm border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Page teardown</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Post-click notes from the top pages</h2>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {pageTeardowns.map((page) => (
                <article key={page.url} className="rounded-sm border border-white/10 bg-black/25 p-4">
                  <p className="truncate text-sm font-semibold text-white">{page.domain || page.url}</p>
                  <a href={page.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-emerald-300 hover:text-emerald-200">
                    {page.url}
                  </a>
                  {page.title ? <p className="mt-3 text-sm text-slate-200">{page.title}</p> : null}
                  {page.meta_description ? <p className="mt-2 text-sm text-slate-400">{page.meta_description}</p> : null}
                  {Array.isArray(page.ctas) && page.ctas.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {page.ctas.slice(0, 4).map((cta) => (
                        <span key={cta} className="rounded-sm border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-200">
                          {cta}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {page.error ? <p className="mt-3 text-sm text-rose-400">{page.error}</p> : null}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatIntro({ label, text }) {
  return (
    <div className="rounded-sm border border-white/10 bg-black/25 p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="rounded-sm border border-white/10 bg-white/[0.03] p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{detail}</p>
    </article>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-sm border border-white/10 bg-[#0f0f0f] p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

export default CompetitorFunnelSpy;
