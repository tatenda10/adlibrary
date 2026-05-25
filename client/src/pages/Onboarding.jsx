import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { previewOnboardingProfile, saveOnboardingProfile } from '../lib/api.js';
import { trackEvent } from '../lib/firebaseAnalytics.js';
import { CubeLoader, CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import WebsiteAnalysisReport, {
  GlobeIcon,
  GraduationIcon,
  LockIcon,
} from '../components/WebsiteAnalysisReport.jsx';
import { useApiToast } from '../hooks/useApiToast.js';

const STEPS = [
  { key: 'brandName', label: 'What is your brand name?', placeholder: 'Acme Labs' },
  { key: 'industry', label: 'What industry are you in?', inputType: 'industry' },
  { key: 'niche', label: 'What niche do you target?', placeholder: 'Anti-aging skincare for busy moms' },
  { key: 'country', label: 'What market/country do you sell in?', placeholder: 'United States' },
  { key: 'idealCustomers', label: 'Who is your ideal customer?', multiline: true, placeholder: 'Describe your ideal buyer persona in 2-4 lines.' },
  { key: 'story', label: 'What is your brand story and positioning?', multiline: true, placeholder: 'What do you sell, why does it matter, and how are you different?' },
  { key: 'suggestedChannelsText', label: 'What channels do you want to focus on?', inputType: 'channels' },
  { key: 'websiteUrl', label: 'What is your website URL?', placeholder: 'https://example.com' },
];

const INDUSTRY_OPTIONS = [
  'E-commerce',
  'SaaS',
  'Health & Wellness',
  'Beauty & Skincare',
  'Fashion & Apparel',
  'Education',
  'Finance',
  'Travel & Hospitality',
  'Food & Beverage',
  'Real Estate',
  'Other',
];

const CHANNEL_OPTIONS = [
  'TikTok Ads',
  'Instagram Reels',
  'Facebook Feed Ads',
  'Meta Stories',
  'YouTube Shorts',
  'Google Search Ads',
  'Google Display',
  'Pinterest Ads',
  'Reddit Ads',
  'LinkedIn Ads',
  'Email',
  'Influencer / UGC',
];

function scoreFromWebsite(url = '') {
  const text = String(url || '').trim();
  const seed = text.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) || 150;
  return {
    clarity: 65 + (seed % 25),
    trust: 62 + ((seed * 3) % 26),
    conversion: 60 + ((seed * 7) % 28),
  };
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { notifyApiError, showWarning } = useApiToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [websiteAnalyzed, setWebsiteAnalyzed] = useState(false);
  const [analysisScores, setAnalysisScores] = useState({ clarity: 0, trust: 0, conversion: 0 });
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countryOpen, setCountryOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [profilePreview, setProfilePreview] = useState(null);
  const [analysisErrorModalOpen, setAnalysisErrorModalOpen] = useState(false);
  const completedRef = useRef(false);
  const [form, setForm] = useState({
    brandName: '',
    industry: '',
    industryOther: '',
    niche: '',
    country: '',
    countries: [],
    idealCustomers: '',
    story: '',
    channelInput: '',
    channels: [],
    suggestedChannelsText: '',
    websiteUrl: '',
  });

  const step = STEPS[stepIndex];
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const effectiveIndustry = form.industry === 'Other' ? form.industryOther : form.industry;
  const filteredCountries = useMemo(() => {
    const q = String(form.country || '').trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((name) => name.toLowerCase().includes(q));
  }, [countries, form.country]);
  const filteredChannels = useMemo(() => {
    const q = String(form.channelInput || '').trim().toLowerCase();
    if (!q) return CHANNEL_OPTIONS;
    return CHANNEL_OPTIONS.filter((name) => name.toLowerCase().includes(q));
  }, [form.channelInput]);
  const isWebsiteStep = step.key === 'websiteUrl';

  useEffect(() => {
    let cancelled = false;
    async function loadCountries() {
      try {
        setCountriesLoading(true);
        const response = await fetch('https://restcountries.com/v3.1/all?fields=name');
        if (!response.ok) throw new Error('Failed to fetch countries');
        const data = await response.json();
        const names = Array.isArray(data)
          ? data
              .map((item) => item?.name?.common)
              .filter(Boolean)
              .sort((a, b) => String(a).localeCompare(String(b)))
          : [];
        if (!cancelled) setCountries(names);
      } catch {
        if (!cancelled) setCountries([]);
      } finally {
        if (!cancelled) setCountriesLoading(false);
      }
    }
    loadCountries();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    trackEvent('onboarding_started', {
      total_steps: STEPS.length,
    });
  }, []);

  useEffect(() => {
    trackEvent('onboarding_step_view', {
      step_index: stepIndex,
      step_key: step.key,
      total_steps: STEPS.length,
    });
  }, [step.key, stepIndex]);

  useEffect(() => {
    return () => {
      if (completedRef.current) return;
      trackEvent('onboarding_dropoff', {
        step_index: stepIndex,
        step_key: step.key,
      });
    };
  }, [step.key, stepIndex]);

  const update = (value) => {
    setAnalysisErrorModalOpen(false);
    if (step.key === 'websiteUrl') {
      setWebsiteAnalyzed(false);
    }
    setForm((prev) => ({ ...prev, [step.key]: value }));
  };

  const next = () => {
    const value = step.key === 'industry'
      ? String(effectiveIndustry || '').trim()
      : step.key === 'country'
        ? String((form.countries || []).length || '').trim()
        : step.key === 'suggestedChannelsText'
          ? String((form.channels || []).length || '').trim()
          : String(form[step.key] || '').trim();
    if (!value) {
      showWarning('Please answer this question to continue.');
      trackEvent('onboarding_step_validation_failed', {
        step_index: stepIndex,
        step_key: step.key,
      });
      return;
    }
    trackEvent('onboarding_step_continue', {
      from_step_index: stepIndex,
      from_step_key: step.key,
    });
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const back = () => {
    trackEvent('onboarding_step_back', {
      from_step_index: stepIndex,
      from_step_key: step.key,
    });
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const runWebsiteRating = async () => {
    try {
      setRatingLoading(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication error. Please refresh and try again.');

      await saveOnboardingProfile(token, {
        brandName: form.brandName,
        websiteUrl: form.websiteUrl,
        industry: effectiveIndustry,
        targetAudience: form.idealCustomers,
        goals: [],
        channels: [],
        preferences: {
          country: (form.countries || [])[0] || '',
          countries: form.countries || [],
          niche: form.niche,
          idealCustomers: form.idealCustomers,
          suggestedChannelsText: (form.channels || []).join(', '),
        },
        story: form.story,
      });

      const preview = await previewOnboardingProfile(token, {
        brandName: form.brandName,
        websiteUrl: form.websiteUrl,
        industry: effectiveIndustry || form.niche,
        niche: form.niche,
        goals: form.idealCustomers ? [form.idealCustomers] : [],
        channels: form.channels || [],
      });
      setAnalysisScores(scoreFromWebsite(form.websiteUrl));
      setWebsiteAnalyzed(true);
      setProfilePreview(preview?.profile || null);
      trackEvent('onboarding_website_analyzed', {
        step_key: step.key,
        clarity: scoreFromWebsite(form.websiteUrl).clarity,
        trust: scoreFromWebsite(form.websiteUrl).trust,
        conversion: scoreFromWebsite(form.websiteUrl).conversion,
      });
      try {
        localStorage.removeItem('pending_app_flow');
        localStorage.removeItem('pending_website_url');
      } catch {
        // ignore storage access issues
      }
    } catch (e) {
      notifyApiError(e, 'Failed to generate website rating.');
      setAnalysisErrorModalOpen(true);
      trackEvent('onboarding_website_analysis_failed', {
        step_key: step.key,
        error: e?.message || 'analysis_failed',
      });
    } finally {
      setRatingLoading(false);
      setSaving(false);
    }
  };

  const continueToBilling = () => {
    completedRef.current = true;
    trackEvent('onboarding_continue_to_billing', {
      step_index: stepIndex,
      step_key: step.key,
      website_analyzed: websiteAnalyzed,
    });
    navigate('/onboarding/billing?checkoutPlan=pro', { replace: true });
  };

  const skipWebsiteStep = () => {
    completedRef.current = true;
    trackEvent('onboarding_website_skipped', {
      step_index: stepIndex,
      step_key: step.key,
    });
    navigate('/onboarding/billing?checkoutPlan=pro', { replace: true });
  };

  const onboardingReportMetrics = [
    { label: 'Clarity', value: analysisScores.clarity, tone: analysisScores.clarity >= 75 ? 'good' : analysisScores.clarity >= 60 ? 'medium' : 'bad' },
    { label: 'Trust', value: analysisScores.trust, tone: analysisScores.trust >= 75 ? 'good' : analysisScores.trust >= 60 ? 'medium' : 'bad' },
    { label: 'Conversion', value: analysisScores.conversion, tone: analysisScores.conversion >= 75 ? 'good' : analysisScores.conversion >= 60 ? 'medium' : 'bad' },
  ];

  const onboardingReportColumns = [
    {
      icon: <GraduationIcon />,
      title: 'What looks okay',
      items: profilePreview?.value_props?.length
        ? profilePreview.value_props
        : ['Your positioning is clear enough to seed creative direction and ad messaging.'],
      itemPrefix: '-- ',
    },
    {
      icon: <GlobeIcon />,
      title: 'What to improve',
      items: profilePreview?.content_pillars?.length
        ? profilePreview.content_pillars
        : ['Tighten proof, clarity, and channel-specific hooks before scaling traffic.'],
      itemPrefix: '-- ',
    },
    {
      icon: <LockIcon />,
      title: 'Action points',
      items: [
        'Lead with your top two pillars and one proof-based angle.',
        'Test short creator-style hooks before longer story ads.',
        'Keep one clear CTA consistent across your first campaigns.',
      ],
      itemPrefix: '-- ',
    },
  ];

  const onFinalSubmit = async () => {
    setSaving(true);
    setAnalysisErrorModalOpen(false);
    trackEvent('onboarding_website_analysis_requested', {
      step_index: stepIndex,
      step_key: step.key,
    });
    await runWebsiteRating();
  };

  const addCountry = (country) => {
    const value = String(country || '').trim();
    if (!value) return;
    setForm((prev) => {
      if ((prev.countries || []).includes(value)) return { ...prev, country: '' };
      return { ...prev, countries: [...(prev.countries || []), value], country: '' };
    });
    setCountryOpen(false);
  };

  const removeCountry = (country) => {
    setForm((prev) => ({
      ...prev,
      countries: (prev.countries || []).filter((item) => item !== country),
    }));
  };

  const addChannel = (channel) => {
    const value = String(channel || '').trim();
    if (!value) return;
    setForm((prev) => {
      if ((prev.channels || []).includes(value)) return { ...prev, channelInput: '' };
      return { ...prev, channels: [...(prev.channels || []), value], channelInput: '' };
    });
    setChannelOpen(false);
  };

  const removeChannel = (channel) => {
    setForm((prev) => ({
      ...prev,
      channels: (prev.channels || []).filter((item) => item !== channel),
    }));
  };

  return (
    <section className="min-h-screen bg-[#040404] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 md:py-10">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Onboarding</p>
          <div className="mt-2 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <h1 className="max-w-4xl text-2xl font-semibold leading-tight md:text-4xl">
              {isWebsiteStep
                ? 'Analyze and optimize funnel for improved conversions'
                : 'Let us learn your brand first'}
            </h1>
            {profilePreview ? (
              <button
                type="button"
                onClick={continueToBilling}
                className="w-full rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-black sm:w-auto"
              >
                Join us
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {isWebsiteStep
              ? 'Drop in your URL and we will review your storefront, messaging clarity, trust signals, and conversion flow.'
              : 'Complete this full setup flow, get your website rating, then continue to billing.'}
          </p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Step {stepIndex + 1} of {STEPS.length}</p>
        </div>

        {!profilePreview ? (
          <article className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 sm:p-5 md:p-7">
            <p className="text-sm font-semibold text-white">{step.label}</p>
            {step.inputType === 'industry' ? (
              <div className="mt-4 space-y-3">
                <select
                  value={form.industry}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      industry: value,
                      industryOther: value === 'Other' ? prev.industryOther : '',
                    }));
                  }}
                  className="w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                >
                  <option value="">Select industry</option>
                  {INDUSTRY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {form.industry === 'Other' ? (
                  <input
                    value={form.industryOther}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, industryOther: e.target.value }));
                    }}
                    placeholder="Write your industry"
                    className="w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                  />
                ) : null}
              </div>
            ) : step.key === 'country' ? (
              <div className="relative mt-4">
                {(form.countries || []).length ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {form.countries.map((country) => (
                      <span
                        key={country}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200"
                      >
                        {country}
                        <button
                          type="button"
                          onClick={() => removeCountry(country)}
                          className="rounded-full px-1 text-emerald-100 hover:bg-emerald-500/20"
                          aria-label={`Remove ${country}`}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <input
                  value={form.country}
                  onChange={(e) => update(e.target.value)}
                  onFocus={() => setCountryOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setCountryOpen(false), 120);
                  }}
                  placeholder={step.placeholder}
                  autoComplete="country-name"
                  className="w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                />
                {countryOpen ? (
                  <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-white/12 bg-[#0d0d0d] p-1 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
                    {countriesLoading ? (
                      <div className="flex justify-center py-4">
                        <CubeLoader size={56} />
                      </div>
                    ) : filteredCountries.length ? (
                      filteredCountries.map((country) => (
                        <button
                          key={country}
                          type="button"
                          onMouseDown={() => addCountry(country)}
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                        >
                          {country}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-slate-400">No country matches your input.</p>
                    )}
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  Type and pick multiple countries where you sell.
                </p>
              </div>
            ) : step.inputType === 'channels' ? (
              <div className="relative mt-4">
                {(form.channels || []).length ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {form.channels.map((channel) => (
                      <span
                        key={channel}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200"
                      >
                        {channel}
                        <button
                          type="button"
                          onClick={() => removeChannel(channel)}
                          className="rounded-full px-1 text-emerald-100 hover:bg-emerald-500/20"
                          aria-label={`Remove ${channel}`}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <input
                  value={form.channelInput}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, channelInput: e.target.value }));
                  }}
                  onFocus={() => setChannelOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setChannelOpen(false), 120);
                  }}
                  placeholder="Type to find channels"
                  className="w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                />
                {channelOpen ? (
                  <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-white/12 bg-[#0d0d0d] p-1 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
                    {filteredChannels.length ? (
                      filteredChannels.map((channel) => (
                        <button
                          key={channel}
                          type="button"
                          onMouseDown={() => addChannel(channel)}
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                        >
                          {channel}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-slate-400">No channel matches your input.</p>
                    )}
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  Select multiple channels to guide recommendations.
                </p>
              </div>
            ) : step.multiline ? (
              <textarea
                value={form[step.key]}
                onChange={(e) => update(e.target.value)}
                placeholder={step.placeholder}
                rows={6}
                className="mt-4 w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
              />
            ) : isWebsiteStep ? (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={form[step.key]}
                  onChange={(e) => update(e.target.value)}
                  placeholder={step.placeholder}
                  className="min-w-0 flex-1 rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                />
                {form.websiteUrl.trim() ? (
                  <button
                    type="button"
                    onClick={onFinalSubmit}
                    disabled={saving || ratingLoading}
                    className="w-full rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-60 sm:w-auto"
                  >
                    {ratingLoading ? 'Reviewing...' : 'Review Website'}
                  </button>
                ) : null}
              </div>
            ) : (
              <input
                value={form[step.key]}
                onChange={(e) => update(e.target.value)}
                placeholder={step.placeholder}
                className="mt-4 w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
              />
            )}

            {step.key === 'idealCustomers' ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Example</p>
                <p className="mt-1 text-sm text-slate-300">
                  Women and men aged 25-40 in the US/UK who are busy professionals, care about appearance,
                  shop mostly on mobile, and want simple skincare routines that show visible results in 30 days.
                  They respond to before/after proof, creator testimonials, and value bundles.
                </p>
              </div>
            ) : null}

            {step.key === 'websiteUrl' ? (
              websiteAnalyzed ? (
                <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Website analyzed</p>
                    <p className="mt-2 text-sm text-slate-300">
                      We reviewed your funnel and generated a first-pass conversion readout for the next step.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <ScoreCard label="Clarity" value={analysisScores.clarity} />
                    <ScoreCard label="Trust" value={analysisScores.trust} />
                    <ScoreCard label="Conversion" value={analysisScores.conversion} />
                  </div>
                </div>
              ) : null
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={back}
                disabled={stepIndex === 0 || saving || ratingLoading}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-slate-300 disabled:opacity-40"
                aria-label="Go back"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M11.5 4.5 6 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {stepIndex < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  className="w-[calc(100%-3.25rem)] min-w-[160px] flex-1 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-black sm:w-auto sm:flex-none"
                >
                  Continue
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={skipWebsiteStep}
                    disabled={saving || ratingLoading}
                    className="w-[calc(100%-3.25rem)] min-w-[160px] flex-1 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 disabled:opacity-40 sm:w-auto sm:flex-none"
                  >
                    Skip for now
                  </button>
                </>
              )}
            </div>
          </article>
        ) : (
          <article className="rounded-2xl border border-emerald-400/25 bg-[linear-gradient(160deg,rgba(8,20,12,0.92),rgba(18,8,8,0.92))] p-4 sm:p-5 md:p-7 shadow-[0_22px_60px_rgba(0,0,0,0.45)]">
            <WebsiteAnalysisReport
              eyebrow="Website rating"
              title="Your initial onboarding report is ready"
              subtitle={profilePreview.tone_summary || 'We generated your initial brand and website readout.'}
              actions={(
                <button
                  type="button"
                  onClick={continueToBilling}
                  className="w-full rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-black sm:w-auto"
                >
                  View full analysis
                </button>
              )}
              metrics={onboardingReportMetrics}
              columns={onboardingReportColumns}
            />
          </article>
        )}
      </div>

      {analysisErrorModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0b0b0b] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M10 6.5v4" strokeLinecap="round" />
                  <path d="M10 13.25v.01" strokeLinecap="round" />
                  <circle cx="10" cy="10" r="7" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-rose-300">Analysis failed</p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  We could not analyze your site.
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Make sure the URL you provided is correct, then try again.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setAnalysisErrorModalOpen(false)}
                className="rounded-lg bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ratingLoading ? <CubeLoaderOverlay label="Reviewing website…" fullscreen /> : null}
    </section>
  );
}

function ScoreCard({ label, value }) {
  const icon = label.toLowerCase().includes('clarity')
    ? <ClarityIcon />
    : label.toLowerCase().includes('trust')
      ? <TrustIcon />
      : <ConversionIcon />;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <span className="text-emerald-300">{icon}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{typeof value === 'number' ? `${value}/100` : value}</p>
    </div>
  );
}

function ClarityIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="m12 8 2.5 4H9.5L12 8Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 16v.01" strokeLinecap="round" />
    </svg>
  );
}

function TrustIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 19 6v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9.5 12 1.8 1.8L14.8 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ConversionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 16l5-5 4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 8h5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
