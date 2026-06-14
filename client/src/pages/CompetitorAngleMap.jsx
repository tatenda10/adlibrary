import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useApiToast } from '../hooks/useApiToast.js';
import { runCompetitorsExtractor } from '../lib/api.js';
import BulkCreativePanel from '../components/facebook/BulkCreativePanel.jsx';
import { saveBulkCreativeIntel } from '../lib/bulkCreativeIntel.js';

const DEFAULT_BRANDS = ['', '', ''];

const DEFAULT_FORM = {
  category: '',
  country: 'US',
  brands: DEFAULT_BRANDS,
};

function CompetitorAngleMap() {
  const { getToken } = useAuth();
  const { notifyApiError } = useApiToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null);
  const [bulkIntel, setBulkIntel] = useState(null);

  const filledBrands = useMemo(
    () => form.brands.map((item) => item.trim()).filter(Boolean),
    [form.brands]
  );

  const canRun = filledBrands.length >= 3 && form.category.trim().length >= 3 && !working;

  const handleBrandChange = (index, value) => {
    setForm((prev) => {
      const brands = [...prev.brands];
      brands[index] = value;
      return { ...prev, brands };
    });
  };

  const handleAddBrand = () => {
    setForm((prev) => {
      if (prev.brands.length >= 5) return prev;
      return { ...prev, brands: [...prev.brands, ''] };
    });
  };

  const handleRun = async () => {
    try {
      setWorking(true);
      setResult(null);
      setBulkIntel(null);
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      const data = await runCompetitorsExtractor(token, {
        category: form.category.trim(),
        country: form.country,
        brands: filledBrands,
      });
      setResult(data || null);
    } catch (error) {
      notifyApiError(error, 'Failed to map competitor angles.');
    } finally {
      setWorking(false);
    }
  };

  const handleUseOpenAngle = (openAngle) => {
    const topBrand = result?.brands?.find((item) => item.ad_count > 0) || result?.brands?.[0];
    const intel = {
      source: 'competitors_extractor',
      competitor_name: filledBrands.join(' vs '),
      winning_angle: openAngle?.angle || openAngle?.hook_example || '',
      offer_notes: openAngle?.why_open || openAngle?.how_to_test || '',
      sample_ads: (topBrand?.top_ads || []).slice(0, 4),
    };
    setBulkIntel(intel);
    saveBulkCreativeIntel(intel);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-sm border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Competitors Extractor</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold text-white md:text-4xl">
          Map 3–5 brands head-to-head and find the angles nobody is running.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
          Pull active Meta ads for each brand, rank hooks by run-time, then surface crowded angles, unique plays, and
          open gaps you can test first.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Category / niche
              </span>
              <input
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="e.g. magnesium supplements for sleep"
                className="w-full rounded-sm border border-white/12 bg-[#101010] px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Competitors (3–5)
              </span>
              <div className="space-y-3">
                {form.brands.map((brand, index) => (
                  <input
                    key={`brand-${index}`}
                    value={brand}
                    onChange={(event) => handleBrandChange(index, event.target.value)}
                    placeholder={`Brand ${index + 1} — name or facebook.com/page URL`}
                    className="w-full rounded-sm border border-white/12 bg-[#101010] px-4 py-3 text-sm text-white outline-none"
                  />
                ))}
              </div>
              {form.brands.length < 5 ? (
                <button
                  type="button"
                  onClick={handleAddBrand}
                  className="mt-3 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                >
                  + Add another brand
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-sm border border-white/10 bg-black/25 p-5">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Country
              </span>
              <select
                value={form.country}
                onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
                className="w-full rounded-sm border border-white/12 bg-[#101010] px-4 py-3 text-sm text-white outline-none"
              >
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
              </select>
            </label>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRun}
                disabled={!canRun}
                className="rounded-sm bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working ? 'Mapping angles...' : 'Run angle map'}
              </button>
              <Link
                to="/website/funnel-spy"
                className="rounded-sm border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/[0.06]"
              >
                Funnel Spy
              </Link>
            </div>
            <p className="mt-4 text-xs leading-6 text-slate-500">
              Uses active Meta Ad Library pulls per brand. Longer run-time = stronger signal in the ranking.
            </p>
          </div>
        </div>
      </section>

      {bulkIntel ? <BulkCreativePanel intel={bulkIntel} compact onDismiss={() => setBulkIntel(null)} /> : null}

      {!result ? (
        <section className="rounded-sm border border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-slate-400">
          Add your category and at least three competitors to see crowded angles, unique plays, and open gaps.
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Brands mapped" value={String(result.brands?.length || 0)} detail={result.country} />
            <MetricCard
              label="Ads pulled"
              value={String((result.brands || []).reduce((sum, item) => sum + (item.ad_count || 0), 0))}
              detail="Active Meta ads"
            />
            <MetricCard
              label="Open angles"
              value={String(result.report?.open_angles?.length || 0)}
              detail="Gaps to test"
            />
          </section>

          <section className="rounded-sm border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Summary</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">{result.report?.summary}</p>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <AngleColumn
              title="Crowded angles"
              subtitle="Multiple brands running similar hooks"
              items={(result.report?.crowded_angles || []).map((item) => ({
                headline: item.angle,
                body: `${(item.brands_using || []).join(', ')} — ${item.why_it_works || ''}`,
              }))}
            />
            <AngleColumn
              title="Unique angles"
              subtitle="Only one brand is running this"
              items={(result.report?.unique_angles || []).map((item) => ({
                headline: item.angle,
                body: `${item.brand}: "${item.hook_example || ''}" (${item.longevity_signal || ''})`,
              }))}
            />
            <AngleColumn
              title="Open angles"
              subtitle="Nobody in your set is running these yet"
              items={(result.report?.open_angles || []).map((item) => ({
                headline: item.angle,
                body: `${item.why_open || ''} ${item.how_to_test ? `→ ${item.how_to_test}` : ''}`,
                action: item,
              }))}
              onUseOpenAngle={handleUseOpenAngle}
            />
          </section>

          {(result.report?.recommended_plays || []).length ? (
            <section className="rounded-sm border border-white/10 bg-white/[0.03] p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Recommended plays</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                {result.report.recommended_plays.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-sm border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Per-brand ad intel</p>
            <div className="mt-6 space-y-4">
              {(result.brands || []).map((brand) => (
                <article key={brand.brand} className="rounded-sm border border-white/10 bg-black/25 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">{brand.brand}</h3>
                    <p className="text-sm text-slate-400">{brand.ad_count || 0} ads pulled</p>
                  </div>
                  {brand.error ? <p className="mt-2 text-sm text-amber-300">{brand.error}</p> : null}
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {(brand.angles || []).slice(0, 6).map((angle) => (
                      <div key={angle.id} className="rounded-sm border border-white/10 bg-[#0f0f0f] p-3">
                        <p className="text-sm font-semibold text-white">{angle.hook}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {angle.max_longevity_days ? `${angle.max_longevity_days} days live` : 'Recent'} ·{' '}
                          {angle.ad_count} ad{angle.ad_count === 1 ? '' : 's'}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
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

function AngleColumn({ title, subtitle, items, onUseOpenAngle }) {
  return (
    <article className="rounded-sm border border-white/10 bg-white/[0.03] p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((item, index) => (
          <div key={`${item.headline}-${index}`} className="rounded-sm border border-white/10 bg-black/25 p-3">
            <p className="text-sm font-semibold text-white">{item.headline}</p>
            <p className="mt-2 text-sm text-slate-400">{item.body}</p>
            {onUseOpenAngle && item.action ? (
              <button
                type="button"
                onClick={() => onUseOpenAngle(item.action)}
                className="mt-3 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
              >
                Generate 20 variations from this angle →
              </button>
            ) : null}
          </div>
        )) : (
          <p className="text-sm text-slate-500">No angles surfaced yet.</p>
        )}
      </div>
    </article>
  );
}

export default CompetitorAngleMap;
