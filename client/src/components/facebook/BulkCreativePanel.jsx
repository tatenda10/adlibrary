import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { CubeLoaderOverlay } from '../CubeLoader.jsx';
import { useApiToast } from '../../hooks/useApiToast.js';
import { generateBulkCreative, getBrandProfile } from '../../lib/api.js';
import { clearBulkCreativeIntel, saveBulkCreativeIntel } from '../../lib/bulkCreativeIntel.js';

function VariationCard({ item, index, onCopy }) {
  return (
    <article className="rounded-sm border border-white/10 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300">Variation {index + 1}</p>
          {item.angle_label ? (
            <p className="mt-1 text-xs font-semibold text-white/70">{item.angle_label}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() =>
            onCopy(
              [item.hook, item.headline, item.primary_text, item.cta].filter(Boolean).join('\n\n')
            )
          }
          className="shrink-0 rounded-sm border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/70 hover:border-emerald-400 hover:text-white"
        >
          Copy all
        </button>
      </div>
      {item.hook ? <p className="mt-3 text-sm font-semibold text-white">{item.hook}</p> : null}
      {item.headline ? <p className="mt-2 text-xs text-white/60">Headline: {item.headline}</p> : null}
      {item.primary_text ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{item.primary_text}</p>
      ) : null}
      {item.cta ? <p className="mt-3 text-xs font-semibold text-emerald-300">CTA: {item.cta}</p> : null}
    </article>
  );
}

export default function BulkCreativePanel({ intel, compact = false, onDismiss }) {
  const { getToken } = useAuth();
  const { notifyApiError, showWarning } = useApiToast();
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');

  const intelSummary = useMemo(() => {
    if (!intel) return null;
    const ads = Array.isArray(intel.sample_ads) ? intel.sample_ads : [];
    return {
      competitor: intel.competitor_name || intel.competitorName || 'Competitor',
      angle: intel.winning_angle || intel.winningAngle || '',
      offer: intel.offer_notes || intel.offerNotes || '',
      landing: intel.landing_page_url || intel.landingPageUrl || '',
      adCount: ads.length,
      topHook: ads[0]?.body || ads[0]?.title || '',
    };
  }, [intel]);

  if (!intel || !intelSummary) return null;

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('Copied.');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch {
      setCopyStatus('Copy failed — select manually.');
    }
  };

  const handleGenerate = async () => {
    try {
      setWorking(true);
      setResult(null);
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');

      let brandContext = '';
      try {
        const profile = await getBrandProfile(token);
        const story = profile?.story || '';
        const ideal = profile?.preferences?.idealCustomers || profile?.target_audience || '';
        brandContext = [story, ideal ? `Ideal customers: ${ideal}` : ''].filter(Boolean).join('\n\n');
      } catch {
        // optional
      }

      const data = await generateBulkCreative(token, {
        competitorName: intelSummary.competitor,
        winningAngle: intelSummary.angle,
        offerNotes: intelSummary.offer,
        landingPageUrl: intelSummary.landing,
        sampleAds: intel.sample_ads || [],
        brandContext,
        count: 20,
      });

      setResult(data?.bulk || null);
    } catch (error) {
      notifyApiError(error, 'Failed to generate bulk creative.');
    } finally {
      setWorking(false);
    }
  };

  const handleOpenInHookGenerator = () => {
    saveBulkCreativeIntel(intel);
    window.location.href = '/facebook/hook-generator';
  };

  return (
    <section className={`rounded-sm border border-emerald-400/25 bg-emerald-400/[0.04] ${compact ? 'p-4' : 'p-6'}`}>
      <CubeLoaderOverlay show={working} label="Generating 20 variations from competitor intel..." />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Bulk creative pipeline</p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Spin 20 variations from {intelSummary.competitor}&apos;s proven angle
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
            {intelSummary.angle || 'Winning competitor creative loaded.'}
            {intelSummary.topHook ? (
              <>
                {' '}
                Sample hook: <span className="text-white/80">&ldquo;{intelSummary.topHook.slice(0, 140)}&rdquo;</span>
              </>
            ) : null}
          </p>
          {intelSummary.landing ? (
            <p className="mt-2 truncate text-xs text-slate-500">Landing: {intelSummary.landing}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={working}
            className="rounded-sm bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
          >
            {working ? 'Generating...' : 'Generate 20 variations'}
          </button>
          {!compact ? (
            <button
              type="button"
              onClick={handleOpenInHookGenerator}
              className="rounded-sm border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.06]"
            >
              Open Hook Generator
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              onClick={() => {
                clearBulkCreativeIntel();
                onDismiss();
              }}
              className="rounded-sm border border-white/10 px-4 py-2.5 text-sm text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      </div>

      {copyStatus ? <p className="mt-3 text-xs text-emerald-300">{copyStatus}</p> : null}

      {result ? (
        <div className="mt-6 space-y-4">
          {result.winning_angle_summary ? (
            <p className="text-sm text-slate-300">{result.winning_angle_summary}</p>
          ) : null}
          {result.test_notes ? (
            <p className="rounded-sm border border-white/10 bg-black/20 p-3 text-sm text-slate-400">{result.test_notes}</p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {(result.variations || []).map((item, index) => (
              <VariationCard key={item.id || index} item={item} index={index} onCopy={handleCopy} />
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Variations are built off in-market competitor hooks — not blank-doc brainstorming.{' '}
          <Link to="/facebook/hook-generator" className="text-emerald-300 hover:text-emerald-200">
            Refine in Hook Generator
          </Link>
        </p>
      )}
    </section>
  );
}

export function BulkCreativeIntelBanner({ intel, onUse, onDismiss }) {
  if (!intel) return null;
  const competitor = intel.competitor_name || intel.competitorName || 'Competitor';
  return (
    <div className="rounded-sm border border-emerald-400/30 bg-emerald-400/[0.06] px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">Competitor intel loaded</p>
          <p className="mt-1 text-sm text-white">
            Ready to generate from <span className="font-semibold">{competitor}</span>
            {(intel.winning_angle || intel.winningAngle) ? ` — ${(intel.winning_angle || intel.winningAngle).slice(0, 100)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onUse ? (
            <button
              type="button"
              onClick={onUse}
              className="rounded-sm bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950"
            >
              Generate 20 variations
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-sm border border-white/15 px-3 py-2 text-xs text-slate-400"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
