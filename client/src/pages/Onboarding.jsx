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
import { trackMetaCompleteRegistration, trackMetaViewContent } from '../lib/metaPixel.js';
import { CubeLoader, CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { useApiToast } from '../hooks/useApiToast.js';
import { preloadUnlockShowcase } from '../lib/unlockShowcase.js';

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

const TOTAL_STEPS = 5;
const ONBOARDING_FLOW_VERSION = 5;

const ONBOARDING_SCREENS = {
  1: { key: 'role', label: 'Your role', viewedEvent: 'onboarding_q_role_viewed' },
  2: { key: 'website', label: 'Website URL', viewedEvent: 'onboarding_q_website_viewed' },
  3: { key: 'brand', label: 'Brand details', viewedEvent: 'onboarding_q_brand_viewed' },
  4: { key: 'markets', label: 'Markets & channels', viewedEvent: 'onboarding_q_markets_viewed' },
  5: { key: 'voice', label: 'Brand voice', viewedEvent: 'onboarding_q_voice_viewed' },
};

const ONBOARDING_QUESTIONS = [
  { key: 'role', label: 'Your role', event: 'onboarding_q_role_answered' },
  { key: 'website', label: 'Website URL', event: 'onboarding_q_website_answered' },
  { key: 'brand_name', label: 'Brand name', event: 'onboarding_q_brand_name_answered' },
  { key: 'industry', label: 'Industry', event: 'onboarding_q_industry_answered' },
  { key: 'niche', label: 'Niche', event: 'onboarding_q_niche_answered' },
  { key: 'countries', label: 'Countries', event: 'onboarding_q_countries_answered' },
  { key: 'channels', label: 'Channels', event: 'onboarding_q_channels_answered' },
  { key: 'story', label: 'Winning angles', event: 'onboarding_q_story_answered' },
  { key: 'ideal_customer', label: 'Who ads should convert', event: 'onboarding_q_ideal_customer_answered' },
];

function questionHasValue(key, form) {
  if (key === 'role') return Boolean(String(form.audienceRole || '').trim());
  if (key === 'website') return Boolean(String(form.websiteUrl || '').trim());
  if (key === 'brand_name') return Boolean(String(form.brandName || '').trim());
  if (key === 'industry') {
    const industry = form.industry === 'Other' ? form.industryOther : form.industry;
    return Boolean(String(industry || '').trim());
  }
  if (key === 'niche') return Boolean(String(form.niche || '').trim());
  if (key === 'countries') return Boolean((form.countries || []).length);
  if (key === 'channels') return Boolean((form.channels || []).length);
  if (key === 'story') return Boolean(String(form.story || '').trim());
  if (key === 'ideal_customer') return Boolean(String(form.idealCustomers || '').trim());
  return false;
}

function normalizeWebsiteUrlInput(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

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
  'TikTok organic',
  'Instagram Reels',
  'Instagram organic',
  'Facebook Feed Ads',
  'Meta Stories',
  'YouTube Shorts',
  'YouTube organic',
  'Google Search Ads',
  'Google Display',
  'Pinterest Ads',
  'Reddit Ads',
  'LinkedIn Ads',
  'LinkedIn organic',
  'Email',
  'Influencer / UGC',
];

function RoleIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {name === 'megaphone' ? (
        <>
          <path d="M3 11v2a1 1 0 0 0 1 1h1l5 4V6L5 10H4a1 1 0 0 0-1 1Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" strokeLinecap="round" />
          <path d="M18 6.5a8 8 0 0 1 0 11" strokeLinecap="round" />
        </>
      ) : null}
      {name === 'briefcase' ? (
        <>
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M3 12h18" strokeLinecap="round" />
        </>
      ) : null}
      {name === 'rocket' ? (
        <>
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {name === 'building' ? (
        <>
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 12h4M14 12h4M6 16h4M14 16h4M6 8h4M14 8h4M10 22v-4h4v4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
    </svg>
  );
}

const ROLE_OPTIONS = [
  { key: 'media_buyer', label: 'Solo media buyer', detail: 'I test ads and content myself', icon: 'megaphone' },
  { key: 'in_house', label: 'In-house growth', detail: 'I research for a brand team', icon: 'briefcase' },
  { key: 'founder', label: 'Founder', detail: 'I run the brand, content, and ads', icon: 'rocket' },
  { key: 'agency', label: 'Agency / operator', detail: 'I research for multiple clients', icon: 'building' },
];

const ROLE_FLOWS = {
  founder: {
    eyebrow: 'Founder setup',
    steps: {
      2: {
        title: 'Find winning ads and content before you spend',
        subtitle: 'Add your company site. We scan it to match ads and organic content in your category — not to publish anything for you.',
        websiteLabel: 'Your company website',
        websiteHelp: 'Your brand’s site. We use it to find ads and content in the same niche as you.',
        websitePlaceholder: 'https://yourcompany.com',
        continueLabel: 'Scan my site',
        scanLabel: 'Scanning your site…',
      },
      3: {
        title: 'Confirm your brand',
        subtitle: 'We’ll look for competitor ads and content in this category and offer, so you copy fewer weak ideas.',
        brandLabel: 'Your brand name',
        brandPlaceholder: 'Acme Labs',
        categoryLabel: 'Your category',
        nicheLabel: 'What you sell',
        nicheHelp: 'The offer customers actually buy — this is what we match ads and content against.',
        nichePlaceholder: 'Anti-aging serum for busy moms',
        brandWarning: 'Enter your brand name.',
        categoryWarning: 'Select your category.',
      },
      4: {
        title: 'Where do you publish and advertise?',
        subtitle: 'Geos plus paid and organic channels. We’ll prioritize examples from those placements.',
        countriesLabel: 'Countries you reach',
        countriesHelp: 'Where you run content or ads, even if you ship worldwide.',
        channelsLabel: 'Content and ad channels',
        channelsHelp: 'Organic posts and paid placements. We’ll surface examples from both.',
        countryWarning: 'Select at least one country you reach.',
        channelWarning: 'Select at least one content or ad channel.',
      },
      5: {
        title: 'What should new content and ads say?',
        subtitle: 'A short brief so we can filter hooks that fit how you sell — not a brand manifesto.',
        storyLabel: 'How you win attention',
        storyPlaceholder: 'What proof, offer, or hook usually works in content or ads?',
        customerLabel: 'Who should watch or click',
        customerPlaceholder: 'Who you sell to, the problem, and why they hesitate.',
        finishLabel: 'See ads and content in my niche',
      },
    },
  },
  media_buyer: {
    eyebrow: 'Media buyer setup',
    steps: {
      2: {
        title: 'Research the account you buy and create for',
        subtitle: 'Add the brand website for the account you manage. We scan it to find competitor ads and content you can swipe angles from.',
        websiteLabel: 'Brand website for this account',
        websiteHelp: 'The advertiser you work on — not your personal site.',
        websitePlaceholder: 'https://thebrand.com',
        continueLabel: 'Scan this brand',
        scanLabel: 'Scanning the brand…',
      },
      3: {
        title: 'Which account are we researching?',
        subtitle: 'Category and offer so we can pull ads and content that are actually relevant to this buy.',
        brandLabel: 'Advertiser / brand name',
        brandPlaceholder: 'Brand you buy for',
        categoryLabel: 'Account category',
        nicheLabel: 'Offer you are scaling',
        nicheHelp: 'The product or offer currently in market.',
        nichePlaceholder: 'Weight-loss gummies, 30-day supply',
        brandWarning: 'Enter the brand you work on.',
        categoryWarning: 'Select the account category.',
      },
      4: {
        title: 'Where do you run content and spend?',
        subtitle: 'Markets, organic surfaces, and paid placements. We’ll rank examples from those first.',
        countriesLabel: 'Geos you cover',
        countriesHelp: 'Campaign and content geos, not just shipping countries.',
        channelsLabel: 'Content and paid placements',
        channelsHelp: 'Organic and paid. We’ll pull examples from both.',
        countryWarning: 'Select at least one geo you cover.',
        channelWarning: 'Select at least one content or paid channel.',
      },
      5: {
        title: 'What angles are you testing?',
        subtitle: 'What already works in this account, and who content or ads have to convert.',
        storyLabel: 'Angles and offers in market',
        storyPlaceholder: 'Hooks, offers, or proof that already work in ads or organic — and what you want to test next.',
        customerLabel: 'Who must watch or convert',
        customerPlaceholder: 'Audience, objection, and the click- or view-trigger you optimize toward.',
        finishLabel: 'See competitor ads and content',
      },
    },
  },
  in_house: {
    eyebrow: 'In-house growth setup',
    steps: {
      2: {
        title: 'Set up research for your brand team',
        subtitle: 'Add the company site. We scan it to match competitor ads and content your team can brief from.',
        websiteLabel: 'Your brand’s website',
        websiteHelp: 'The company site the team creates and advertises around — used to match category.',
        websitePlaceholder: 'https://yourbrand.com',
        continueLabel: 'Scan our site',
        scanLabel: 'Scanning the brand…',
      },
      3: {
        title: 'Align the team on one brand',
        subtitle: 'Same category and offer for media, content, and strategy — so research is not a screenshot pile.',
        brandLabel: 'Brand the team works on',
        brandPlaceholder: 'Company or product line',
        categoryLabel: 'Category',
        nicheLabel: 'Priority offer',
        nicheHelp: 'The line or offer this quarter’s tests are about.',
        nichePlaceholder: 'B2B onboarding software for HR teams',
        brandWarning: 'Enter the brand your team researches.',
        categoryWarning: 'Select your category.',
      },
      4: {
        title: 'Where does the team publish and spend?',
        subtitle: 'Geos plus organic and paid channels so everyone looks at the same examples.',
        countriesLabel: 'Markets you cover',
        countriesHelp: 'Markets the team cares about this quarter.',
        channelsLabel: 'Content and ad channels',
        channelsHelp: 'Shared organic and paid placements for creative research.',
        countryWarning: 'Select at least one market you cover.',
        channelWarning: 'Select at least one content or ad channel.',
      },
      5: {
        title: 'What should creative test next?',
        subtitle: 'A short shared brief: positioning and the buyer. Your team can execute ads and content from the same examples.',
        storyLabel: 'Positioning for tests',
        storyPlaceholder: 'How the brand wins in content and ads today, and the angles the team wants to try.',
        customerLabel: 'Buyer content and ads must convert',
        customerPlaceholder: 'Who growth is targeting, their job, and what proof they need.',
        finishLabel: 'Open the research library',
      },
    },
  },
  agency: {
    eyebrow: 'Agency setup',
    steps: {
      2: {
        title: 'Set up the agency workspace',
        subtitle: 'Add your agency website — not a client site. People on your team will use this workspace to research ads and content across the brands you manage.',
        websiteLabel: 'Agency website',
        websiteHelp: 'Your agency’s site. We use it to understand how you work, not to pull a single client.',
        websitePlaceholder: 'https://youragency.com',
        continueLabel: 'Scan our agency',
        scanLabel: 'Scanning the agency site…',
      },
      3: {
        title: 'Tell us about the agency',
        subtitle: 'Name, the categories you usually work in, and the kind of brands you manage — so research stays useful for the whole roster.',
        brandLabel: 'Agency name',
        brandPlaceholder: 'Northstar Media',
        categoryLabel: 'Categories you work in most',
        nicheLabel: 'Who you typically manage',
        nicheHelp: 'e.g. DTC e-commerce brands, local services, B2B SaaS — the types of clients on the roster.',
        nichePlaceholder: 'DTC e-commerce and consumer apps',
        brandWarning: 'Enter the agency name.',
        categoryWarning: 'Select the category you work in most.',
      },
      4: {
        title: 'Where do your clients publish and advertise?',
        subtitle: 'Markets and channels your team researches across clients — organic content and paid ads.',
        countriesLabel: 'Markets you cover for clients',
        countriesHelp: 'Geos your team most often buys or creates for.',
        channelsLabel: 'Content and ad channels you run',
        channelsHelp: 'Organic and paid placements your team uses across accounts.',
        countryWarning: 'Select at least one market you cover.',
        channelWarning: 'Select at least one content or ad channel.',
      },
      5: {
        title: 'How should the team brief work?',
        subtitle: 'A short agency brief: the angles you look for, and the buyers your clients usually need to convert.',
        storyLabel: 'How you find winning work',
        storyPlaceholder: 'What you look for in competitor ads and content when you start a new account.',
        customerLabel: 'Who client work usually needs to convert',
        customerPlaceholder: 'Typical buyer across your roster — role, problem, and what proof they need.',
        finishLabel: 'See what the library does for agencies',
      },
    },
  },
};

const ROLE_PICKER_COPY = {
  eyebrow: 'Content and ads research',
  title: 'Who is using the library?',
  subtitle: 'Choose how you work. The next questions change so we research both organic content and paid ads for the right brand.',
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
    audienceRole: prefs.audienceRole || '',
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

function restoreOnboardingStep(profile, form) {
  const saved = Math.max(1, Number(profile?.onboarding_step) || 1);
  const prefs = parseJsonField(profile?.preferences) || {};
  if (Number(prefs.onboardingFlowVersion) === ONBOARDING_FLOW_VERSION) {
    return Math.min(TOTAL_STEPS, saved);
  }
  if (saved <= 1) return form.audienceRole ? 2 : 1;
  return Math.min(TOTAL_STEPS, saved + 1);
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
      audienceRole: form.audienceRole,
      countries: form.countries,
      extracted: form.extracted,
      scrapeCache: form.scrapeCache,
      onboardingFlowVersion: ONBOARDING_FLOW_VERSION,
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
  const roleRef = useRef('');
  const completedRef = useRef(false);
  const stepRef = useRef(1);
  const answeredRef = useRef(new Set());
  const [form, setForm] = useState({
    websiteUrl: '',
    brandName: '',
    industry: '',
    industryOther: '',
    niche: '',
    audienceRole: '',
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
  stepRef.current = step;
  roleRef.current = form.audienceRole || '';

  const withRole = (params = {}) => ({
    ...params,
    audience_role: roleRef.current || '',
  });
  const roleFlow = ROLE_FLOWS[form.audienceRole] || null;
  const stepCopy = step === 1 ? ROLE_PICKER_COPY : ((roleFlow?.steps?.[step]) || ROLE_PICKER_COPY);

  const markQuestionAnswered = (questionKey) => {
    const question = ONBOARDING_QUESTIONS.find((item) => item.key === questionKey);
    if (!question || answeredRef.current.has(questionKey)) return;
    answeredRef.current.add(questionKey);
    trackEvent(question.event, withRole({
      question_key: question.key,
      question_label: question.label,
      step_key: ONBOARDING_SCREENS[stepRef.current]?.key,
    }));
  };

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
    preloadUnlockShowcase();
  }, []);

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
        const restoredStep = restoreOnboardingStep(profile, restored);
        if (Number(profile.onboarding_completed)) {
          completedRef.current = true;
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
    if (step !== 4) return;
    if ((form.channels || []).length) return;
    const industry = form.industry === 'Other' ? form.industryOther : form.industry;
    const defaults = defaultChannelsForIndustry(industry);
    if (!defaults.length) return;
    setForm((prev) => ({ ...prev, channels: defaults, suggestedChannels: defaults }));
  }, [step, form.industry, form.industryOther, form.channels]);

  useEffect(() => {
    if (loading || completedRef.current) return undefined;
    trackEvent('onboarding_started', withRole({ total_steps: TOTAL_STEPS }));
    return () => {
      if (completedRef.current) return;
      const screen = ONBOARDING_SCREENS[stepRef.current] || ONBOARDING_SCREENS[1];
      trackEvent('onboarding_dropoff', withRole({
        step_index: stepRef.current - 1,
        step_key: screen.key,
        question_label: screen.label,
      }));
    };
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    const screen = ONBOARDING_SCREENS[step] || ONBOARDING_SCREENS[1];
    trackEvent('onboarding_step_view', withRole({
      step_index: step - 1,
      step_key: screen.key,
      question_label: screen.label,
      total_steps: TOTAL_STEPS,
    }));
    trackEvent(screen.viewedEvent, withRole({
      step_index: step - 1,
      step_key: screen.key,
      question_label: screen.label,
    }));
    trackMetaViewContent({
      content_name: `onboarding_${screen.key}`,
      content_category: 'onboarding',
    });
  }, [loading, step]);

  useEffect(() => {
    if (loading) return;
    ['role', 'website', 'brand_name', 'industry', 'niche', 'countries', 'story', 'ideal_customer'].forEach((key) => {
      if (questionHasValue(key, form)) markQuestionAnswered(key);
    });
  }, [form, loading]);

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
      if (step === 4) markQuestionAnswered('channels');
      trackEvent('onboarding_step_continue', withRole({
        from_step_index: step - 1,
        from_step_key: ONBOARDING_SCREENS[step]?.key,
        to_step_index: nextStep - 1,
        to_step_key: ONBOARDING_SCREENS[nextStep]?.key,
      }));
    } catch (e) {
      notifyApiError(e, 'Failed to save your progress.');
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    trackEvent('onboarding_step_back', withRole({
      from_step_index: step - 1,
      from_step_key: ONBOARDING_SCREENS[step]?.key,
    }));
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleExtractAndContinue = async () => {
    if (!form.audienceRole) {
      showWarning('Select who you are so we can show the right questions.');
      return;
    }
    const url = String(form.websiteUrl || '').trim();
    if (!url) {
      showWarning(stepCopy.websiteLabel ? `Add ${stepCopy.websiteLabel.toLowerCase()}.` : 'Add a brand website.');
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
      await patchOnboardingProfile(token2, buildSavePayload(nextForm, 3));
      setStep(3);
      trackEvent('onboarding_website_extracted', withRole({
        confidence: extracted.confidence || 'unknown',
      }));
      markQuestionAnswered('website');
    } catch (e) {
      const fallbackUrl = normalizeWebsiteUrlInput(url);
      const nextForm = {
        ...form,
        websiteUrl: fallbackUrl,
        extracted: { confidence: 'low' },
      };
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication error. Please refresh and try again.');
        await patchOnboardingProfile(token, buildSavePayload(nextForm, 3));
        setForm(nextForm);
        setStep(3);
        markQuestionAnswered('website');
        showWarning('We could not scan the site. Confirm the brand so we can still match ads in that niche.');
      } catch {
        notifyApiError(e, 'Could not read your website.');
      }
    } finally {
      setExtracting(false);
    }
  };

  const validateStep2 = () => {
    const copy = roleFlow?.steps?.[3] || {};
    if (!String(form.brandName || '').trim()) {
      showWarning(copy.brandWarning || 'Enter the brand you want to research.');
      return false;
    }
    if (!String(effectiveIndustry || '').trim()) {
      showWarning(copy.categoryWarning || 'Select a category.');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    const copy = roleFlow?.steps?.[4] || {};
    if (!(form.countries || []).length) {
      showWarning(copy.countryWarning || 'Select at least one country.');
      return false;
    }
    if (!(form.channels || []).length) {
      showWarning(copy.channelWarning || 'Select at least one channel.');
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
      trackEvent('onboarding_voice_generated', withRole());
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
      await persistStep(5, { completed: true });
      trackEvent('onboarding_completed', withRole());
      trackMetaCompleteRegistration({ content_name: 'onboarding_finished' });
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
    markQuestionAnswered('channels');
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
          <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">
            {roleFlow?.eyebrow || ROLE_PICKER_COPY.eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight md:text-3xl">{stepCopy.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{stepCopy.subtitle}</p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Step {step} of {TOTAL_STEPS}</p>
        </header>

        <article className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 sm:p-5 md:p-7">
          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-white">Who are you?</label>
                <p className="mt-1 text-xs text-slate-500">The next screens change based on this.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ROLE_OPTIONS.map((role) => {
                    const selected = form.audienceRole === role.key;
                    return (
                      <button
                        key={role.key}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, audienceRole: role.key }));
                        }}
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                          selected
                            ? 'border-emerald-400/50 bg-emerald-400/10'
                            : 'border-white/12 bg-[#0d0d0d] hover:border-white/20'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            selected
                              ? 'bg-emerald-400/15 text-emerald-300'
                              : 'bg-white/5 text-slate-300'
                          }`}
                        >
                          <RoleIcon name={role.icon} />
                        </span>
                        <span>
                          <p className="text-sm font-semibold text-white">{role.label}</p>
                          <p className="mt-1 text-xs text-slate-400">{role.detail}</p>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white">{stepCopy.websiteLabel}</label>
                <input
                  value={form.websiteUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))}
                  placeholder={stepCopy.websitePlaceholder || 'https://example.com'}
                  className="mt-2 w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {stepCopy.websiteHelp}
                </p>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              {lowConfidence ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  We could not confidently read the site. Confirm the brand so we still match the right ads.
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-semibold text-white">{stepCopy.brandLabel || 'Brand to research'}</label>
                <input
                  value={form.brandName}
                  onChange={(e) => setForm((prev) => ({ ...prev, brandName: e.target.value }))}
                  placeholder={stepCopy.brandPlaceholder || 'Acme Labs'}
                  className="mt-2 w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white">{stepCopy.categoryLabel || 'Category'}</label>
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
                <label className="block text-sm font-semibold text-white">{stepCopy.nicheLabel || 'Offer / niche'}</label>
                <input
                  value={form.niche}
                  onChange={(e) => setForm((prev) => ({ ...prev, niche: e.target.value }))}
                  placeholder={stepCopy.nichePlaceholder || 'Anti-aging skincare for busy moms'}
                  className="mt-2 w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                />
                <p className="mt-1 text-xs text-slate-500">{stepCopy.nicheHelp || 'The offer we should match ads against.'}</p>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-white">{stepCopy.countriesLabel || 'Countries'}</label>
                <p className="mt-1 text-xs text-slate-500">{stepCopy.countriesHelp || 'Where paid campaigns run.'}</p>
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
                <label className="block text-sm font-semibold text-white">{stepCopy.channelsLabel || 'Paid channels'}</label>
                <p className="mt-1 text-xs text-slate-500">
                  {form.suggestedChannels?.length
                    ? `Suggested for ${effectiveIndustry || 'this category'}: ${form.suggestedChannels.join(', ')}`
                    : (stepCopy.channelsHelp || 'Select the placements you buy.')}
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

          {step === 5 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-white">{stepCopy.storyLabel || 'Winning angles'}</label>
                {form.scrapeCache || form.websiteUrl ? (
                  <button
                    type="button"
                    onClick={handleGenerateVoice}
                    disabled={generatingVoice || saving}
                    className="rounded-lg border border-emerald-400/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-50"
                  >
                    {generatingVoice ? 'Generating…' : 'Draft from website'}
                  </button>
                ) : null}
              </div>
              <textarea
                value={form.story}
                onChange={(e) => setForm((prev) => ({ ...prev, story: e.target.value }))}
                placeholder={stepCopy.storyPlaceholder || 'What hooks, offers, or proof usually work?'}
                rows={5}
                className="w-full rounded-xl border border-white/12 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
              />
              <div>
                <label className="block text-sm font-semibold text-white">{stepCopy.customerLabel || 'Who should these ads convert?'}</label>
                <textarea
                  value={form.idealCustomers}
                  onChange={(e) => setForm((prev) => ({ ...prev, idealCustomers: e.target.value }))}
                  placeholder={stepCopy.customerPlaceholder || 'Who you target in paid, and what proof they need to click.'}
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
                <button
                  type="button"
                  onClick={() => {
                    if (!form.audienceRole) {
                      showWarning('Select who you are so we can show the right questions.');
                      return;
                    }
                    markQuestionAnswered('role');
                    goToStep(2);
                  }}
                  disabled={saving || !form.audienceRole}
                  className="min-w-[160px] rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Continue
                </button>
              ) : null}

              {step === 2 ? (
                <button
                  type="button"
                  onClick={handleExtractAndContinue}
                  disabled={saving || extracting || !form.audienceRole}
                  className="min-w-[160px] rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                >
                    {extracting ? (stepCopy.scanLabel || 'Scanning website…') : (stepCopy.continueLabel || 'Continue')}
                </button>
              ) : null}

              {step === 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!validateStep2()) return;
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
                  onClick={() => {
                    if (!validateStep3()) return;
                    goToStep(5);
                  }}
                  disabled={saving}
                  className="min-w-[160px] rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Continue
                </button>
              ) : null}

              {step === 5 ? (
                <button
                  type="button"
                  onClick={finishSetup}
                  disabled={saving || generatingVoice}
                  className="min-w-[160px] rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {stepCopy.finishLabel || 'Continue to unlock'}
                </button>
              ) : null}
            </div>
          </div>
        </article>
      </div>

      {extracting ? <CubeLoaderOverlay label={stepCopy.scanLabel || 'Scanning website…'} fullscreen /> : null}
    </section>
  );
}
