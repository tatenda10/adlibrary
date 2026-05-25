import { useState } from 'react';
import { CubeLoaderOverlay } from '../CubeLoader.jsx';
import { useAuth } from '@clerk/clerk-react';
import { useApiToast } from '../../hooks/useApiToast.js';
import { extractProductFromWebsite, generateFacebookAdCopy, getBrandProfile } from '../../lib/api.js';

const HOOK_TEMPLATES = [
  'Nobody talks about this {topic}...',
  'This will change how you see {topic}...',
  'If you are {audience}, listen carefully...',
  'Here is the truth about {topic}...',
  'Stop doing {action} until you see this...',
];

const PRODUCT_TYPES = [
  { value: '', label: 'Select type…' },
  { value: 'saas_app', label: 'App / SaaS' },
  { value: 'physical', label: 'Physical product' },
  { value: 'digital', label: 'Digital product' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'service', label: 'Service' },
  { value: 'course', label: 'Course / info product' },
  { value: 'other', label: 'Other' },
];

const MARKET_CATEGORIES = [
  { value: '', label: 'Select category…' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'saas', label: 'SaaS / Tech' },
  { value: 'health', label: 'Health & wellness' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'finance', label: 'Finance' },
  { value: 'education', label: 'Education' },
  { value: 'entertainment', label: 'Entertainment / apps' },
  { value: 'food', label: 'Food & beverage' },
  { value: 'other', label: 'Other' },
];

const MEDIUM_OPTIONS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'snapchat', label: 'Snapchat' },
];

const inputClass = 'mt-1 w-full rounded-sm px-3 py-2 text-sm app-input';
const labelClass = 'text-xs text-white/55';

function toggleMedium(list, id) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function looksLikeWebsiteUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed.includes('\n')) return false;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    return Boolean(parsed.hostname && parsed.hostname.includes('.'));
  } catch {
    return false;
  }
}

function normalizeWebsiteUrl(value) {
  const trimmed = String(value || '').trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function CopyBlock({ label, value, onCopy }) {
  if (!value) return null;
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">{label}</p>
        <button
          type="button"
          onClick={() => onCopy(value)}
          className="rounded-sm border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70 hover:border-[#25d366] hover:text-white"
        >
          Copy
        </button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/90">{value}</p>
    </div>
  );
}

