import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import {
  extractOnboardingWebsite,
  generateOnboardingVoiceDraft,
  getBrandProfile,
  patchOnboardingProfile,
} from '../lib/api.js';
import { trackEvent } from '../lib/firebaseAnalytics.js';
import { CubeLoader, CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { useApiToast } from '../hooks/useApiToast.js';

const POPULAR_COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Netherlands',
  'India',
  'Brazil',
  'Mexico',
  'Spain',
  'Italy',
  'South Africa',
  'United Arab Emirates',
  'Singapore',
];

const COUNTRY_FALLBACK = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria', 'Bangladesh',
  'Belgium', 'Bolivia', 'Brazil', 'Bulgaria', 'Cambodia', 'Canada', 'Chile', 'China',
  'Colombia', 'Costa Rica', 'Croatia', 'Czech Republic', 'Denmark', 'Dominican Republic',
  'Ecuador', 'Egypt', 'Estonia', 'Ethiopia', 'Finland', 'France', 'Germany', 'Ghana',
  'Greece', 'Guatemala', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia',
  'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kenya', 'Kuwait', 'Latvia',
  'Lebanon', 'Lithuania', 'Luxembourg', 'Malaysia', 'Mexico', 'Morocco', 'Netherlands',
  'New Zealand', 'Nigeria', 'Norway', 'Pakistan', 'Panama', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Serbia',
  'Singapore', 'Slovakia', 'Slovenia', 'South Africa', 'South Korea', 'Spain',
  'Sri Lanka', 'Sweden', 'Switzerland', 'Taiwan', 'Thailand', 'Turkey', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Venezuela',
  'Vietnam',
];

function countryMatchesName(name, query) {
  const normalizedName = String(name || '').trim().toLowerCase();
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;
  if (normalizedName.includes(normalizedQuery)) return true;

  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((word) => normalizedName.includes(word))) return true;

  if (normalizedQuery.length > 2) {
    const trimmed = normalizedQuery.slice(1);
    if (normalizedName.includes(trimmed)) return true;
  }

  return false;
}

const TOTAL_STEPS = 4;

