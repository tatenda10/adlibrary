import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { CubeLoaderOverlay } from '../CubeLoader.jsx';
import { extractProductFromWebsite, generateAdImage, generateFacebookAdCopy, getBrandProfile } from '../../lib/api.js';
import { useApiToast } from '../../hooks/useApiToast.js';
import { useBilling } from '../billing/BillingContext.jsx';
import BulkCreativePanel from './BulkCreativePanel.jsx';
import { clearBulkCreativeIntel, readBulkCreativeIntel } from '../../lib/bulkCreativeIntel.js';

const PLATFORM_OPTIONS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
];

const FORMAT_OPTIONS = ['Static', 'Carousel', 'UGC Video', 'Product Demo', 'Testimonial Card'];
const CTA_OPTIONS = ['Learn More', 'Shop Now', 'Sign Up', 'Get Started', 'Download', 'Book Now'];
const WIZARD_STEPS = [
  { id: 'brand', label: 'Brand' },
  { id: 'offer', label: 'Offer' },
  { id: 'platform', label: 'Platform' },
  { id: 'concepts', label: 'Concepts' },
  { id: 'image', label: 'Image' },
  { id: 'export', label: 'Export' },
];

const inputClass = 'mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400';
const labelClass = 'text-xs font-semibold text-slate-600';

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

function toggle(list, id) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function buildImagePrompt(concept, brief) {
  const platform = concept.platform || brief.platforms.join(', ');
  const reference = brief.referenceAd || null;
  return [
    `Create a performance ad image for ${platform}.`,
    `Aspect ratio: ${concept.format?.toLowerCase().includes('story') || concept.platform === 'Instagram' ? '4:5 feed or 9:16 story/reel' : '1:1 or 4:5 feed'}.`,
    `Brand/product: ${brief.productName || 'the advertised product'}.`,
    `Audience: ${brief.targetAudience || 'target buyer'}.`,
    `Offer: ${brief.offer || 'main product offer'}.`,
    `Ad angle: ${concept.angle}.`,
    `Visual direction: ${concept.visual_direction}.`,
    reference?.image_url ? `Reference ad image to replicate structurally: ${reference.image_url}.` : '',
    reference?.brand_name || reference?.title ? `Reference inspiration: ${reference.brand_name || reference.title}.` : '',
    reference?.notes ? `Reference notes: ${reference.notes}` : '',
    reference?.tags?.length ? `Reference tags: ${reference.tags.slice(0, 8).join(', ')}.` : '',
    `Text overlay: "${concept.hook || concept.headline}".`,
    reference ? 'Use the reference for layout, pacing, visual hierarchy, and creative angle only. Do not copy brand names, logos, exact text, or claims from the reference.' : '',
    'Use a clean direct-response layout, high contrast, readable typography, clear focal point, and no fake testimonials or unverifiable claims.',
  ].filter(Boolean).join('\n');
}

function normalizeConcepts(copy, brief) {
  const variants = Array.isArray(copy?.platform_variants) ? copy.platform_variants : [];
  const hooks = Array.isArray(copy?.hooks) ? copy.hooks : [];
  const angles = Array.isArray(copy?.angles_used) && copy.angles_used.length
    ? copy.angles_used
    : ['Pain point', 'Outcome', 'Proof', 'Objection handling', 'Demo'];

  const base = variants.length
    ? variants
    : hooks.slice(0, 5).map((hook) => ({
        platform: brief.platforms[0] || 'Facebook',
        hook,
        headline: copy?.headline || hook.slice(0, 40),
        primary_text: copy?.primary_text || '',
        cta: copy?.cta || 'Learn More',
        description: copy?.description || '',
        format_notes: '',
      }));

  return base.slice(0, 8).map((row, index) => {
    const angle = angles[index % angles.length];
    const format = brief.format || FORMAT_OPTIONS[index % FORMAT_OPTIONS.length];
    const concept = {
      id: `${row.platform || 'meta'}-${index}`,
      platform: row.platform || brief.platforms[index % brief.platforms.length] || 'Facebook',
      angle,
      hook: row.hook || hooks[index % hooks.length] || row.headline || '',
      headline: row.headline || copy?.headline || '',
      primary_text: row.primary_text || copy?.primary_text || '',
      description: row.description || copy?.description || '',
      cta: row.cta || copy?.cta || brief.cta || 'Learn More',
      format,
      visual_direction: row.format_notes || visualDirectionFor(format, angle, brief),
      why_it_works: `Tests a ${angle.toLowerCase()} angle for ${brief.targetAudience || 'the target audience'} while keeping the offer consistent.`,
      test_variable: `${angle} angle`,
      image_prompt: '',
      image_status: '',
      image_url: '',
    };
    concept.image_prompt = buildImagePrompt(concept, brief);
    return concept;
  });
}