export default function FacebookHookGeneratorPanel({ hasProAccess, navigate }) {
  const { getToken } = useAuth();
  const { notifyApiError, showWarning } = useApiToast();
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [sourceWebsiteUrl, setSourceWebsiteUrl] = useState('');
  const [productType, setProductType] = useState('');
  const [niche, setNiche] = useState('');
  const [category, setCategory] = useState('');
  const [mediums, setMediums] = useState(['facebook', 'instagram']);
  const [targetAudience, setTargetAudience] = useState('');
  const [offer, setOffer] = useState('');
  const [goal, setGoal] = useState('conversions');
  const [angle, setAngle] = useState('');
  const [tone, setTone] = useState('');
  const [useBrandProfile, setUseBrandProfile] = useState(true);
  const [brandContext, setBrandContext] = useState('');
  const [copyResult, setCopyResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzingWebsite, setIsAnalyzingWebsite] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const applyProductBrief = (brief = {}) => {
    if (brief.product_name) setProductName(brief.product_name);
    if (brief.product_description) setProductDescription(brief.product_description);
    if (brief.product_type) setProductType(brief.product_type);
    if (brief.niche) setNiche(brief.niche);
    if (brief.category) setCategory(brief.category);
    if (brief.target_audience) setTargetAudience(brief.target_audience);
    if (brief.offer) setOffer(brief.offer);
  };

  const resolveWebsiteUrl = () => {
    if (sourceWebsiteUrl.trim()) return sourceWebsiteUrl.trim();
    if (looksLikeWebsiteUrl(productDescription)) return normalizeWebsiteUrl(productDescription);
    return '';
  };

  const handleAnalyzeWebsite = async () => {
    if (!hasProAccess) {
      navigate('/billing?checkoutPlan=pro');
      return;
    }
    const url = resolveWebsiteUrl();
    if (!url) {
      showWarning('Paste your product website URL in the field below (e.g. https://yoursite.com).');
      return;
    }

    setIsAnalyzingWebsite(true);
    setCopyStatus('');

    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');

      const data = await extractProductFromWebsite(token, url);
      applyProductBrief(data?.brief);
      setSourceWebsiteUrl(data?.website_url || url);
      setCopyStatus('Product details loaded from your website.');
      setTimeout(() => setCopyStatus(''), 3000);
    } catch (err) {
      notifyApiError(err, 'Could not read product from that website.');
    } finally {
      setIsAnalyzingWebsite(false);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('Copied to clipboard.');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch {
      setCopyStatus('Could not copy — select and copy manually.');
    }
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    if (!hasProAccess) {
      navigate('/billing?checkoutPlan=pro');
      return;
    }
    const websiteUrl = resolveWebsiteUrl();
    const descriptionText = looksLikeWebsiteUrl(productDescription) ? '' : productDescription.trim();

    if (!descriptionText && !productName.trim() && !websiteUrl) {
      showWarning('Paste your product website URL or add a name / description.');
      return;
    }
    if (!mediums.length) {
      showWarning('Select at least one platform.');
      return;
    }

    setIsGenerating(true);
    setCopyStatus('');
    setCopyResult(null);

    try {
      let context = brandContext;
      if (useBrandProfile && !context) {
        const token = await getToken();
        if (token) {
          const data = await getBrandProfile(token);
          const story = data?.story || '';
          const ideal = data?.preferences?.idealCustomers || data?.target_audience || '';
          context = [story, ideal ? `Ideal customers: ${ideal}` : ''].filter(Boolean).join('\n\n');
          setBrandContext(context);
        }
      }

      const token = await getToken();
      if (!token) throw new Error('No session token available');

      const data = await generateFacebookAdCopy(token, {
        productName: productName.trim(),
        productDescription: descriptionText,
        websiteUrl,
        productType,
        niche: niche.trim(),
        category,
        mediums,
        targetAudience: targetAudience.trim(),
        offer: offer.trim(),
        goal: goal.trim(),
        angle: angle.trim(),
        tone: tone.trim(),
        brandContext: context,
      });

      setCopyResult(data?.copy || null);
    } catch (err) {
      notifyApiError(err, 'Failed to generate ad copy.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-white/10 bg-white/[0.02] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[#25d366]">Hook Generator</p>
        <p className="mt-1 text-sm text-white/70">
          Paste your product URL to auto-fill what it does, or describe it manually. We generate hooks, headlines,
          CTAs, and copy tailored to each platform you select.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="space-y-4 rounded-sm p-4" style={{ background: 'var(--app-panel)' }}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Product name</span>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Amora AI Companion"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Target audience</span>
            <input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. Adults feeling lonely or stressed"
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className={labelClass}>Product type</span>
            <select value={productType} onChange={(e) => setProductType(e.target.value)} className={inputClass}>
              {PRODUCT_TYPES.map((item) => (
                <option key={item.value || 'empty'} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Niche</span>
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. AI companions, skincare, fitness"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {MARKET_CATEGORIES.map((item) => (
                <option key={item.value || 'empty'} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <span className={labelClass}>Platforms / mediums</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {MEDIUM_OPTIONS.map((item) => {
              const active = mediums.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMediums((prev) => toggleMedium(prev, item.id))}
                  className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'border-[#25d366] bg-[#25d366]/15 text-[#86efac]'
                      : 'border-white/15 text-white/65 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={labelClass}>What is the product?</span>
            {looksLikeWebsiteUrl(productDescription) || sourceWebsiteUrl ? (
              <button
                type="button"
                onClick={handleAnalyzeWebsite}
                disabled={isAnalyzingWebsite || isGenerating}
                className="text-[11px] font-semibold text-[#86efac] hover:text-white disabled:opacity-60"
              >
                {isAnalyzingWebsite ? 'Reading site…' : 'Load from website'}
              </button>
            ) : null}
          </div>
          <textarea
            value={productDescription}
            onChange={(e) => {
              setProductDescription(e.target.value);
              if (!looksLikeWebsiteUrl(e.target.value)) {
                setSourceWebsiteUrl('');
              }
            }}
            rows={3}
            placeholder="Paste https://yourproduct.com — we read the site — or describe what it does, benefits, and proof..."
            className={`${inputClass} min-h-[5.5rem] resize-y`}
          />
          {looksLikeWebsiteUrl(productDescription) && !isAnalyzingWebsite ? (
            <p className="mt-1 text-[11px] text-white/45">
              URL detected. Click “Load from website” or generate — we’ll pull product details automatically.
            </p>
          ) : null}
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Offer / promo</span>
            <input
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="e.g. 30% off first order, free trial"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Campaign goal</span>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className={inputClass}>
              <option value="conversions">Conversions / sales</option>
              <option value="leads">Leads</option>
              <option value="traffic">Traffic</option>
              <option value="awareness">Awareness</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Angle (optional)</span>
            <input
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="e.g. problem-solution, before/after, social proof"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Tone (optional)</span>
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="e.g. direct, empathetic, bold"
              className={inputClass}
            />
          </label>
        </div>

        <label className="block text-xs text-white/55">
          <span className={labelClass}>Hook template starter (optional)</span>
          <select
            className={inputClass}
            value=""
            onChange={(e) => {
              const value = e.target.value;
              if (!value) return;
              setAngle((prev) => (prev ? prev : value.replace(/\{[^}]+\}/g, '…').trim()));
            }}
          >
            <option value="">Pick a proven hook pattern…</option>
            {HOOK_TEMPLATES.map((hook) => (
              <option key={hook} value={hook}>
                {hook}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={useBrandProfile}
            onChange={(e) => setUseBrandProfile(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#25d366]"
          />
          Include my Brand Profile context
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {copyStatus ? <span className="text-xs text-[#86efac]">{copyStatus}</span> : null}
          <button
            type="submit"
            disabled={isGenerating || isAnalyzingWebsite}
            className="rounded-sm bg-[#25d366] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {isGenerating ? 'Generating…' : 'Generate ad copy'}
          </button>
        </div>
      </form>

      {isAnalyzingWebsite ? (
        <CubeLoaderOverlay label="Reading website…" minHeight="10rem" />
      ) : null}

      {isGenerating ? (
        <CubeLoaderOverlay
          label="Writing hooks, headline, CTA, and primary text…"
          minHeight="12rem"
          className="rounded-sm border border-white/10 bg-white/[0.02]"
        />
      ) : null}

      {copyResult ? (
        <div className="space-y-3">
          {copyResult.hooks?.length ? (
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Hooks (test these first)</p>
              <ul className="mt-2 space-y-2">
                {copyResult.hooks.map((hook) => (
                  <li
                    key={hook}
                    className="flex items-start justify-between gap-3 rounded-sm border border-white/8 bg-black/20 px-3 py-2 text-sm text-white/88"
                  >
                    <span className="flex-1">{hook}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(hook)}
                      className="shrink-0 text-[10px] font-semibold uppercase text-[#25d366]"
                    >
                      Copy
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {copyResult.platforms_targeted?.length ? (
            <p className="text-xs text-white/50">
              Tailored for: {copyResult.platforms_targeted.join(' · ')}
            </p>
          ) : null}

          {copyResult.platform_variants?.length ? (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">By platform</p>
              {copyResult.platform_variants.map((row) => (
                <article
                  key={row.platform}
                  className="rounded-sm border border-white/10 bg-white/[0.02] p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#25d366]">{row.platform}</p>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          [
                            row.hook ? `Hook: ${row.hook}` : '',
                            row.headline ? `Headline: ${row.headline}` : '',
                            row.primary_text ? `Primary text:\n${row.primary_text}` : '',
                            row.cta ? `CTA: ${row.cta}` : '',
                            row.description ? `Description: ${row.description}` : '',
                          ]
                            .filter(Boolean)
                            .join('\n\n')
                        )
                      }
                      className="text-[10px] font-semibold uppercase text-white/60 hover:text-white"
                    >
                      Copy block
                    </button>
                  </div>
                  {row.hook ? <p className="text-sm text-white/88">{row.hook}</p> : null}
                  {row.headline ? (
                    <p className="text-xs text-white/70">
                      <span className="text-white/45">Headline: </span>
                      {row.headline}
                    </p>
                  ) : null}
                  {row.primary_text ? (
                    <p className="whitespace-pre-wrap text-sm text-white/85">{row.primary_text}</p>
                  ) : null}
                  {row.cta ? (
                    <p className="text-xs text-white/70">
                      <span className="text-white/45">CTA: </span>
                      {row.cta}
                    </p>
                  ) : null}
                  {row.format_notes ? (
                    <p className="text-[11px] text-white/45">{row.format_notes}</p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <>
              <CopyBlock label="Headline" value={copyResult.headline} onCopy={handleCopy} />
              <CopyBlock label="CTA" value={copyResult.cta} onCopy={handleCopy} />
              <CopyBlock label="Primary text" value={copyResult.primary_text} onCopy={handleCopy} />
              <CopyBlock label="Link description" value={copyResult.description} onCopy={handleCopy} />
            </>
          )}

          {copyResult.angles_used?.length ? (
            <p className="text-xs text-white/45">
              Angles: {copyResult.angles_used.join(' · ')}
            </p>
          ) : null}
          {copyResult.notes ? <p className="text-xs text-white/55">{copyResult.notes}</p> : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                const platformBlocks = (copyResult.platform_variants || []).map((row) =>
                  [
                    row.platform ? `--- ${row.platform} ---` : '',
                    row.hook ? `Hook: ${row.hook}` : '',
                    row.headline ? `Headline: ${row.headline}` : '',
                    row.primary_text ? `Primary text:\n${row.primary_text}` : '',
                    row.cta ? `CTA: ${row.cta}` : '',
                    row.description ? `Description: ${row.description}` : '',
                  ]
                    .filter(Boolean)
                    .join('\n')
                );
                handleCopy(
                  [
                    copyResult.hooks?.length
                      ? `Hooks:\n${copyResult.hooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
                      : '',
                    platformBlocks.length
                      ? platformBlocks.join('\n\n')
                      : [
                          copyResult.headline ? `Headline: ${copyResult.headline}` : '',
                          copyResult.cta ? `CTA: ${copyResult.cta}` : '',
                          copyResult.primary_text ? `Primary text:\n${copyResult.primary_text}` : '',
                          copyResult.description ? `Description: ${copyResult.description}` : '',
                        ]
                          .filter(Boolean)
                          .join('\n\n'),
                  ]
                    .filter(Boolean)
                    .join('\n\n')
                );
              }}
              className="rounded-sm border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-[#25d366]"
            >
              Copy all
            </button>
            <button
              type="button"
              onClick={() => navigate('/facebook/ads')}
              className="rounded-sm border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-[#25d366]"
            >
              Search Ad Library
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
