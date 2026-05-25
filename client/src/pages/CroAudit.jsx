import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApiToast } from '../hooks/useApiToast.js';
import { analyzeWebsiteCro, createSavedCroAudit, deleteSavedCroAudit, getSavedCroAudits } from '../lib/api.js';

const CATEGORY_META = [
  ['social_proof', 'Social Proof'],
  ['cta_clarity', 'CTA Clarity'],
  ['product_preview', 'Product Preview'],
  ['trust_signals', 'Trust Signals'],
  ['copy_specificity', 'Copy Specificity'],
  ['friction_reduction', 'Friction Reduction'],
  ['above_fold', 'Above Fold'],
  ['mobile_readiness', 'Mobile'],
];

function CroAudit() {
  const { getToken, isSignedIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { notifyApiError, showWarning } = useApiToast();
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState(null);
  const [savedAudits, setSavedAudits] = useState([]);
  const [savedState, setSavedState] = useState('');
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [activeTab, setActiveTab] = useState('analyzed');
  const showSaved = location.pathname.includes('/website/saved');

  useEffect(() => {
    let cancelled = false;

    async function loadSavedAudits() {
      try {
        if (!isSignedIn) {
          if (!cancelled) {
            setSavedAudits([]);
            setLoadingSaved(false);
          }
          return;
        }

        const token = await getToken();
        if (!token) {
          if (!cancelled) setLoadingSaved(false);
          return;
        }

        const records = await getSavedCroAudits(token);
        if (!cancelled) {
          setSavedAudits(Array.isArray(records) ? records : []);
        }
      } catch (err) {
        if (!cancelled) {
          notifyApiError(err, 'Failed to load saved audits');
        }
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    }

    loadSavedAudits();

    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn, notifyApiError]);

  const scoreCards = useMemo(() => {
    if (!audit?.scores) return [];
    return CATEGORY_META.map(([key, label]) => ({
      key,
      label,
      ...audit.scores[key],
    }));
  }, [audit]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedUrl = String(websiteUrl || '').trim();
    if (!trimmedUrl) {
      showWarning('Paste a website URL first.');
      return;
    }

    setLoading(true);
    setSavedState('');
    setAudit(null);
    setActiveTab('analyzed');

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication error. Please refresh and try again.');
      }
      const result = await analyzeWebsiteCro(token, trimmedUrl);
      setAudit(result);
      navigate('/website/cro-audit');
    } catch (err) {
      notifyApiError(
        err?.upgrade_prompt
          ? `${err?.message || 'Failed to generate CRO audit.'} ${err.upgrade_prompt}`
          : err,
        'Failed to generate CRO audit.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAudit = async () => {
    try {
      if (!audit) return;
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication error. Please refresh and try again.');
      }

      const saved = await createSavedCroAudit(token, {
        websiteUrl: websiteUrl || audit?.crawl_snapshot?.website_url,
        audit,
      });

      setSavedAudits((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setSavedState(`Saved ${saved.website_url}`);
      navigate('/website/saved');
    } catch (err) {
      notifyApiError(err, 'Failed to save audit');
    }
  };

  const handleLoadSaved = (record) => {
    setWebsiteUrl(record.website_url || '');
    setAudit(record.audit || null);
    setSavedState(`Loaded saved audit for ${record.website_url}`);
    setActiveTab('analyzed');
    navigate('/website/cro-audit');
  };

  const handleDeleteSaved = async (id) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication error. Please refresh and try again.');
      }
      await deleteSavedCroAudit(token, id);
      setSavedAudits((prev) => prev.filter((item) => item.id !== id));
      setSavedState('Saved audit removed');
    } catch (err) {
      notifyApiError(err, 'Failed to delete audit');
    }
  };

  const handleDownloadReport = () => {
    if (!audit) return;
    const report = {
      website_url: audit?.crawl_snapshot?.website_url || websiteUrl,
      exported_at: new Date().toISOString(),
      audit,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFileName(audit?.crawl_snapshot?.website_url || websiteUrl || 'website-audit')}-cro-audit.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (showSaved && loadingSaved) {
    return <CubeLoaderOverlay label="Loading saved audits…" minHeight="52vh" />;
  }

  return (
    <section className="space-y-3 text-sm">
      {!showSaved ? (
        <div className="border app-card rounded-sm p-3" style={{ borderColor: 'var(--app-border)', background: '#0a0a0a' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] app-muted">Website CRO Audit</p>
              <h2 className="mt-1 text-base font-semibold">Search, review, and save website audits</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/website/saved')}
              className="border px-3 py-2 text-xs font-semibold"
              style={{ borderColor: 'var(--app-border)', background: '#0a0a0a' }}
            >
              Saved ({savedAudits.length})
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="Search website URL..."
              className="w-full px-3 py-2.5 text-sm app-input outline-none"
              style={{ background: '#0d0d0d' }}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 text-sm font-semibold"
              style={{ background: '#16a34a', color: '#020202' }}
            >
              {loading ? 'Analyzing...' : 'Search'}
            </button>
          </form>

          <div className="mt-2 flex flex-wrap gap-2 text-[11px] app-muted">
            <span className="border rounded-sm px-2 py-1" style={{ borderColor: 'var(--app-border)' }}>8 checks</span>
            <span className="border rounded-sm px-2 py-1" style={{ borderColor: 'var(--app-border)' }}>scores + fixes</span>
            <span className="border rounded-sm px-2 py-1" style={{ borderColor: 'var(--app-border)' }}>black theme</span>
          </div>

          {savedState ? <p className="mt-2 text-xs text-emerald-400">{savedState}</p> : null}
          {loading ? <CubeLoaderOverlay label="Analyzing website…" fullscreen /> : null}
        </div>
      ) : null}

      {showSaved ? (
        <article className="border app-card rounded-sm p-3" style={{ borderColor: 'var(--app-border)', background: '#0a0a0a' }}>
          {savedAudits.length ? (
            <div className="mt-3 space-y-2">
              {savedAudits.map((record) => (
                <section
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-3 border rounded-sm px-3 py-2"
                  style={{ borderColor: 'var(--app-border)', background: '#111111' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{record.website_url}</p>
                    <p className="mt-1 text-[11px] app-muted">
                      Score {record.audit?.summary?.overall_score ?? record.overall_score ?? 0} / 100 | Grade {record.audit?.summary?.grade || record.grade || 'C'} | {formatSavedDate(record.updated_at || record.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadSaved(record)}
                      className="px-3 py-1.5 text-xs font-semibold"
                      style={{ background: '#16a34a', color: '#020202' }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSaved(record.id)}
                      className="border rounded-sm px-3 py-1.5 text-xs font-semibold"
                      style={{ borderColor: 'var(--app-border)', background: '#0a0a0a' }}
                    >
                      Delete
                    </button>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs app-muted">No saved audits yet.</p>
          )}
        </article>
      ) : null}

      {audit ? (
        <div className="space-y-3">
          <article className="border app-card rounded-sm p-3" style={{ borderColor: 'var(--app-border)', background: '#0a0a0a' }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-400">Website</p>
                <p className="mt-1 truncate text-xs app-muted">{audit.crawl_snapshot?.website_url || websiteUrl}</p>
                <p className="mt-3 text-[10px] uppercase tracking-[0.18em] app-muted">Audit Result</p>
                <h3 className="mt-1 text-base font-semibold">{audit.summary?.headline || 'Audit summary'}</h3>
                <p className="mt-1 text-xs app-muted">{audit.summary?.verdict}</p>
              </div>
              <div className="ml-auto flex flex-col items-end gap-2">
                <div className="text-right">
                  <p className="text-2xl font-semibold">{audit.summary?.overall_score ?? 0}</p>
                  <p className="text-[11px] app-muted">Grade {audit.summary?.grade || 'C'}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadReport}
                    className="inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: 'var(--app-border)', background: '#0f0f0f' }}
                  >
                    <DownloadIcon />
                    Download Report
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAudit}
                    className="inline-flex items-center gap-2 rounded-sm px-3 py-2 text-xs font-semibold"
                    style={{ background: '#ffffff', color: '#050505' }}
                  >
                    <SaveIcon />
                    Save Audit
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <TabButton active={activeTab === 'analyzed'} onClick={() => setActiveTab('analyzed')} icon={<InspectIcon />}>
                What we analyzed
              </TabButton>
              <TabButton active={activeTab === 'fix'} onClick={() => setActiveTab('fix')} icon={<FixIcon />}>
                What we need to fix
              </TabButton>
            </div>
          </article>

          {activeTab === 'analyzed' ? (
            <div className="space-y-3">
              <article className="border app-card rounded-sm p-3" style={{ borderColor: 'var(--app-border)', background: '#0a0a0a' }}>
                <p className="text-[10px] uppercase tracking-[0.18em] app-muted">Detected</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  <MiniMetric label="Forms" value={audit.detected_elements?.forms_detected} />
                  <MiniMetric label="Inputs" value={audit.detected_elements?.inputs_detected} />
                  <MiniMetric label="Images" value={audit.detected_elements?.images_detected} />
                  <MiniMetric label="Video/Iframe" value={audit.detected_elements?.video_or_iframe_detected} />
                  <MiniMetric label="Viewport" value={audit.detected_elements?.has_viewport_meta ? 'Yes' : 'No'} />
                </div>
                {(audit.crawl_snapshot?.homepage?.image_urls || []).length ? (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] app-muted">Detected image assets</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {audit.crawl_snapshot.homepage.image_urls.slice(0, 8).map((url) => (
                        <span
                          key={url}
                          className="max-w-full truncate border rounded-sm px-2 py-1 text-[11px] app-muted"
                          style={{ borderColor: 'var(--app-border)', background: '#111111' }}
                          title={url}
                        >
                          {url}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <InfoRow label="Title" value={audit.detected_elements?.title} />
                  <InfoRow label="Meta Description" value={audit.detected_elements?.meta_description} />
                  <InfoRow label="H1" value={(audit.detected_elements?.h1 || []).join(' | ')} />
                  <InfoRow label="Primary CTAs" value={(audit.detected_elements?.primary_ctas || []).join(' | ')} />
                </div>
              </article>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {scoreCards.map((item) => (
                  <ScoreCard key={item.key} item={item} />
                ))}
              </div>

              <article className="border app-card rounded-sm p-3" style={{ borderColor: 'var(--app-border)', background: '#0a0a0a' }}>
                <p className="text-[10px] uppercase tracking-[0.18em] app-muted">Sources</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {(audit.research_sources || []).map((source) => (
                    <a
                      key={source.id}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="border rounded-sm px-3 py-2"
                      style={{ borderColor: 'var(--app-border)', background: '#111111' }}
                    >
                      <p className="text-xs font-semibold">{source.title}</p>
                      <p className="mt-1 text-[11px] app-muted">{source.used_for}</p>
                    </a>
                  ))}
                </div>
              </article>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="border app-card rounded-sm p-3" style={{ borderColor: 'var(--app-border)', background: '#0a0a0a' }}>
                <p className="text-[10px] uppercase tracking-[0.18em] app-muted">Priority Fixes</p>
                <div className="mt-3 space-y-2">
                  {(audit.priority_fixes || []).map((fix, index) => (
                    <section
                      key={`${fix.issue}-${index}`}
                      className="border rounded-sm px-3 py-2"
                      style={{ borderColor: 'var(--app-border)', background: '#111111' }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <PriorityPill priority={fix.priority} />
                        <span className="text-[10px] uppercase tracking-[0.12em] app-muted">{fix.category}</span>
                      </div>
                      <h4 className="mt-2 text-sm font-semibold">{fix.issue}</h4>
                      <p className="mt-1 text-xs app-muted">{fix.why_it_matters}</p>
                      <p className="mt-2 text-xs"><span className="font-semibold">Do:</span> {fix.recommended_change}</p>
                      <p className="mt-1 text-xs"><span className="font-semibold">Impact:</span> {fix.expected_impact}</p>
                    </section>
                  ))}
                </div>
              </article>

              <article className="border app-card rounded-sm p-3" style={{ borderColor: 'var(--app-border)', background: '#0a0a0a' }}>
                <p className="text-[10px] uppercase tracking-[0.18em] app-muted">Rewrite Suggestions</p>
                <div className="mt-3 space-y-2">
                  {(audit.rewrite_suggestions || []).map((item, index) => (
                    <section
                      key={`${item.target}-${index}`}
                      className="border rounded-sm px-3 py-2"
                      style={{ borderColor: 'var(--app-border)', background: '#111111' }}
                    >
                      <p className="text-[10px] uppercase tracking-[0.12em] app-muted">{item.target}</p>
                      {item.current ? <p className="mt-1 text-xs"><span className="font-semibold">Current:</span> {item.current}</p> : null}
                      <p className="mt-1 text-xs"><span className="font-semibold">Suggested:</span> {item.suggested}</p>
                      <p className="mt-1 text-[11px] app-muted">{item.why}</p>
                    </section>
                  ))}
                </div>
              </article>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold"
      style={{
        borderRadius: '0.125rem',
        border: '1px solid var(--app-border)',
        background: active ? '#15803d' : '#0a0a0a',
        color: active ? '#ffffff' : 'var(--app-subtext)',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function MiniMetric({ label, value }) {
  return (
    <section className="border rounded-sm px-3 py-2" style={{ borderColor: 'var(--app-border)', background: '#111111' }}>
      <p className="text-[10px] uppercase tracking-[0.12em] app-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value ?? 0}</p>
    </section>
  );
}

function InfoRow({ label, value }) {
  return (
    <section className="border rounded-sm px-3 py-2" style={{ borderColor: 'var(--app-border)', background: '#111111' }}>
      <p className="text-[10px] uppercase tracking-[0.12em] app-muted">{label}</p>
      <p className="mt-1 text-xs">{value || 'Not detected'}</p>
    </section>
  );
}

function ScoreCard({ item }) {
  const score = Number(item?.score || 0);
  const tone = score >= 8 ? '#34d399' : score >= 6 ? '#fbbf24' : '#f87171';

  return (
    <article className="border rounded-sm px-3 py-2" style={{ borderColor: 'var(--app-border)', background: '#0f0f0f' }}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold">{item.label}</p>
        <span className="text-xs font-semibold" style={{ color: tone }}>
          {score.toFixed(1)}/10
        </span>
      </div>
      <p className="mt-2 text-[11px] app-muted">{item.reason || 'No reason returned.'}</p>
      {(item.evidence_found || []).length ? <p className="mt-2 text-[11px]" style={{ color: '#34d399' }}>Found: {item.evidence_found.join(' | ')}</p> : null}
      {(item.evidence_missing || []).length ? <p className="mt-1 text-[11px]" style={{ color: '#f87171' }}>Missing: {item.evidence_missing.join(' | ')}</p> : null}
    </article>
  );
}

function PriorityPill({ priority }) {
  const colors = {
    critical: { background: 'rgba(248,113,113,0.12)', color: '#fca5a5' },
    important: { background: 'rgba(251,191,36,0.12)', color: '#fcd34d' },
    nice_to_have: { background: 'rgba(56,189,248,0.12)', color: '#7dd3fc' },
  };
  const style = colors[priority] || { background: '#151515', color: '#a1a1aa' };

  return (
    <span className="rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={style}>
      {priority}
    </span>
  );
}

function formatSavedDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value || '';
  }
}

function safeFileName(value) {
  return String(value || 'website')
    .replace(/^https?:\/\//i, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 4h11l3 3v13H5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 4v6h6V4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4v10" strokeLinecap="round" />
      <path d="m8 10 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}

function InspectIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" strokeLinecap="round" />
    </svg>
  );
}

function FixIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-3-3Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default CroAudit;
