import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  API_URL,
  createCollection,
  intelligentSearchFacebookAds,
  searchFacebookAds,
  searchFacebookPages,
} from '../lib/api.js';
import CubeLoader, { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import FacebookHookGeneratorPanel from '../components/facebook/FacebookHookGeneratorPanel.jsx';
import { useApiToast } from '../hooks/useApiToast.js';
import { computeAdLongevityDays, sortAdsByImpressions, sortAdsByLongevity } from '../lib/adLongevity.js';
import { buildIntelFromFacebookAd, saveBulkCreativeIntel } from '../lib/bulkCreativeIntel.js';

const SPY_DEFAULT_SORT = 'longest_running';

const FB_TOOLBAR_CONTROL =
  'h-11 min-h-11 shrink-0 rounded-sm border border-slate-200 bg-white px-4 text-sm font-semibold leading-none text-slate-800 outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/10';
const FB_TOOLBAR_BTN =
  'inline-flex h-11 min-h-11 shrink-0 items-center justify-center rounded-sm px-5 text-sm font-semibold leading-none transition';

const FACEBOOK_SOURCES = [
  // Meta Ads API is temporarily hidden until a token is configured.
  // {
  //   id: 'meta_api',
  //   label: 'Meta Ads API',
  //   helper: 'Native Meta Ads Library search using your server token.',
  //   placeholder: 'Search term like skincare, supplements, ai app',
  //   empty: 'Run a search to load Facebook ads from the Meta Ads Library.',
  //   button: 'Search Meta Ads',
  // },
  {
    id: 'facebook_ads',
    sourceKey: 'apify_meta_ads',
    route: '/facebook/ads',
    label: 'Ads Spy',
    helper: '',
    placeholder: 'Keyword, Facebook page URL, page handle, or product niche',
    empty: 'Run a search to load Facebook ad creative results.',
    button: 'Search',
  },
  {
    id: 'facebook_hook_generator',
    route: '/facebook/hook-generator',
    label: 'Ad Generator',
    helper: 'Generate Facebook ad hooks, headlines, CTAs, and primary ad copy from your product brief.',
    placeholder: '',
    empty: '',
    button: 'Generate',
  },
  // {
  //   id: 'apify_groups',
  //   route: '/facebook/groups',
  //   label: 'Groups (Experimental)',
  //   helper: 'Deprioritized surface. Use this for adjacent community context, not core ad research.',
  //   placeholder: 'Keyword like dropshipping, gymwear, beauty founders',
  //   empty: 'Search for Facebook groups to explore adjacent communities.',
  //   button: 'Search',
  // },
  // {
  //   id: 'apify_followers_following',
  //   route: '/facebook/followers',
  //   label: 'Followers (Experimental)',
  //   helper: 'Deprioritized surface. Enter a Facebook page or profile URL for audience-adjacent research.',
  //   placeholder: 'https://www.facebook.com/nike',
  //   empty: 'Search a Facebook page or profile URL to inspect follower relationships.',
  //   button: 'Search',
  // },
];

const COUNTRY_ALL = 'ALL';
const DEFAULT_COUNTRIES = [
  { value: COUNTRY_ALL, label: 'All countries' },
  { value: 'US', label: 'United States' },
];

function countryMatchesQuery(item, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;

  const label = String(item.label || '').toLowerCase();
  const value = String(item.value || '').toLowerCase();
  if (label.includes(normalizedQuery) || value.includes(normalizedQuery)) return true;

  // Forgiving match for a leading typo/extra character (e.g. "xzimbabwe" -> "zimbabwe").
  if (normalizedQuery.length > 2) {
    const trimmed = normalizedQuery.slice(1);
    if (label.includes(trimmed) || value.includes(trimmed)) return true;
  }

  return false;
}

function humanizeFacebookSlug(slug) {
  const raw = String(slug || '').replace(/^@/, '').trim();
  if (!raw || /^\d{6,}$/.test(raw)) return '';
  try {
    return decodeURIComponent(raw).replace(/[-_+]/g, ' ').replace(/\s+/g, ' ').trim();
  } catch {
    return raw.replace(/[-_+]/g, ' ').trim();
  }
}

function extractFacebookPageIdFromUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (!/facebook\.com/i.test(raw) && /^\d{6,}$/.test(raw)) return raw;
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (!/facebook\.com$/i.test(u.hostname.replace(/^www\./, ''))) return '';
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts.length ? parts[parts.length - 1].replace(/^@/, '') : '';
    const decoded = (() => {
      try {
        return decodeURIComponent(last);
      } catch {
        return last;
      }
    })();
    if (/^\d{6,}$/.test(decoded)) return decoded;
    return '';
  } catch {
    return '';
  }
}

/** Prefer Claude plan leads (competitor_keywords + advertiser_page_urls), not facet rollups alone. */
function buildCompetitorsFromIntelligentPlan(plan) {
  if (!plan || typeof plan !== 'object') return [];
  const urls = Array.isArray(plan.advertiser_page_urls) ? plan.advertiser_page_urls : [];
  const keywords = Array.isArray(plan.competitor_keywords) ? plan.competitor_keywords : [];
  const seen = new Set();
  const rows = [];

  const pickKeywordForSlug = (slug) => {
    const s = humanizeFacebookSlug(slug).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!s) return '';
    for (const kw of keywords) {
      const k = String(kw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (k.length >= 3 && (s.includes(k) || k.includes(s))) return String(kw).trim();
    }
    return '';
  };

  for (const rawUrl of urls) {
    const u = String(rawUrl || '').trim();
    if (!u) continue;
    const normalizedUrl = u.startsWith('http') ? u : `https://${u.replace(/^\/+/, '')}`;
    const pageId = extractFacebookPageIdFromUrl(normalizedUrl);
    let slug = '';
    try {
      const parsed = new URL(normalizedUrl);
      const parts = parsed.pathname.split('/').filter(Boolean);
      slug = parts.length ? parts[parts.length - 1].replace(/^@/, '') : '';
    } catch {
      slug = '';
    }
    const fromKw = pickKeywordForSlug(slug);
    const pretty = humanizeFacebookSlug(slug);
    const name =
      (fromKw || '').trim() ||
      (pretty ? pretty.replace(/\b\w/g, (c) => c.toUpperCase()) : '') ||
      (pageId ? `Page ${pageId}` : 'Facebook page');
    const key = (pageId || name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      name,
      page_id: pageId,
      page_url: normalizedUrl,
      count: null,
      from_plan: true,
    });
  }

  for (const kw of keywords) {
    const name = String(kw || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ name, page_id: '', page_url: '', count: null, from_plan: true });
  }

  return rows;
}

function normalizeAdvertiserMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAdvertiserFilterValue(entry) {
  const pageId = String(entry?.page_id || '').trim();
  if (pageId) return `page:${pageId}`;
  const pageUrl = normalizeAdvertiserMatch(entry?.page_url || '');
  if (pageUrl) return `url:${pageUrl}`;
  return `name:${normalizeAdvertiserMatch(entry?.name || '')}`;
}

function adMatchesAdvertiserFilterValue(item, value) {
  if (!value || value === 'all') return true;
  const [type, ...rest] = String(value).split(':');
  const needle = rest.join(':').trim();
  if (!needle) return true;

  if (type === 'page') {
    return String(item.page_id || '').trim() === needle;
  }

  if (type === 'url') {
    return normalizeAdvertiserMatch(item.page_url || '').includes(needle);
  }

  const labels = [item.page_name, item.title].map(normalizeAdvertiserMatch).filter(Boolean);
  if (labels.some((label) => label === needle || label.includes(needle))) return true;
  const words = needle.split(' ').filter((word) => word.length >= 3);
  return Boolean(words.length && labels.some((label) => words.every((word) => label.includes(word))));
}

/** Match an ad row to a competitor card (page id, page URL, or loose name match). */
function adMatchesCompetitorFilter(item, comp) {
  if (!comp?.name) return true;
  const pid = String(comp.page_id || '').trim();
  if (pid && /^\d{6,}$/.test(pid)) {
    const adPid = String(item.page_id || '').trim();
    if (adPid && adPid === pid) return true;
  }
  const pageUrl = String(comp.page_url || '').trim();
  if (pageUrl && item.page_url) {
    try {
      const a = new URL(String(item.page_url).startsWith('http') ? item.page_url : `https://${item.page_url}`);
      const b = new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`);
      const hn = (h) => h.replace(/^www\./i, '');
      if (hn(a.hostname) === hn(b.hostname) && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '')) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  const labels = [item.page_name, item.title].map(normalizeAdvertiserMatch).filter(Boolean);
  const needle = normalizeAdvertiserMatch(comp.name);
  if (!needle) return true;
  if (labels.some((l) => l.includes(needle))) return true;
  const words = needle.split(' ').filter((w) => w.length >= 3);
  if (words.length) return labels.some((l) => words.every((w) => l.includes(w)));
  return false;
}

function buildAdvertisersFromResults(results = []) {
  const map = new Map();
  for (const item of results) {
    const pageId = String(item.page_id || '').trim();
    const name = String(item.page_name || item.title || '').trim() || 'Unknown';
    const key = pageId || name;
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      map.set(key, {
        name,
        page_id: pageId,
        page_url: item.page_url || '',
        count: 1,
        from_plan: false,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function shouldProxyFacebookMedia(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host.includes('fbcdn.net') || host.endsWith('.facebook.com') || host.endsWith('.fb.com');
  } catch {
    return false;
  }
}

function buildFacebookMediaUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (!shouldProxyFacebookMedia(raw)) return raw;
  return `${API_URL}/api/facebook/media-proxy?url=${encodeURIComponent(raw)}`;
}

function FacebookAds() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { notifyBillingOrApiError } = useApiToast();
  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('US');
  const [countries, setCountries] = useState(DEFAULT_COUNTRIES);
  const [countrySearch, setCountrySearch] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [limit, setLimit] = useState(40);
  const [adActiveStatus, setAdActiveStatus] = useState('ALL');
  const [searchMode, setSearchMode] = useState('research');
  const [intelligent, setIntelligent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchNotice, setSearchNotice] = useState('');
  const [results, setResults] = useState([]);
  const [searchPlan, setSearchPlan] = useState(null);
  const [researchSummary, setResearchSummary] = useState(null);
  const [facets, setFacets] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [advertiserFilter, setAdvertiserFilter] = useState('all');
  const [ctaFilter, setCtaFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortBy, setSortBy] = useState(SPY_DEFAULT_SORT);
  const [selectedAd, setSelectedAd] = useState(null);
  const countryRef = useRef(null);
  const [seedQuery, setSeedQuery] = useState('');
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [pageSuggestions, setPageSuggestions] = useState([]);
  const [pageSuggestionsLoading, setPageSuggestionsLoading] = useState(false);
  const [selectedPageUrls, setSelectedPageUrls] = useState([]);

  const source = useMemo(() => {
    const match = FACEBOOK_SOURCES.find((item) => location.pathname.startsWith(item.route));
    return match?.id || 'facebook_ads';
  }, [location.pathname]);

  const activeSource = useMemo(
    () => FACEBOOK_SOURCES.find((item) => item.id === source) || FACEBOOK_SOURCES[0],
    [source]
  );
  const sourceKey = activeSource.sourceKey || activeSource.id;
  const isAdSource = sourceKey === 'apify_meta_ads';
  const hasProAccess = true;
  const hasPaidPlan = true;
  const limitOptions = [20, 40, 60, 100];
  const selectedCountry = useMemo(() => {
    if (country === COUNTRY_ALL) {
      return { value: COUNTRY_ALL, label: 'All countries' };
    }
    return countries.find((item) => item.value === country) || DEFAULT_COUNTRIES[1];
  }, [countries, country]);

  useEffect(() => {
    setCompetitors([]);
    setSeedQuery('');
    setSelectedCompetitor(null);
  }, [location.pathname]);

  const filteredCountries = useMemo(() => {
    const allOption = { value: COUNTRY_ALL, label: 'All countries' };
    const query = countrySearch.trim().toLowerCase();
    const matchesAll =
      !query ||
      allOption.label.toLowerCase().includes(query) ||
      allOption.value.toLowerCase().includes(query);
    const list = !query
      ? countries.filter((item) => item.value !== COUNTRY_ALL)
      : countries.filter((item) => item.value !== COUNTRY_ALL && countryMatchesQuery(item, query));
    return matchesAll ? [allOption, ...list] : list;
  }, [countries, countrySearch]);
  const filteredResults = useMemo(() => {
    let next = [...results];

    if (selectedCompetitor?.name) {
      next = next.filter((item) => adMatchesCompetitorFilter(item, selectedCompetitor));
    }

    if (resultFilter === 'video') {
      next = next.filter((item) => {
        if (item.kind !== 'ad') return false;
        const m = resolveFacebookAdCreativeMedia(item);
        return Boolean(m.videoUrl || m.isVideo);
      });
    } else if (resultFilter === 'image') {
      next = next.filter((item) => {
        if (item.kind !== 'ad') return false;
        const m = resolveFacebookAdCreativeMedia(item);
        return Boolean(m.posterUrl) && !m.videoUrl && !m.isVideo;
      });
    } else if (resultFilter === 'facebook') {
      next = next.filter((item) => (item.publisher_platforms || []).includes('facebook'));
    } else if (resultFilter === 'instagram') {
      next = next.filter((item) => (item.publisher_platforms || []).includes('instagram'));
    }

    if (advertiserFilter !== 'all') {
      next = next.filter((item) => adMatchesAdvertiserFilterValue(item, advertiserFilter));
    }

    if (ctaFilter !== 'all') {
      next = next.filter((item) => (item.call_to_action_types || []).includes(ctaFilter));
    }

    if (platformFilter !== 'all') {
      next = next.filter((item) => (item.publisher_platforms || []).includes(platformFilter));
    }

    if (sortBy === 'longest_running') {
      next = sortAdsByLongevity(next);
    } else if (sortBy === 'best_impressions') {
      next = sortAdsByImpressions(next);
    } else if (sortBy === 'newest') {
      next.sort((a, b) => new Date(b.ad_delivery_start_time || b.ad_creation_time || 0) - new Date(a.ad_delivery_start_time || a.ad_creation_time || 0));
    } else if (sortBy === 'advertiser') {
      next.sort((a, b) => String(a.page_name || '').localeCompare(String(b.page_name || '')));
    } else if (sortBy === 'video_first') {
      next.sort((a, b) => Number(Boolean(b.video_url)) - Number(Boolean(a.video_url)));
    }

    return next;
  }, [advertiserFilter, ctaFilter, platformFilter, resultFilter, results, selectedCompetitor, sortBy]);

  useEffect(() => {
    if (!results.length || advertiserFilter === 'all') return;
    if (!results.some((item) => adMatchesAdvertiserFilterValue(item, advertiserFilter))) {
      setAdvertiserFilter('all');
    }
  }, [results, advertiserFilter]);

  useEffect(() => {
    if (!results.length || ctaFilter === 'all') return;
    const ok = results.some((item) => (item.call_to_action_types || []).includes(ctaFilter));
    if (!ok) setCtaFilter('all');
  }, [results, ctaFilter]);

  useEffect(() => {
    if (!results.length || platformFilter === 'all') return;
    const ok = results.some((item) => (item.publisher_platforms || []).includes(platformFilter));
    if (!ok) setPlatformFilter('all');
  }, [results, platformFilter]);

  const sidebarAdvertisers = useMemo(() => {
    const base = competitors.length ? competitors : buildAdvertisersFromResults(results);
    return base
      .map((entry) => ({
        ...entry,
        count: results.filter((item) => adMatchesCompetitorFilter(item, entry)).length || entry.count || 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [competitors, results]);

  const ctaOptions = useMemo(
    () => (facets?.ctas || []).map((item) => item.label).filter(Boolean),
    [facets]
  );
  const platformOptions = useMemo(
    () => (facets?.platforms || []).map((item) => item.label).filter(Boolean),
    [facets]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCountries() {
      try {
        setCountriesLoading(true);
        const response = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2');
        if (!response.ok) {
          throw new Error(`Countries API error ${response.status}`);
        }
        const data = await response.json();
        const next = Array.isArray(data)
          ? data
              .map((item) => ({
                value: String(item?.cca2 || '').trim(),
                label: String(item?.name?.common || '').trim(),
              }))
              .filter((item) => item.value && item.label)
              .sort((a, b) => a.label.localeCompare(b.label))
          : DEFAULT_COUNTRIES;

        if (!cancelled && next.length) {
          setCountries(next);
          if (country !== COUNTRY_ALL && !next.some((item) => item.value === country)) {
            setCountry('US');
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load countries:', err);
          setCountries(DEFAULT_COUNTRIES);
        }
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
    function handleClickOutside(event) {
      if (countryRef.current && !countryRef.current.contains(event.target)) {
        setCountryOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isAdSource || searchMode !== 'keyword') {
      setPageSuggestions([]);
      return undefined;
    }

    const query = keyword.trim();
    if (query.length < 2 || /^https?:\/\//i.test(query)) {
      setPageSuggestions([]);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setPageSuggestionsLoading(true);
        const token = await getToken();
        if (!token || cancelled) return;
        const searchCountries = country === COUNTRY_ALL ? ['US'] : [country];
        const data = await searchFacebookPages(token, {
          q: query,
          countries: searchCountries,
          limit: 8,
        });
        if (!cancelled) {
          setPageSuggestions(Array.isArray(data?.pages) ? data.pages : []);
        }
      } catch {
        if (!cancelled) setPageSuggestions([]);
      } finally {
        if (!cancelled) setPageSuggestionsLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [country, getToken, isAdSource, keyword, searchMode]);

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!keyword.trim()) return;
    setIsLoading(true);
    setResults([]);
    setCompetitors([]);
    setSearchNotice('');
    setSearchPlan(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const businessProfile = readBusinessProfile();
      const shouldUseIntelligent = isAdSource && intelligent;
      const searchCountries = country === COUNTRY_ALL ? [COUNTRY_ALL] : [country];
      const data = shouldUseIntelligent
        ? await intelligentSearchFacebookAds({
            token,
            prompt: keyword.trim(),
            keyword: keyword.trim(),
            countries: searchCountries,
            limit,
            adType: 'ALL',
            adActiveStatus,
            source: sourceKey,
            businessProfile,
            searchMode,
          })
        : await searchFacebookAds({
            token,
            keyword: keyword.trim(),
            countries: searchCountries,
            limit,
            adType: 'ALL',
            adActiveStatus,
            source: sourceKey,
            searchMode,
            pageUrls: selectedPageUrls,
          });

      setSearchPlan(data?.plan || null);
      setResearchSummary(data?.research_summary || null);
      setFacets(data?.facets || null);
      setResultFilter('all');
      setAdvertiserFilter('all');
      setCtaFilter('all');
      setPlatformFilter('all');
      setSortBy(isAdSource ? SPY_DEFAULT_SORT : 'best_match');
      setSaveStatus('');
      const rawResults = Array.isArray(data?.results) ? data.results : [];
      const plan = data?.plan;
      const planCompetitors =
        shouldUseIntelligent && plan ? buildCompetitorsFromIntelligentPlan(plan) : [];
      const advertiserRows = Array.isArray(data?.facets?.advertisers) ? data.facets.advertisers : [];
      const facetCompetitors = advertiserRows
        .map((row) => ({
          name: typeof row === 'string' ? row : String(row?.name || '').trim(),
          count: typeof row === 'object' && row != null ? Number(row.count) || 0 : 0,
          page_id: typeof row === 'object' && row != null ? String(row.page_id || '').trim() : '',
          page_url: '',
          from_plan: false,
        }))
        .filter((row) => row.name);
      const normalizedCompetitors =
        planCompetitors.length > 0 ? planCompetitors : facetCompetitors;

      setResults(rawResults);
      setSeedQuery(keyword.trim());
      setSelectedCompetitor(null);

      if (isAdSource && (normalizedCompetitors.length > 0 || rawResults.length > 0)) {
        setCompetitors(
          normalizedCompetitors.length > 0 ? normalizedCompetitors : buildAdvertisersFromResults(rawResults)
        );
        if (!rawResults.length) {
          setSearchNotice(
            'No ads were returned for this search. Try another country, active status, or simpler keywords. Advertiser shortcuts below will filter results once a search returns creatives.'
          );
        }
      } else {
        setCompetitors([]);
        setSearchNotice('');
      }
    } catch (err) {
      console.error(err);
      setResults([]);
      setSearchPlan(null);
      setResearchSummary(null);
      setFacets(null);
      setCompetitors([]);
      setSelectedCompetitor(null);
      setSearchNotice('');
      notifyBillingOrApiError(err, 'Failed to fetch data from Facebook.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompetitorSelect = (comp) => {
    if (!comp?.name) return;
    setSelectedCompetitor(comp);
    setSearchNotice('');
    setResultFilter('all');
    setAdvertiserFilter('all');
    setCtaFilter('all');
    setPlatformFilter('all');
    setSortBy(isAdSource ? SPY_DEFAULT_SORT : 'best_match');
    setSaveStatus('');
    const hasMatch = results.some((item) => adMatchesCompetitorFilter(item, comp));
    if (!hasMatch && results.length) {
      setSearchNotice(
        'No rows in this result set matched that advertiser name. Try the advertiser dropdown or another brand from the list.'
      );
    }
  };

  const handleClearAdvertiserFocus = () => {
    setSelectedCompetitor(null);
    setSaveStatus('');
    setSearchNotice('');
    setResultFilter('all');
    setAdvertiserFilter('all');
    setCtaFilter('all');
    setPlatformFilter('all');
    setSortBy(isAdSource ? SPY_DEFAULT_SORT : 'best_match');
  };

  const handleSaveCollection = async () => {
    if (!filteredResults.length) return;
    try {
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      await createCollection(token, {
        platform: 'facebook',
        source: sourceKey,
        name: (selectedCompetitor?.name || keyword).trim() || `${activeSource.label} collection`,
        keyword: (selectedCompetitor?.name || keyword).trim(),
        limit,
        sortBy: 'relevance',
        intelligent: intelligent || searchMode !== 'keyword',
        prompt: intelligent ? keyword.trim() : '',
        results: filteredResults,
        plan: searchPlan,
        meta: {
          saved_from: location.pathname,
          search_mode: searchMode,
          research_summary: researchSummary,
          facets,
          seed_query: seedQuery,
          advertiser_page_id: selectedCompetitor?.page_id || '',
        },
      });
      setSaveStatus('Facebook results saved to collections.');
    } catch (err) {
      setSaveStatus(err?.message || 'Failed to save Facebook collection.');
    }
  };

  const usesBriefInput = isAdSource && searchMode !== 'keyword';
  const isHookGenerator = source === 'facebook_hook_generator';
  const hasAdResults = isAdSource && results.length > 0;

  return (
    <section className="relative space-y-5 text-slate-900">
      {isHookGenerator ? (
        <FacebookHookGeneratorPanel hasProAccess={hasProAccess} navigate={navigate} />
      ) : (
        <>
      <form onSubmit={handleSearch} className="space-y-3 bg-white">
        <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isAdSource ? (
            <>
              <select
                value={searchMode}
                onChange={(event) => {
                  const nextMode = event.target.value;
                  setSearchMode(nextMode);
                  if (nextMode === 'keyword') {
                    setIntelligent(false);
                  }
                }}
                className={`${FB_TOOLBAR_CONTROL} w-[13rem]`}
                title="Research brief runs AI planning then Apify. Keyword is direct search."
              >
              <option value="research">Research brief</option>
              <option value="competitor">Competitor search</option>
              <option value="keyword">Keyword search</option>
              </select>

              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className={`${FB_TOOLBAR_CONTROL} w-[5rem]`}
                aria-label="Result limit"
              >
                {limitOptions.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>

              <div ref={countryRef} className="relative w-[20rem] shrink-0">
                <button
                  type="button"
                  onClick={() => setCountryOpen((prev) => !prev)}
                  className={`${FB_TOOLBAR_CONTROL} flex w-full items-center justify-between gap-2`}
                >
                  <span className="truncate">{selectedCountry?.label || 'Country'}</span>
                  <span className="text-[10px] uppercase text-slate-400">{country}</span>
                </button>

              {countryOpen ? (
                <div
                  className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
                >
                  <input
                    value={countrySearch}
                    onChange={(event) => setCountrySearch(event.target.value)}
                    placeholder="Search country..."
                    className={`${FB_TOOLBAR_CONTROL} w-full`}
                  />
                  <div className="mt-2 max-h-80 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {countriesLoading ? (
                      <div className="flex justify-center py-3">
                        <CubeLoader size={56} />
                      </div>
                    ) : filteredCountries.length ? (
                      filteredCountries.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            setCountry(item.value);
                            setCountrySearch('');
                            setCountryOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm ${
                            item.value === country ? 'bg-[#10b981] text-white' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{item.label}</span>
                          <span className="text-[10px] font-semibold uppercase">{item.value}</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-2 py-2 text-xs text-slate-500">No countries found.</p>
                    )}
                  </div>
                </div>
              ) : null}
              </div>

              <select
                value={adActiveStatus}
                onChange={(event) => setAdActiveStatus(event.target.value)}
                className={`${FB_TOOLBAR_CONTROL} w-[9rem]`}
                aria-label="Ad active status"
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>

            </>
          ) : (
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className={`${FB_TOOLBAR_CONTROL} w-[4.5rem]`}
            >
              {limitOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          )}

          {isAdSource ? (
            <label
              className={`${FB_TOOLBAR_BTN} w-[12rem] cursor-pointer gap-2 border border-slate-200 bg-slate-50 text-xs text-slate-700 hover:bg-white`}
              title="Use AI to plan competitors and queries before loading ads from the Ad Library"
            >
              <input
                type="checkbox"
                checked={intelligent}
                onChange={(event) => {
                  setIntelligent(event.target.checked);
                }}
                className="h-3.5 w-3.5 accent-[#10b981]"
              />
              Intelligence search
            </label>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className={`${FB_TOOLBAR_BTN} w-[10rem] bg-[#10b981] text-white hover:bg-[#059669] disabled:opacity-60`}
          >
            {activeSource.button}
          </button>
        </div>

        {!hasAdResults ? (
        <div className="w-full rounded-sm border border-slate-200 bg-slate-50 p-4">
          {usesBriefInput ? (
            <textarea
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={
                searchMode === 'competitor'
                  ? 'Describe the niche and competitors you want to uncover…'
                  : 'Describe your market, offer, audience, or angle — we plan competitors then search the Ad Library…'
              }
              className="min-h-[10rem] w-full resize-y bg-transparent text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
            />
          ) : (
            <div className="space-y-3">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={activeSource.placeholder}
                className="h-10 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />

              {pageSuggestionsLoading ? (
                <p className="text-xs text-slate-500">Looking up official Facebook pages…</p>
              ) : null}

              {pageSuggestions.length ? (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Official pages</p>
                  <div className="flex flex-wrap gap-2">
                    {pageSuggestions.map((page) => {
                      const selected = selectedPageUrls.includes(page.url);
                      return (
                        <button
                          key={`${page.url}-${page.id || page.name}`}
                          type="button"
                          onClick={() => {
                            setSelectedPageUrls((prev) =>
                              selected ? prev.filter((url) => url !== page.url) : [...prev, page.url]
                            );
                          }}
                          className={`rounded-sm border px-2.5 py-1.5 text-left text-xs ${
                            selected
                              ? 'border-[#10b981]/30 bg-[#10b981]/10 text-[#047857]'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="font-semibold">{page.name}</span>
                          <span className="mt-0.5 block text-[10px] text-slate-400">{page.url}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {selectedPageUrls.length ? (
                <p className="text-xs font-medium text-[#047857]">
                  Searching {selectedPageUrls.length} selected page{selectedPageUrls.length === 1 ? '' : 's'} with Apify.
                </p>
              ) : null}
            </div>
          )}
        </div>
        ) : (
          <div className="flex items-center justify-between gap-3 border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="truncate">Current search: <span className="font-semibold text-slate-900">{seedQuery || keyword}</span></span>
            <button
              type="button"
              onClick={() => {
                setResults([]);
                setCompetitors([]);
                setSeedQuery('');
                setSaveStatus('');
                setSelectedAd(null);
              }}
              className="shrink-0 font-semibold text-[#047857] hover:text-[#10b981]"
            >
              New search
            </button>
          </div>
        )}

        {activeSource.helper ? (
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{activeSource.label}</span> {activeSource.helper}
          </p>
        ) : null}

      </form>

      {isLoading ? (
        <CubeLoaderOverlay label="Searching the Ad Library…" minHeight="calc(100dvh - 11rem)" />
      ) : (
        <>
      {searchNotice ? (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {searchNotice}
        </div>
      ) : null}

      {searchPlan && !results.length ? (
        <div className="rounded-sm border border-[#10b981]/20 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#25d366]">
            <SearchSparkIcon />
            Intelligent Search
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Searching for</span>
            <span className="rounded-full bg-[#10b981] px-3 py-1 text-sm font-semibold text-white">
              {searchPlan.query}
            </span>
            {searchPlan.search_mode ? (
              <span className="rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-600">
                {searchPlan.search_mode}
              </span>
            ) : null}
          </div>
          {Array.isArray(searchPlan.related_queries) && searchPlan.related_queries.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {searchPlan.related_queries.slice(0, 4).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setKeyword(item)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 transition hover:border-[#10b981] hover:bg-[#10b981]/10"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          {Array.isArray(searchPlan.competitor_keywords) && searchPlan.competitor_keywords.length ? (
            <div className="mt-3 space-y-1">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Competitor Leads</p>
              <div className="flex flex-wrap gap-2">
                {searchPlan.competitor_keywords.slice(0, 5).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setKeyword(item)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 transition hover:border-[#10b981] hover:bg-[#10b981]/10"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {Array.isArray(searchPlan.advertiser_page_urls) && searchPlan.advertiser_page_urls.length ? (
            <div className="mt-3 space-y-1">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Advertiser page targets</p>
              <div className="flex flex-wrap gap-2">
                {searchPlan.advertiser_page_urls.map((item) => (
                  <a
                    key={item}
                    href={item}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 transition hover:border-[#10b981] hover:bg-[#10b981]/10"
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          {Array.isArray(searchPlan.task_runs) && searchPlan.task_runs.length ? (
            <div className="mt-3 space-y-1">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Executed search targets</p>
              <div className="flex flex-wrap gap-2">
                {searchPlan.task_runs.map((item) => (
                  <span key={`${item.target_type}-${item.target}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                    {item.target}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {searchPlan.rationale ? <p className="mt-3 text-xs text-slate-500">{searchPlan.rationale}</p> : null}
        </div>
      ) : null}

      {researchSummary && !results.length ? (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Ads surfaced</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{researchSummary.total_ads || 0}</p>
          </div>
          <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Advertisers</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{researchSummary.advertiser_count || 0}</p>
          </div>
          <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Task runs</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{researchSummary.task_count || 0}</p>
          </div>
          <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Best format mix</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {facets?.formats?.video || 0} video / {facets?.formats?.image || 0} static
            </p>
            {typeof researchSummary.discarded_low_relevance === 'number' ? (
              <p className="mt-2 text-[11px] text-slate-500">
                Filtered out {researchSummary.discarded_low_relevance} low-relevance ads
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isAdSource && results.length > 0 ? (
        <div className="space-y-3">
          <aside className="hidden">
            <div className="flex max-h-[calc(100dvh-6rem)] flex-col rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Advertisers</p>
                  {seedQuery ? (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      &ldquo;{seedQuery}&rdquo;
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-500">
                  {sidebarAdvertisers.length}
                </span>
              </div>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleClearAdvertiserFocus}
                className={`mt-4 w-full rounded-sm border px-3 py-2 text-left text-xs font-semibold transition disabled:opacity-50 ${
                  !selectedCompetitor
                    ? 'border-[#10b981] bg-[#10b981]/10 text-[#047857]'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                All advertisers
              </button>

              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {sidebarAdvertisers.map((c) => {
                  const isSelected =
                    selectedCompetitor &&
                    selectedCompetitor.name === c.name &&
                    (selectedCompetitor.page_id || '') === (c.page_id || '');
                  return (
                    <button
                      key={`${c.page_id || 'nopage'}-${c.name}`}
                      type="button"
                      onClick={() => handleCompetitorSelect(c)}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                        isSelected
                          ? 'border-[#10b981] bg-[#10b981]/10'
                          : 'border-slate-200 hover:border-[#10b981]/30 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1877f2]/25 text-xs font-bold text-[#8ab4ff]">
                        {String(c.name).slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-semibold text-slate-950">{c.name}</span>
                        <span className="mt-1 block text-[11px] text-slate-500">
                          {c.count} ad{c.count === 1 ? '' : 's'}
                          {c.from_plan ? ' · from plan' : ''}
                        </span>
                        {c.page_id ? (
                          <span className="mt-1 block font-mono text-[10px] text-slate-400">Page {c.page_id}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="space-y-3">
            {selectedCompetitor ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[#10b981]/25 bg-[#10b981]/10 px-4 py-3 text-sm text-slate-700">
                <p>
                  Ads for <span className="font-semibold text-slate-950">{selectedCompetitor.name}</span>
                </p>
                <button
                  type="button"
                  onClick={handleClearAdvertiserFocus}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            ) : null}

            {searchNotice ? (
              <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {searchNotice}
              </div>
            ) : null}

            {sortBy === 'longest_running' ? (
              <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Ranked by run-time — longevity is the closest signal Meta gives you for a proven winner.
              </div>
            ) : null}

            {sortBy === 'best_impressions' ? (
              <div className="rounded-sm border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                Ranked by impressions when Meta exposes them. Many ads hide exact reach — we use index buckets when available.
              </div>
            ) : null}

            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border border-slate-200 bg-white p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {hasPaidPlan ? (
                <button
                  type="button"
                  onClick={handleSaveCollection}
                  className="h-10 shrink-0 rounded-sm bg-[#10b981] px-4 text-sm font-semibold text-white hover:bg-[#059669]"
                >
                  Save Results
                </button>
              ) : null}
              <select
                value={advertiserFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setAdvertiserFilter(value);
                  setSelectedCompetitor(
                    value === 'all'
                      ? null
                      : sidebarAdvertisers.find((item) => getAdvertiserFilterValue(item) === value) || null
                  );
                }}
                className="h-10 w-[13rem] shrink-0 rounded-sm border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#10b981]"
              >
                <option value="all">All advertisers</option>
                {sidebarAdvertisers.map((item) => (
                  <option key={`${item.page_id || 'nopage'}-${item.name}`} value={getAdvertiserFilterValue(item)}>
                    {item.name} ({item.count})
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-10 w-[12rem] shrink-0 rounded-sm border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#10b981]"
              >
                <option value="longest_running">Longest running</option>
                <option value="best_impressions">Best impressions</option>
                <option value="best_match">Best match</option>
                <option value="newest">Newest first</option>
                <option value="video_first">Video first</option>
                <option value="advertiser">Advertiser A-Z</option>
              </select>
              <select
                value={resultFilter}
                onChange={(event) => setResultFilter(event.target.value)}
                className="h-10 w-[10rem] shrink-0 rounded-sm border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#10b981]"
              >
                <option value="all">All formats</option>
                <option value="video">Video only</option>
                <option value="image">Static only</option>
                <option value="facebook">Facebook only</option>
                <option value="instagram">Instagram only</option>
              </select>
              <select
                value={ctaFilter}
                onChange={(event) => setCtaFilter(event.target.value)}
                className="h-10 w-[10rem] shrink-0 rounded-sm border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#10b981]"
              >
                <option value="all">All CTAs</option>
                {ctaOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select
                value={platformFilter}
                onChange={(event) => setPlatformFilter(event.target.value)}
                className="h-10 w-[10rem] shrink-0 rounded-sm border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#10b981]"
              >
                <option value="all">All platforms</option>
                {platformOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <p className="shrink-0 text-xs text-slate-500">
                {filteredResults.length} shown
                {filteredResults.length < results.length ? (
                  <span className="text-slate-400"> / {results.length}</span>
                ) : null}
              </p>
              {saveStatus ? <p className="text-xs font-medium text-[#047857]">{saveStatus}</p> : null}
            </div>

            {filteredResults.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p>
                  Filters are hiding all {results.length} result{results.length === 1 ? '' : 's'}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setResultFilter('all');
                    setAdvertiserFilter('all');
                    setCtaFilter('all');
                    setPlatformFilter('all');
                    setSortBy(isAdSource ? SPY_DEFAULT_SORT : 'best_match');
                    setSelectedCompetitor(null);
                  }}
                  className="shrink-0 rounded-sm bg-[#10b981] px-3 py-2 text-xs font-semibold text-white"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {filteredResults.map((item) => (
                  <FacebookResultCard key={item.id} item={item} navigate={navigate} onView={setSelectedAd} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : results.length ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-[#10b981]"
            >
              <option value="best_match">Best match</option>
              <option value="newest">Newest first</option>
            </select>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {filteredResults.map((item) => (
              <FacebookResultCard key={item.id} item={item} navigate={navigate} onView={setSelectedAd} />
            ))}
          </div>
        </div>
      ) : null}

      {!results.length && !isLoading && (
        <div className="grid min-h-[46vh] place-items-center rounded-sm border border-dashed border-slate-200 bg-white/70">
          <div className="flex max-w-sm flex-col items-center p-8 text-center">
            <EmptyFacebookIcon />
            <p className="mt-6 text-2xl font-semibold text-slate-950">Search to get started</p>
            <p className="mt-2 text-sm text-slate-500">{activeSource.empty}</p>
          </div>
        </div>
      )}

      {selectedAd ? (
        <FacebookAdDetailModal
          item={selectedAd}
          onClose={() => setSelectedAd(null)}
          onGenerate={() => {
            saveBulkCreativeIntel(buildIntelFromFacebookAd(selectedAd));
            navigate('/facebook/hook-generator');
          }}
        />
      ) : null}

        </>
      )}
        </>
      )}
    </section>
  );
}

function readBusinessProfile() {
  try {
    const raw = localStorage.getItem('business_profile');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function SearchSparkIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path d="M10 2.5l1.45 4.05L15.5 8l-4.05 1.45L10 13.5 8.55 9.45 4.5 8l4.05-1.45L10 2.5Z" fill="currentColor" />
      <path d="M15.75 13.25l.72 2.03 2.03.72-2.03.73-.72 2.02-.73-2.02-2.02-.73 2.02-.72.73-2.03Z" fill="currentColor" />
    </svg>
  );
}

function pickHttpsMediaUrl(...values) {
  for (const value of values) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (raw && /^https?:\/\//i.test(raw)) return raw;
  }
  return '';
}

/** Poster + video from API fields or Apify `raw.snapshot`. */
function resolveFacebookAdCreativeMedia(item) {
  const raw = item?.raw && typeof item.raw === 'object' ? item.raw : {};
  const snap = raw.snapshot && typeof raw.snapshot === 'object' ? raw.snapshot : {};
  const videos = Array.isArray(snap.videos) ? snap.videos : [];
  const v0 = videos[0] || {};
  const assets = Array.isArray(item?.media_assets) ? item.media_assets : [];
  const assetImage = assets.find((a) => a?.type === 'image')?.url || '';
  const assetVideo = assets.find((a) => a?.type === 'video')?.url || '';
  const snapImage0 = Array.isArray(snap.images) ? snap.images[0] : null;
  const snapImageUrl =
    typeof snapImage0 === 'string' ? snapImage0 : snapImage0?.url || snapImage0?.image_url || '';

  const posterUrl = pickHttpsMediaUrl(
    item?.image_url,
    v0.videoPreviewImageUrl,
    v0.video_preview_image_url,
    snap.pageProfilePictureUrl,
    snap.page_profile_picture_url,
    assetImage,
    snapImageUrl
  );

  const videoUrl = pickHttpsMediaUrl(
    item?.video_url,
    v0.videoHdUrl,
    v0.video_hd_url,
    v0.videoSdUrl,
    v0.video_sd_url,
    assetVideo
  );

  const archiveId = String(raw.adArchiveId || raw.adArchiveID || raw.ad_archive_id || item?.id || '').trim();
  const snapshotUrl = pickHttpsMediaUrl(
    item?.ad_snapshot_url,
    raw.ad_library_url,
    raw.adLibraryUrl,
    archiveId && /^\d+$/.test(archiveId) ? `https://www.facebook.com/ads/library/?id=${archiveId}` : ''
  );

  const isVideo =
    Boolean(videoUrl) ||
    String(snap.displayFormat || snap.display_format || item?.display_format || '').toUpperCase() === 'VIDEO';

  return {
    posterUrl: buildFacebookMediaUrl(posterUrl),
    videoUrl: buildFacebookMediaUrl(videoUrl),
    snapshotUrl,
    isVideo,
  };
}

function FacebookAdResultCard({ item, navigate, onView }) {
  const media = useMemo(() => resolveFacebookAdCreativeMedia(item), [item]);
  const longevityDays = useMemo(() => computeAdLongevityDays(item), [item]);
  const [posterFailed, setPosterFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [playVideo, setPlayVideo] = useState(false);

  useEffect(() => {
    setPosterFailed(false);
    setVideoFailed(false);
    setPlayVideo(false);
  }, [item.id, media.posterUrl, media.videoUrl]);

  const showPoster = Boolean(media.posterUrl) && !posterFailed;
  const showVideoPlayer = Boolean(media.videoUrl) && !videoFailed;
  const showPlayOverlay = false;

  return (
    <article className="rounded-sm border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
      <div className="relative min-h-[12rem] w-full overflow-hidden rounded-sm bg-slate-100 md:min-h-[15rem] xl:min-h-[12rem] 2xl:min-h-[14rem]">
        {showVideoPlayer ? (
          <video
            key={media.videoUrl}
            src={media.videoUrl}
            poster={media.posterUrl || undefined}
            className="h-full w-full object-cover"
            controls
            muted
            playsInline
            preload="metadata"
            onError={() => {
              setVideoFailed(true);
              setPlayVideo(false);
            }}
          />
        ) : showPoster ? (
          <button
            type="button"
            className="relative block h-full w-full cursor-pointer border-0 bg-transparent p-0 text-left"
            onClick={() => {
              if (media.videoUrl) setPlayVideo(true);
            }}
            disabled={!media.videoUrl}
            aria-label={media.videoUrl ? 'Play ad video' : 'Ad creative preview'}
          >
            <img
              src={media.posterUrl}
              alt={item.page_name || item.title || 'Ad creative'}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setPosterFailed(true)}
            />
            {showPlayOverlay ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                <span className="rounded-full bg-white/95 px-4 py-2 text-xs font-bold text-black shadow-lg">
                  ▶ Play video
                </span>
              </span>
            ) : null}
          </button>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
            <p className="text-xs text-slate-500">
              {posterFailed || videoFailed ? 'Preview blocked by Facebook CDN.' : 'No preview image in this row.'}
            </p>
          </div>
        )}
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-semibold">{item.page_name || item.title || 'Unknown Page'}</h3>
      <p className="mt-1 text-xs app-muted">{item.page_id ? `Page ID: ${item.page_id}` : item.subtitle || 'N/A'}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(item.publisher_platforms || []).length ? item.publisher_platforms.map((platform) => (
          <span key={platform} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
            {platform.replace(/_/g, ' ')}
          </span>
        )) : <span className="text-xs app-muted">Platforms unavailable</span>}
        {media.isVideo ? (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] text-emerald-700">Video</span>
        ) : null}
        {!media.isVideo && media.posterUrl ? (
          <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] text-sky-700">Static</span>
        ) : null}
        {item.impressions_text || (typeof item.impressions === 'string' && item.impressions) ? (
          <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] text-violet-700">
            {item.impressions_text || item.impressions}
          </span>
        ) : null}
        {longevityDays > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] text-amber-700">
            {longevityDays} day{longevityDays === 1 ? '' : 's'} live
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs app-muted">
        Started: {item.ad_delivery_start_time || item.ad_creation_time || 'N/A'}
      </p>
      {item.search_target ? (
        <p className="mt-1 text-[11px] text-slate-500">Search target: {item.search_target}</p>
      ) : null}
      {typeof item.relevance_score === 'number' ? (
        <p className="mt-1 text-[11px] text-slate-500">Relevance: {item.relevance_score.toFixed(2)}</p>
      ) : null}
      {item.matched_terms?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.matched_terms.slice(0, 3).map((term) => (
            <span key={term} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
              matched: {term}
            </span>
          ))}
        </div>
      ) : null}

      {!!item.ad_creative_bodies?.length ? (
        <p className="mt-3 line-clamp-4 text-sm">{item.ad_creative_bodies[0]}</p>
      ) : !!item.captions?.length ? (
        <p className="mt-3 line-clamp-3 text-sm">{item.captions[0]}</p>
      ) : null}

      {!!item.ad_creative_link_titles?.length && (
        <p className="mt-2 text-xs font-semibold">Title: {item.ad_creative_link_titles[0]}</p>
      )}

      {!!item.ad_creative_link_descriptions?.length && (
        <p className="mt-2 line-clamp-2 text-xs app-muted">{item.ad_creative_link_descriptions[0]}</p>
      )}
      {!item.ad_creative_link_descriptions?.length && !!item.ad_creative_link_captions?.length && (
        <p className="mt-2 line-clamp-2 text-xs app-muted">{item.ad_creative_link_captions[0]}</p>
      )}

      {!!item.call_to_action_types?.length && (
        <p className="mt-2 text-xs text-slate-700">CTA: {item.call_to_action_types[0]}</p>
      )}

      {(item.age_from || item.age_until || item.gender || item.delivery_country) ? (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
          {item.age_from || item.age_until ? <span>Age: {item.age_from || '?'}-{item.age_until || '?'}</span> : null}
          {item.gender ? <span>Gender: {item.gender}</span> : null}
          {item.delivery_country ? <span>Country: {item.delivery_country}</span> : null}
        </div>
      ) : null}
      {item.query_params ? (
        <p className="mt-2 line-clamp-2 text-[11px] text-slate-400">Query params: {item.query_params}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {onView ? (
          <button
            type="button"
            onClick={() => onView(item)}
            className="rounded-sm border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            View
          </button>
        ) : null}
        {navigate ? (
          <button
            type="button"
            onClick={() => {
              saveBulkCreativeIntel(buildIntelFromFacebookAd(item));
              navigate('/facebook/hook-generator');
            }}
            className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            20 variations from this ad
          </button>
        ) : null}
      </div>
    </article>
  );
}

function FacebookResultCard({ item, navigate, onView }) {
  if (item.kind === 'group') {
    return (
      <article className="rounded-sm border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="h-40 w-full rounded-sm object-cover" />
        ) : null}
        <h3 className="mt-3 line-clamp-2 text-sm font-semibold">{item.title}</h3>
        {item.subtitle ? <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p> : null}
        {item.description ? <p className="mt-3 line-clamp-4 text-sm">{item.description}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          {item.members ? <span>Members: {item.members}</span> : null}
          {item.privacy ? <span>{item.privacy}</span> : null}
          {item.activity ? <span>{item.activity}</span> : null}
        </div>
        {item.external_url ? (
          <div className="mt-3">
            <a
              href={item.external_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Open Group
            </a>
          </div>
        ) : null}
      </article>
    );
  }

  if (item.kind === 'profile') {
    return (
      <article className="rounded-sm border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
        <div className="flex items-center gap-3">
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-slate-100" />
          )}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{item.title}</h3>
            {item.subtitle ? <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p> : null}
            {item.follow_type ? <p className="mt-1 text-xs text-slate-500">Type: {item.follow_type}</p> : null}
          </div>
        </div>
        {item.external_url ? (
          <div className="mt-3">
            <a
              href={item.external_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Open Profile
            </a>
          </div>
        ) : null}
      </article>
    );
  }

  return <FacebookAdResultCard item={item} navigate={navigate} onView={onView} />;
}

function FacebookAdDetailModal({ item, onClose, onGenerate }) {
  const media = resolveFacebookAdCreativeMedia(item);
  const title = item.ad_creative_link_titles?.[0] || item.title || item.page_name || 'Facebook ad';
  const body = item.ad_creative_bodies?.[0] || item.captions?.[0] || item.description || '';
  const description = item.ad_creative_link_descriptions?.[0] || item.ad_creative_link_captions?.[0] || '';
  const cta = item.call_to_action_types?.[0] || 'N/A';
  const platforms = item.publisher_platforms?.length ? item.publisher_platforms.join(', ').replace(/_/g, ' ') : 'N/A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90dvh] w-full max-w-5xl overflow-y-auto rounded-sm bg-white text-slate-900 shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#047857]">Ad details</p>
            <h2 className="truncate text-lg font-bold">{item.page_name || 'Unknown advertiser'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-sm bg-red-600 text-xl font-black text-white hover:bg-red-700"
            aria-label="Close ad details"
          >
            ×
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="overflow-hidden rounded-sm border border-slate-200 bg-slate-50">
            {media.videoUrl ? (
              <video
                src={media.videoUrl}
                poster={media.posterUrl || undefined}
                className="max-h-[32rem] w-full object-contain"
                controls
                playsInline
                preload="metadata"
              />
            ) : media.posterUrl ? (
              <img
                src={media.posterUrl}
                alt={title}
                className="max-h-[32rem] w-full object-contain"
              />
            ) : (
              <div className="grid min-h-80 place-items-center text-sm text-slate-500">No creative preview available.</div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Headline</p>
              <p className="mt-1 text-xl font-bold">{title}</p>
            </div>

            {body ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Primary text</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{body}</p>
              </div>
            ) : null}

            {description ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Description</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{description}</p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <DetailPill label="CTA" value={cta} />
              <DetailPill label="Platforms" value={platforms} />
              <DetailPill label="Started" value={item.ad_delivery_start_time || item.ad_creation_time || 'N/A'} />
              <DetailPill label="Country" value={item.delivery_country || 'N/A'} />
              <DetailPill label="Page ID" value={item.page_id || 'N/A'} />
              <DetailPill label="Format" value={media.isVideo ? 'Video' : media.posterUrl ? 'Static' : 'Unknown'} />
            </div>

            <button
              type="button"
              onClick={onGenerate}
              className="w-full rounded-sm bg-[#10b981] px-4 py-3 text-sm font-bold text-white hover:bg-[#059669]"
            >
              Generate variations from this ad
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailPill({ label, value }) {
  return (
    <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function EmptyFacebookIcon() {
  return (
    <svg viewBox="0 0 180 120" className="h-32 w-48" fill="none">
      <rect x="38" y="24" width="74" height="56" rx="8" stroke="#25d366" strokeWidth="8" />
      <path d="M64 96h52" stroke="#25d366" strokeWidth="8" strokeLinecap="round" />
      <path d="M124 38h18M124 56h18M124 74h18" stroke="#25d366" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

export default FacebookAds;