const INDUSTRY_OPTIONS = [
  'AI & Machine Learning',
  'Automotive',
  'B2B Services',
  'Beauty & Skincare',
  'Construction & Trades',
  'Consumer Apps',
  'Crypto & Web3',
  'Dating & Relationships',
  'E-commerce',
  'Education',
  'Entertainment & Media',
  'Fashion & Apparel',
  'Finance',
  'Fitness & Sports',
  'Food & Beverage',
  'Gaming',
  'Health & Wellness',
  'Home & Garden',
  'HR & Recruiting',
  'Insurance',
  'Legal Services',
  'Manufacturing',
  'Marketing & Advertising',
  'Nonprofit',
  'Pets & Animals',
  'Professional Services',
  'Real Estate',
  'SaaS',
  'Telecom',
  'Travel & Hospitality',
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

const STEP_TITLES = {
  1: 'Help us get started',
  2: 'Confirm your brand details',
  3: 'Where do you sell and advertise?',
  4: 'Tell us your brand voice',
};

const STEP_SUBTITLES = {
  1: 'Enter your website below and we’ll scan your homepage to pre-fill your brand — name, industry, niche, and more. Takes about 10 seconds.',
  2: 'Check that we got your brand right. You can change anything before continuing.',
  3: 'Pick the markets and channels you care about so recommendations stay relevant.',
  4: 'Share your positioning and ideal customer. Generate a draft from your site or write your own.',
};

function defaultChannelsForIndustry(industry) {
  const key = String(industry || '').toLowerCase();
  if (key === 'saas' || key.includes('b2b')) return ['Google Search Ads', 'LinkedIn Ads'];
  if (key === 'e-commerce' || key.includes('commerce')) return ['TikTok Ads', 'Facebook Feed Ads'];
  if (key.includes('beauty') || key.includes('fashion')) return ['TikTok Ads', 'Instagram Reels'];
  if (key.includes('dating') || key.includes('consumer app') || key.includes('social')) {
    return ['TikTok Ads', 'Instagram Reels'];
  }
  if (key.includes('gaming') || key.includes('entertainment')) return ['TikTok Ads', 'YouTube Shorts'];
  if (key.includes('finance') || key.includes('insurance') || key.includes('legal')) {
    return ['Google Search Ads', 'Facebook Feed Ads'];
  }
  if (key.includes('fitness') || key.includes('health') || key.includes('wellness')) {
    return ['Instagram Reels', 'TikTok Ads'];
  }
  if (key.includes('marketing') || key.includes('advertising')) return ['Facebook Feed Ads', 'Instagram Reels'];
  return ['Facebook Feed Ads', 'Instagram Reels'];
}

function parseJsonField(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function profileToForm(row) {
  const prefs = parseJsonField(row?.preferences) || {};
  const channels = parseJsonField(row?.channels);
  return {
    websiteUrl: row?.website_url || '',
    brandName: row?.brand_name || '',
    industry: INDUSTRY_OPTIONS.includes(row?.industry) ? row.industry : row?.industry ? 'Other' : '',
    industryOther: INDUSTRY_OPTIONS.includes(row?.industry) ? '' : row?.industry || '',
    niche: prefs.niche || '',
    countries: Array.isArray(prefs.countries) ? prefs.countries : [],
    countryInput: '',
    channels: Array.isArray(channels) ? channels : [],
    channelInput: '',
    story: row?.story || '',
    idealCustomers: row?.target_audience || prefs.idealCustomers || '',
    extracted: prefs.extracted || null,
    scrapeCache: prefs.scrapeCache || null,
    suggestedChannels: [],
  };
}

function buildSavePayload(form, step, { completed = false } = {}) {
  const industry = form.industry === 'Other' ? form.industryOther : form.industry;
  return {
    websiteUrl: form.websiteUrl || undefined,
    brandName: form.brandName || undefined,
    industry: industry || undefined,
    niche: form.niche || undefined,
    countries: form.countries,
    channels: form.channels,
    story: form.story || undefined,
    idealCustomers: form.idealCustomers || undefined,
    onboardingStep: step,
    onboardingCompleted: completed,
    preferences: {
      niche: form.niche,
      countries: form.countries,
      extracted: form.extracted,
      scrapeCache: form.scrapeCache,
    },
    scrapeCache: form.scrapeCache,
    extracted: form.extracted,
  };
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { notifyApiError, showWarning } = useApiToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countryOpen, setCountryOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const completedRef = useRef(false);
  const [form, setForm] = useState({
    websiteUrl: '',
    brandName: '',
    industry: '',
    industryOther: '',
    niche: '',
    countries: [],
    countryInput: '',
    channels: [],
    channelInput: '',
    story: '',
    idealCustomers: '',
    extracted: null,
    scrapeCache: null,
    suggestedChannels: [],
  });

  const effectiveIndustry = form.industry === 'Other' ? form.industryOther : form.industry;
  const lowConfidence = form.extracted?.confidence === 'low';
  const progress = Math.round((step / TOTAL_STEPS) * 100);

  const filteredCountries = useMemo(() => {
    const q = String(form.countryInput || '').trim();
    const pool = countries.length ? countries : COUNTRY_FALLBACK;
    if (!q) {
      const popular = POPULAR_COUNTRIES.filter((name) => pool.includes(name));
      return popular.length ? popular : pool.slice(0, 15);
    }
    return pool.filter((name) => countryMatchesName(name, q)).slice(0, 50);
  }, [countries, form.countryInput]);

  const showCountrySuggestions = countryOpen || Boolean(String(form.countryInput || '').trim());

  const filteredChannels = useMemo(() => {
    const q = String(form.channelInput || '').trim().toLowerCase();
    if (!q) return CHANNEL_OPTIONS;
    return CHANNEL_OPTIONS.filter((name) => name.toLowerCase().includes(q));
  }, [form.channelInput]);

  useEffect(() => {
    let cancelled = false;
    async function loadCountries() {
      try {
        setCountriesLoading(true);
        const response = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2');
        if (!response.ok) throw new Error('Failed to fetch countries');
        const data = await response.json();
        const names = Array.isArray(data)
          ? data
              .map((item) => String(item?.name?.common || '').trim())
              .filter(Boolean)
              .sort((a, b) => String(a).localeCompare(String(b)))
          : [];
        if (!cancelled) setCountries(names.length ? names : COUNTRY_FALLBACK);
      } catch {
        if (!cancelled) setCountries(COUNTRY_FALLBACK);
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
    let cancelled = false;
    async function loadProfile() {
      try {
        const token = await getToken();
        if (!token) return;
        const profile = await getBrandProfile(token);
        if (cancelled || !profile) return;
        const restored = profileToForm(profile);
        const restoredStep = Math.min(4, Math.max(1, Number(profile.onboarding_step) || 1));
        if (Number(profile.onboarding_completed)) {
          navigate('/onboarding/unlock', { replace: true });
          return;
        }
        setForm((prev) => ({ ...prev, ...restored }));
        setStep(restoredStep);
      } catch {
        // new user — start at step 1
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [getToken, navigate]);

  useEffect(() => {
    if (step !== 3) return;
    if ((form.channels || []).length) return;
    const industry = form.industry === 'Other' ? form.industryOther : form.industry;
    const defaults = defaultChannelsForIndustry(industry);
    if (!defaults.length) return;
    setForm((prev) => ({ ...prev, channels: defaults, suggestedChannels: defaults }));
  }, [step, form.industry, form.industryOther, form.channels]);

  useEffect(() => {
    trackEvent('onboarding_started', { total_steps: TOTAL_STEPS });
  }, []);

  useEffect(() => {
    trackEvent('onboarding_step_view', {
      step_index: step - 1,
      step_key: `step_${step}`,
      total_steps: TOTAL_STEPS,
    });
  }, [step]);

  useEffect(() => {
    return () => {
      if (completedRef.current) return;
      trackEvent('onboarding_dropoff', {
        step_index: step - 1,
        step_key: `step_${step}`,
      });
    };
  }, [step]);

  const persistStep = async (nextStep, { completed = false } = {}) => {
    const token = await getToken();
    if (!token) throw new Error('Authentication error. Please refresh and try again.');
    await patchOnboardingProfile(token, buildSavePayload(form, nextStep, { completed }));
  };

  const goToStep = async (nextStep, { completed = false } = {}) => {
    setSaving(true);
    try {
      await persistStep(nextStep, { completed });
      setStep(nextStep);
      trackEvent('onboarding_step_continue', {
        from_step_index: step - 1,
        to_step_index: nextStep - 1,
      });
    } catch (e) {
      notifyApiError(e, 'Failed to save your progress.');
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    trackEvent('onboarding_step_back', { from_step_index: step - 1 });
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleExtractAndContinue = async () => {
    const url = String(form.websiteUrl || '').trim();
    if (!url) {
      showWarning('Enter your website URL, or skip for now.');
      return;
    }
    setExtracting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication error. Please refresh and try again.');
      const result = await extractOnboardingWebsite(token, { websiteUrl: url });
      const extracted = result?.extracted || {};
      const suggested = Array.isArray(result?.suggestedChannels) ? result.suggestedChannels : [];
      const nextForm = {
        ...form,
        websiteUrl: result?.websiteUrl || url,
        brandName: extracted.brandName || form.brandName,
        industry: INDUSTRY_OPTIONS.includes(extracted.industry) ? extracted.industry : extracted.industry ? 'Other' : form.industry,
        industryOther: INDUSTRY_OPTIONS.includes(extracted.industry) ? '' : extracted.industry || form.industryOther,
        niche: extracted.niche || form.niche,
        extracted,
        scrapeCache: result?.scrapeCache || null,
        suggestedChannels: suggested,
        channels: suggested.length ? suggested : form.channels,
      };
      setForm(nextForm);
      const token2 = await getToken();
      await patchOnboardingProfile(token2, buildSavePayload(nextForm, 2));
      setStep(2);
      trackEvent('onboarding_website_extracted', {
        confidence: extracted.confidence || 'unknown',
      });
    } catch (e) {
      notifyApiError(e, 'Could not read your website. Try again or skip for now.');
    } finally {
      setExtracting(false);
    }
  };

  const skipToManual = async () => {
    await goToStep(2);
  };

  const validateStep2 = () => {
    if (!String(form.brandName || '').trim()) {
      showWarning('Enter your brand name.');
      return false;
    }
    if (!String(effectiveIndustry || '').trim()) {
      showWarning('Select your industry.');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!(form.countries || []).length) {
      showWarning('Select at least one country where you sell.');
      return false;
    }
    if (!(form.channels || []).length) {
      showWarning('Select at least one channel.');
      return false;
    }
    return true;
  };

  const handleGenerateVoice = async () => {
    setGeneratingVoice(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication error. Please refresh and try again.');
      const draft = await generateOnboardingVoiceDraft(token, {
        websiteUrl: form.websiteUrl,
        scrapeCache: form.scrapeCache,
      });
      setForm((prev) => ({
        ...prev,
        story: draft?.story || prev.story,
        idealCustomers: draft?.idealCustomers || prev.idealCustomers,
      }));
      trackEvent('onboarding_voice_generated');
    } catch (e) {
      notifyApiError(e, 'Failed to generate a draft.');
    } finally {
      setGeneratingVoice(false);
    }
  };

  const finishSetup = async () => {
    completedRef.current = true;
    setSaving(true);
    try {
      await persistStep(4, { completed: true });
      trackEvent('onboarding_completed');
      navigate('/onboarding/unlock', { replace: true });
    } catch (e) {
      completedRef.current = false;
      notifyApiError(e, 'Failed to finish setup.');
    } finally {
      setSaving(false);
    }
  };

  const addCountry = (country) => {
    const value = String(country || '').trim();
    if (!value) return;
    setForm((prev) => {
      if ((prev.countries || []).includes(value)) return { ...prev, countryInput: '' };
      return { ...prev, countries: [...(prev.countries || []), value], countryInput: '' };
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

  if (loading) {
    return <CubeLoaderOverlay label="Loading onboarding…" fullscreen />;
  }

  return (
    <section className="min-h-screen bg-[#040404] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 md:py-10">
        <header className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Onboarding</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight md:text-3xl">{STEP_TITLES[step]}</h1>
          <p className="mt-2 text-sm text-slate-400">{STEP_SUBTITLES[step]}</p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Step {step} of {TOTAL_STEPS}</p>
        </header>

        <article className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 sm:p-5 md:p-7">
          {step === 1 ? (
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-white">Website URL</label>
              <input
                value={form.websiteUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))}
                placeholder="https://yourbrand.com"
                className="w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
              />
              <p className="text-xs text-slate-500">
                We only read public pages — nothing gets published without your say-so.
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              {lowConfidence ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  We could not confidently read everything from your site. Please confirm or edit the fields below.
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-semibold text-white">Brand name</label>
                <input
                  value={form.brandName}
                  onChange={(e) => setForm((prev) => ({ ...prev, brandName: e.target.value }))}
                  placeholder="Acme Labs"
                  className="mt-2 w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white">Industry</label>
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
                  className="mt-2 w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
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
                    onChange={(e) => setForm((prev) => ({ ...prev, industryOther: e.target.value }))}
                    placeholder="Write your industry"
                    className="mt-2 w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                  />
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-semibold text-white">Niche</label>
                <input
                  value={form.niche}
                  onChange={(e) => setForm((prev) => ({ ...prev, niche: e.target.value }))}
                  placeholder="Anti-aging skincare for busy moms"
                  className="mt-2 w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-white">Countries you sell in</label>
                <p className="mt-1 text-xs text-slate-500">We use this to tune ad library filters and geo hints.</p>
                {(form.countries || []).length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
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
                <div className="relative mt-3">
                  <input
                    value={form.countryInput}
                    onChange={(e) => {
                      setCountryOpen(true);
                      setForm((prev) => ({ ...prev, countryInput: e.target.value }));
                    }}
                    onFocus={() => setCountryOpen(true)}
                    onBlur={() => window.setTimeout(() => setCountryOpen(false), 200)}
                    placeholder="Search countries (e.g. United States)"
                    autoComplete="off"
                    className="w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                  />
                  {showCountrySuggestions ? (
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
                            onMouseDown={(event) => {
                              event.preventDefault();
                              addCountry(country);
                            }}
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
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white">Channels to focus on</label>
                <p className="mt-1 text-xs text-slate-500">
                  {form.suggestedChannels?.length
                    ? `Suggested for ${effectiveIndustry || 'your industry'}: ${form.suggestedChannels.join(', ')}`
                    : 'Select the platforms you want creative inspiration from.'}
                </p>
                {(form.channels || []).length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
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
                <div className="relative mt-3">
                  <input
                    value={form.channelInput}
                    onChange={(e) => {
                      setChannelOpen(true);
                      setForm((prev) => ({ ...prev, channelInput: e.target.value }));
                    }}
                    onFocus={() => setChannelOpen(true)}
                    onBlur={() => window.setTimeout(() => setChannelOpen(false), 200)}
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
                            onMouseDown={(event) => {
                              event.preventDefault();
                              addChannel(channel);
                            }}
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
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-white">Brand story and positioning</label>
                {form.scrapeCache || form.websiteUrl ? (
                  <button
                    type="button"
                    onClick={handleGenerateVoice}
                    disabled={generatingVoice || saving}
                    className="rounded-lg border border-emerald-400/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-50"
                  >
                    {generatingVoice ? 'Generating…' : 'Generate draft from website'}
                  </button>
                ) : null}
              </div>
              <textarea
                value={form.story}
                onChange={(e) => setForm((prev) => ({ ...prev, story: e.target.value }))}
                placeholder="What do you sell, why does it matter, and how are you different?"
                rows={5}
                className="w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
              />
              <div>
                <label className="block text-sm font-semibold text-white">Ideal customer</label>
                <textarea
                  value={form.idealCustomers}
                  onChange={(e) => setForm((prev) => ({ ...prev, idealCustomers: e.target.value }))}
                  placeholder="Who buys from you, what problem do you solve, and what proof do they need?"
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                />
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <div className="shrink-0">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={back}
                  disabled={saving || extracting || generatingVoice}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-slate-300 disabled:opacity-40"
                  aria-label="Go back"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M11.5 4.5 6 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : null}
            </div>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
              {step === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={skipToManual}
                    disabled={saving || extracting}
                    className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-300 disabled:opacity-40"
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={handleExtractAndContinue}
                    disabled={saving || extracting}
                    className="min-w-[160px] rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                  >
                    {extracting ? 'Scanning website…' : 'Continue'}
                  </button>
                </>
              ) : null}

              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!validateStep2()) return;
                    goToStep(3);
                  }}
                  disabled={saving}
                  className="min-w-[160px] rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Continue
                </button>
              ) : null}

              {step === 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!validateStep3()) return;
                    goToStep(4);
                  }}
                  disabled={saving}
                  className="min-w-[160px] rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Continue
                </button>
              ) : null}

              {step === 4 ? (
                <button
                  type="button"
                  onClick={finishSetup}
                  disabled={saving || generatingVoice}
                  className="min-w-[160px] rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Finish setup
                </button>
              ) : null}
            </div>
          </div>
        </article>
      </div>

      {extracting ? <CubeLoaderOverlay label="Scanning your website…" fullscreen /> : null}
    </section>
  );
}