function visualDirectionFor(format, angle, brief) {
  if (format === 'Carousel') return `5-card carousel: hook card, problem card, ${brief.productName || 'product'} solution card, proof/value card, CTA card.`;
  if (format === 'UGC Video') return `Creator-style vertical video still: person holding phone, product result visible, native social feel, direct hook overlay.`;
  if (format === 'Product Demo') return `Clean product/UI demo layout showing the before state, the product in use, and the outcome.`;
  if (format === 'Testimonial Card') return `Proof card layout with a short verified quote area, product image, and CTA. Use "Proof needed" if no proof is provided.`;
  return `Static feed ad with bold hook, product/offer visual, and simple ${angle.toLowerCase()} framing.`;
}

export default function FacebookHookGeneratorPanel() {
  const { getToken } = useAuth();
  const { refreshBilling } = useBilling();
  const { notifyApiError, showWarning } = useApiToast();
  const [step, setStep] = useState('brand');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [offer, setOffer] = useState('');
  const [goal, setGoal] = useState('conversions');
  const [platforms, setPlatforms] = useState(['facebook', 'instagram']);
  const [format, setFormat] = useState('');
  const [cta, setCta] = useState('Learn More');
  const [brandContext, setBrandContext] = useState('');
  const [concepts, setConcepts] = useState([]);
  const [selectedConceptId, setSelectedConceptId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isAnalyzingWebsite, setIsAnalyzingWebsite] = useState(false);
  const [status, setStatus] = useState('');
  const [referenceAd, setReferenceAd] = useState(null);
  const [competitorIntel, setCompetitorIntel] = useState(() => readBulkCreativeIntel());
  const [showBulkPanel, setShowBulkPanel] = useState(Boolean(readBulkCreativeIntel()));

  useEffect(() => {
    const intel = readBulkCreativeIntel();
    if (!intel) return;
    setCompetitorIntel(intel);
    setShowBulkPanel(true);
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('facebook_ad_reference');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.image_url) {
        setReferenceAd(parsed);
        setStatus('Reference ad loaded for replication.');
      }
    } catch {
      // Ignore malformed stored references.
    }
  }, []);

  const selectedConcept = useMemo(
    () => concepts.find((item) => item.id === selectedConceptId) || concepts[0] || null,
    [concepts, selectedConceptId]
  );

  const hasBrandInput = Boolean(productName.trim() || productDescription.trim() || websiteUrl.trim());
  const hasOfferInput = Boolean(targetAudience.trim() || offer.trim());

  const canOpenStep = (stepId) => {
    if (['brand', 'offer'].includes(stepId)) return true;
    if (stepId === 'platform') return hasBrandInput;
    if (stepId === 'concepts') return concepts.length > 0;
    if (stepId === 'image') return Boolean(selectedConcept);
    if (stepId === 'export') return Boolean(selectedConcept);
    return false;
  };

  const goToStep = (stepId) => {
    if (canOpenStep(stepId)) setStep(stepId);
  };

  const brief = useMemo(() => ({
    productName,
    productDescription,
    websiteUrl,
    targetAudience,
    offer,
    goal,
    platforms: platforms.map((item) => PLATFORM_OPTIONS.find((platform) => platform.id === item)?.label || item),
    format,
    cta,
    brandContext,
    referenceAd,
  }), [brandContext, cta, format, goal, offer, platforms, productDescription, productName, referenceAd, targetAudience, websiteUrl]);

  const resolveWebsiteUrl = () => {
    if (websiteUrl.trim()) return websiteUrl.trim();
    if (looksLikeWebsiteUrl(productDescription)) return normalizeWebsiteUrl(productDescription);
    return '';
  };

  const applyProductBrief = (briefData = {}) => {
    if (briefData.product_name) setProductName(briefData.product_name);
    if (briefData.product_description) setProductDescription(briefData.product_description);
    if (briefData.target_audience) setTargetAudience(briefData.target_audience);
    if (briefData.offer) setOffer(briefData.offer);
  };

  const handleAnalyzeWebsite = async () => {
    const url = resolveWebsiteUrl();
    if (!url) {
      showWarning('Paste a product website URL first.');
      return;
    }

    setIsAnalyzingWebsite(true);
    setStatus('');
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await extractProductFromWebsite(token, url);
      applyProductBrief(data?.brief);
      setWebsiteUrl(data?.website_url || url);
      setStatus('Brand and offer details loaded from website.');
    } catch (err) {
      notifyApiError(err, 'Could not read product from that website.');
    } finally {
      setIsAnalyzingWebsite(false);
    }
  };

  const handleGenerateConcepts = async (event) => {
    event.preventDefault();
    const resolvedUrl = resolveWebsiteUrl();
    const descriptionText = looksLikeWebsiteUrl(productDescription) ? '' : productDescription.trim();

    if (!productName.trim() && !descriptionText && !resolvedUrl) {
      showWarning('Add a brand/offer or product URL first.');
      return;
    }
    if (!platforms.length) {
      showWarning('Choose at least one platform.');
      return;
    }

    setIsGenerating(true);
    setStatus('');
    setConcepts([]);
    setSelectedConceptId('');

    try {
      let context = brandContext;
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      if (!context) {
        const profile = await getBrandProfile(token).catch(() => null);
        const story = profile?.story || '';
        const ideal = profile?.preferences?.idealCustomers || profile?.target_audience || '';
        context = [story, ideal ? `Ideal customers: ${ideal}` : ''].filter(Boolean).join('\n\n');
        setBrandContext(context);
      }

      const data = await generateFacebookAdCopy(token, {
        productName: productName.trim(),
        productDescription: descriptionText,
        websiteUrl: resolvedUrl,
        mediums: platforms,
        targetAudience: targetAudience.trim(),
        offer: offer.trim(),
        goal,
        angle: referenceAd?.category || competitorIntel?.winning_angle || competitorIntel?.winningAngle || '',
        tone: '',
        brandContext: [
          context,
          referenceAd ? `Replicate reference ad style/structure only. Reference: ${referenceAd.brand_name || referenceAd.title || 'saved ad example'}. Notes: ${referenceAd.notes || 'none'}. Tags: ${(referenceAd.tags || []).join(', ') || 'none'}.` : '',
        ].filter(Boolean).join('\n\n'),
      });

      const nextConcepts = normalizeConcepts(data?.copy, {
        ...brief,
        productName: productName.trim(),
        productDescription: descriptionText,
        websiteUrl: resolvedUrl,
        referenceAd,
      });
      setConcepts(nextConcepts);
      setSelectedConceptId(nextConcepts[0]?.id || '');
      setStep('concepts');
    } catch (err) {
      notifyApiError(err, 'Failed to generate ad concepts.');
    } finally {
      setIsGenerating(false);
    }
  };

  const resolveAspectRatio = (concept) => {
    if (concept?.platform === 'Instagram') return '4:5';
    if (String(concept?.format || '').toLowerCase().includes('ugc')) return '9:16';
    return '1:1';
  };

  const handleGenerateImage = async (conceptId) => {
    const concept = concepts.find((item) => item.id === conceptId) || selectedConcept;
    if (!concept) return;

    setSelectedConceptId(concept.id);
    setStep('image');
    setIsGeneratingImage(true);
    setConcepts((prev) => prev.map((item) => (
      item.id === concept.id
        ? { ...item, image_status: 'Generating static ad...' }
        : item
    )));

    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await generateAdImage(token, {
        prompt: concept.image_prompt,
        concept,
        brief,
        aspectRatio: resolveAspectRatio(concept),
        imageSize: '1K',
      });
      refreshBilling({ silent: true }).catch(() => {});
      const imageUrl = data?.image?.dataUrl || '';
      if (!imageUrl) throw new Error('Image API returned no image.');
      const providerLabel = data?.provider === 'openai' ? 'OpenAI' : data?.provider === 'gemini' ? 'Gemini' : 'image provider';
      const generatedStatus = data?.fallbackUsed
        ? `Static ad generated with ${providerLabel} fallback.`
        : `Static ad generated with ${providerLabel}.`;
      setConcepts((prev) => prev.map((item) => (
        item.id === concept.id
          ? {
              ...item,
              image_url: imageUrl,
              image_status: generatedStatus,
              image_provider: data?.provider || '',
              image_model: data?.model || '',
              image_fallback_used: Boolean(data?.fallbackUsed),
            }
          : item
      )));
    } catch (err) {
      notifyApiError(err, 'Failed to generate static ad.');
      setConcepts((prev) => prev.map((item) => (
        item.id === concept.id
          ? { ...item, image_status: 'Static ad generation failed. You can still copy the prompt.' }
          : item
      )));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied to clipboard.');
      setTimeout(() => setStatus(''), 2000);
    } catch {
      setStatus('Could not copy. Select and copy manually.');
    }
  };

  const handleExport = () => {
    const payload = {
      brief,
      reference_ad: referenceAd,
      selected_concept: selectedConcept,
      concepts,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${productName || 'ad-concepts'}-export.json`.replace(/[^a-z0-9.-]+/gi, '-').toLowerCase();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 text-slate-900">
      {competitorIntel && showBulkPanel ? (
        <BulkCreativePanel
          intel={competitorIntel}
          compact
          onDismiss={() => {
            clearBulkCreativeIntel();
            setCompetitorIntel(null);
            setShowBulkPanel(false);
          }}
        />
      ) : null}

      {referenceAd ? (
        <div className="flex flex-col gap-4 rounded-sm border border-emerald-200 bg-emerald-50 p-4 md:flex-row md:items-center">
          {referenceAd.image_url ? (
            <img src={referenceAd.image_url} alt={referenceAd.title || 'Reference ad'} className="h-28 w-36 rounded-sm object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Reference ad selected</p>
            <h3 className="mt-1 text-base font-black text-slate-950">{referenceAd.brand_name || referenceAd.title || 'Saved ad example'}</h3>
            {referenceAd.notes ? <p className="mt-1 line-clamp-2 text-sm text-slate-600">{referenceAd.notes}</p> : null}
            <p className="mt-2 text-xs font-semibold text-slate-500">The generator will replicate the structure and creative angle, not copy the original brand or text.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem('facebook_ad_reference');
              setReferenceAd(null);
            }}
            className="rounded-sm border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-100"
          >
            Remove
          </button>
        </div>
      ) : null}

      <div className="flex overflow-hidden rounded-sm border border-slate-200 bg-slate-100">
        {WIZARD_STEPS.map((item, index) => {
          const active = step === item.id;
          const enabled = canOpenStep(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => goToStep(item.id)}
              disabled={!enabled}
              className={`flex-1 px-3 py-3 text-xs font-bold transition ${
                active
                  ? 'bg-white text-emerald-600'
                  : enabled
                    ? 'text-slate-600 hover:bg-white/70'
                    : 'cursor-not-allowed text-slate-400'
              }`}
            >
              {index + 1}. {item.label}
            </button>
          );
        })}
      </div>

      {step === 'brand' ? (
        <section className="rounded-sm border border-slate-200 bg-white p-4">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-950">Brand details</h3>
            <p className="text-sm text-slate-500">Start with the brand name or a website we can extract from.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Brand / product name</span>
              <input value={productName} onChange={(e) => setProductName(e.target.value)} className={inputClass} placeholder="e.g. ViralAdLibrary" />
            </label>
            <label className="block">
              <span className={labelClass}>Website URL</span>
              <div className="mt-1 flex gap-2">
                <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400" placeholder="https://yourbrand.com" />
                <button type="button" onClick={handleAnalyzeWebsite} disabled={isAnalyzingWebsite} className="shrink-0 rounded-sm bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                  {isAnalyzingWebsite ? 'Reading...' : 'Extract'}
                </button>
              </div>
            </label>
          </div>
          <label className="mt-3 block">
            <span className={labelClass}>Short product description</span>
            <textarea value={productDescription} onChange={(e) => setProductDescription(e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder="What do you sell and what problem does it solve?" />
          </label>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => (hasBrandInput ? setStep('offer') : showWarning('Add a brand, product description, or URL first.'))} className="rounded-sm bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-600">
              Next: Offer
            </button>
          </div>
        </section>
      ) : null}

      {step === 'offer' ? (
        <section className="rounded-sm border border-slate-200 bg-white p-4">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-950">Offer and audience</h3>
            <p className="text-sm text-slate-500">Keep this tight so the ad angles stay focused.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Target audience</span>
              <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className={inputClass} placeholder="e.g. DTC founders running Meta ads" />
            </label>
            <label className="block">
              <span className={labelClass}>Main offer</span>
              <input value={offer} onChange={(e) => setOffer(e.target.value)} className={inputClass} placeholder="e.g. Free trial, 20% off, book demo" />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep('brand')} className="rounded-sm border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Back
            </button>
            <button type="button" onClick={() => setStep('platform')} className="rounded-sm bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-600">
              Next: Platform
            </button>
          </div>
        </section>
      ) : null}

      {step === 'platform' ? (
        <form onSubmit={handleGenerateConcepts} className="rounded-sm border border-slate-200 bg-white p-4">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-950">Platform and creative settings</h3>
            <p className="text-sm text-slate-500">Choose where the ad will run, then generate concepts.</p>
          </div>
          <div>
            <span className={labelClass}>Platforms</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((platform) => {
                const active = platforms.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => setPlatforms((prev) => toggle(prev, platform.id))}
                    className={`rounded-sm border px-4 py-2 text-sm font-semibold ${
                      active ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {platform.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Goal</span>
              <select value={goal} onChange={(e) => setGoal(e.target.value)} className={inputClass}>
                <option value="conversions">Conversions / Sales</option>
                <option value="leads">Leads</option>
                <option value="traffic">Traffic</option>
                <option value="awareness">Awareness</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Preferred format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputClass}>
                <option value="">Auto-pick format</option>
                {FORMAT_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>CTA</span>
              <select value={cta} onChange={(e) => setCta(e.target.value)} className={inputClass}>
                {CTA_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep('offer')} className="rounded-sm border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Back
            </button>
            <div className="flex items-center gap-3">
              {status ? <p className="text-xs font-medium text-emerald-700">{status}</p> : null}
              <button type="submit" disabled={isGenerating || isAnalyzingWebsite} className="rounded-sm bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-60">
                {isGenerating ? 'Generating...' : 'Generate concepts'}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {isAnalyzingWebsite ? <CubeLoaderOverlay label="Reading website..." minHeight="8rem" /> : null}
      {isGenerating ? <CubeLoaderOverlay label="Generating grounded ad concepts..." minHeight="12rem" /> : null}

      {step === 'concepts' && concepts.length ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-950">Pick a concept</h3>
              <button type="button" onClick={() => setStep('brand')} className="rounded-sm border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                Edit brief
              </button>
            </div>
            {concepts.map((concept) => (
              <ConceptCard
                key={concept.id}
                concept={concept}
                selected={concept.id === selectedConcept?.id}
                onSelect={() => {
                  setSelectedConceptId(concept.id);
                }}
                onCopy={handleCopy}
                onGenerateImage={() => handleGenerateImage(concept.id)}
              />
            ))}
          </div>

          <aside className="rounded-sm border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-950">Selected concept</h3>
            {selectedConcept ? (
              <div className="mt-3 space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-600">{selectedConcept.platform} / {selectedConcept.format}</p>
                <p className="text-lg font-bold text-slate-950">{selectedConcept.hook}</p>
                <p className="text-sm text-slate-600">{selectedConcept.why_it_works}</p>
                <button type="button" onClick={() => handleGenerateImage(selectedConcept.id)} disabled={isGeneratingImage} className="w-full rounded-sm bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-60">
                  {isGeneratingImage ? 'Generating static ad...' : 'Generate static ad'}
                </button>
                <button type="button" onClick={() => setStep('export')} className="w-full rounded-sm border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  Continue to export
                </button>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {step === 'image' && selectedConcept ? (
        <div className="rounded-sm border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Image generation prompt</p>
              <p className="mt-1 text-sm text-slate-600">Generate the final static ad from the selected concept.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleGenerateImage(selectedConcept.id)} disabled={isGeneratingImage} className="rounded-sm bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                {isGeneratingImage ? 'Generating...' : selectedConcept.image_url ? 'Regenerate static ad' : 'Generate static ad'}
              </button>
              <button type="button" onClick={() => handleCopy(selectedConcept.image_prompt)} className="rounded-sm bg-emerald-500 px-3 py-2 text-xs font-bold text-white">
                Copy prompt
              </button>
            </div>
          </div>
          <pre className="mt-3 whitespace-pre-wrap rounded-sm border border-emerald-200 bg-white p-3 text-xs leading-relaxed text-slate-800">{selectedConcept.image_prompt}</pre>
          <div className="mt-3 grid min-h-64 place-items-center rounded-sm border border-dashed border-emerald-300 bg-white p-3 text-center">
            {isGeneratingImage ? (
              <CubeLoaderOverlay label="Generating static ad..." minHeight="16rem" />
            ) : selectedConcept.image_url ? (
              <div className="w-full">
                <img src={selectedConcept.image_url} alt={selectedConcept.headline || selectedConcept.hook} className="mx-auto max-h-[520px] rounded-sm object-contain" />
                {selectedConcept.image_status ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">{selectedConcept.image_status}</p>
                ) : null}
                <a href={selectedConcept.image_url} download={`${productName || 'static-ad'}.jpg`.replace(/[^a-z0-9.-]+/gi, '-').toLowerCase()} className="mt-3 inline-flex rounded-sm bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600">
                  Download static ad
                </a>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-slate-950">No image generated yet</p>
                <p className="mt-1 text-xs text-slate-500">{selectedConcept.image_status || 'Click Generate static ad to render the final creative.'}</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep('concepts')} className="rounded-sm border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Back
            </button>
            <button type="button" onClick={() => setStep('export')} className="rounded-sm bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-600">
              Next: Export
            </button>
          </div>
        </div>
      ) : null}

      {step === 'export' && selectedConcept ? (
        <section className="rounded-sm border border-slate-200 bg-white p-4">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-950">Save and export</h3>
            <p className="text-sm text-slate-500">Download the brief, selected ad concept, copy, and image prompt.</p>
          </div>
          <div className="rounded-sm bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-600">{selectedConcept.platform} / {selectedConcept.format}</p>
            <h4 className="mt-1 text-lg font-bold text-slate-950">{selectedConcept.hook}</h4>
            <p className="mt-2 text-sm text-slate-600">{selectedConcept.primary_text}</p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep('image')} className="rounded-sm border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Back
            </button>
            <button type="button" onClick={handleExport} className="rounded-sm bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-600">
              Save / export JSON
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ConceptCard({ concept, selected, onSelect, onCopy, onGenerateImage }) {
  return (
    <article className={`rounded-sm border bg-white p-4 ${selected ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-600">{concept.platform} / {concept.angle}</p>
          <h4 className="mt-1 text-lg font-bold text-slate-950">{concept.hook}</h4>
        </div>
        <button type="button" onClick={onSelect} className="rounded-sm border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
          {selected ? 'Selected' : 'Pick'}
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <CopyBlock label="Primary text" value={concept.primary_text} onCopy={onCopy} />
        <CopyBlock label="Headline" value={concept.headline} onCopy={onCopy} />
        <CopyBlock label="Description" value={concept.description} onCopy={onCopy} />
        <CopyBlock label="CTA" value={concept.cta} onCopy={onCopy} />
      </div>

      <div className="mt-3 rounded-sm bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Visual direction</p>
        <p className="mt-1 text-sm text-slate-700">{concept.visual_direction}</p>
        <p className="mt-2 text-xs text-slate-500">Test variable: {concept.test_variable}</p>
      </div>

      <div className="mt-3 flex justify-end">
        <button type="button" onClick={onGenerateImage} className="rounded-sm bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600">
          Generate static ad
        </button>
      </div>
    </article>
  );
}

function CopyBlock({ label, value, onCopy }) {
  if (!value) return null;
  return (
    <div className="rounded-sm border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <button type="button" onClick={() => onCopy(value)} className="text-[10px] font-bold uppercase text-emerald-600">
          Copy
        </button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{value}</p>
    </div>
  );
}
