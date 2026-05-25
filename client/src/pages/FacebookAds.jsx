import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBilling } from '../components/billing/BillingContext.jsx';
import {
  createCollection,
  intelligentSearchFacebookAds,
  isBillingOrQuotaError,
  searchFacebookAds,
} from '../lib/api.js';
import CubeLoader, { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import FacebookHookGeneratorPanel from '../components/facebook/FacebookHookGeneratorPanel.jsx';
import { useApiToast } from '../hooks/useApiToast.js';

const FB_TOOLBAR_CONTROL =
  'h-10 min-h-10 shrink-0 rounded-sm app-input px-3 text-sm leading-none';
const FB_TOOLBAR_BTN =
  'inline-flex h-10 min-h-10 shrink-0 items-center justify-center rounded-sm px-3 text-sm font-medium leading-none';

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
    label: 'Ads',
    helper: '',
    placeholder: 'Keyword, Facebook page URL, page handle, or product niche',
    empty: 'Run a search to load Facebook ad creative results.',
    button: 'Search',
  },
  {
    id: 'facebook_trending_music',
    sourceKey: 'apify_meta_ads',
    route: '/facebook/trending-music',
    label: 'Trending Music',
    helper: 'Search for Facebook ad creative inspired by music trends, artists, sounds, or audio-led concepts.',
    placeholder: 'Artist, song trend, audio theme, or music-led campaign idea',
    empty: 'Search to explore Facebook ads through a music-first angle.',
    button: 'Search',
  },
  {
    id: 'facebook_hook_generator',
    route: '/facebook/hook-generator',
    label: 'Hook Generator',
    helper: 'Generate Facebook hooks, headlines, CTAs, and primary ad copy from your product brief.',
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

function FacebookAds() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { subscription } = useBilling();
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
  const [sortBy, setSortBy] = useState('best_match');
  const countryRef = useRef(null);
  const [seedQuery, setSeedQuery] = useState('');
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [competitors, setCompetitors] = useState([]);

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
  const hasProAccess = Boolean(subscription?.is_pro);
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
      ? countries.filter((item) => item.value !== COUNTRY_ALL).slice(0, 79)
      : countries
          .filter(
            (item) =>
              item.value !== COUNTRY_ALL &&
              (item.label.toLowerCase().includes(query) || item.value.toLowerCase().includes(query))
          )
          .slice(0, 79);
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
      next = next.filter((item) => (item.page_name || item.title || '') === advertiserFilter);
    }

    if (ctaFilter !== 'all') {
      next = next.filter((item) => (item.call_to_action_types || []).includes(ctaFilter));
    }

    if (platformFilter !== 'all') {
      next = next.filter((item) => (item.publisher_platforms || []).includes(platformFilter));
    }

    if (sortBy === 'newest') {
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
    const names = new Set(
      results.map((item) => (item.page_name || item.title || '').trim()).filter(Boolean)
    );
    if (!names.has(advertiserFilter)) {
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

  const planAdvertiserChips = useMemo(
    () =>
      competitors.map((c) => ({
        key: `${c.page_id || 'nopage'}-${c.name}`,
        competitor: c,
        matchCount: results.filter((item) => adMatchesCompetitorFilter(item, c)).length,
      })),
    [competitors, results]
  );

  const advertiserOptions = useMemo(() => {
    const fromFacets = (facets?.advertisers || [])
      .map((item) => (typeof item === 'string' ? item : item?.name))
      .filter(Boolean);
    if (!competitors.length) return fromFacets;
    const fromPlan = competitors.map((c) => c.name).filter(Boolean);
    return [...new Set([...fromPlan, ...fromFacets])];
  }, [facets, competitors]);
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

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!keyword.trim()) return;
    if (intelligent && (!isAdSource || !hasProAccess)) {
      if (!hasProAccess) {
        navigate('/billing?checkoutPlan=pro');
      }
      return;
    }

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
          });

      setSearchPlan(data?.plan || null);
      setResearchSummary(data?.research_summary || null);
      setFacets(data?.facets || null);
      setResultFilter('all');
      setAdvertiserFilter('all');
      setCtaFilter('all');
      setPlatformFilter('all');
      setSortBy('best_match');
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

      if (isAdSource && normalizedCompetitors.length > 0) {
        setCompetitors(normalizedCompetitors);
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
      if (!isBillingOrQuotaError(err)) {
        console.error(err);
      }
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
    setSortBy('best_match');
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
    setSortBy('best_match');
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

  return (
    <section className="relative space-y-4">
      {isHookGenerator ? (
        <FacebookHookGeneratorPanel hasProAccess={hasProAccess} navigate={navigate} />
      ) : (
        <>
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex w-full flex-wrap items-center gap-2">
          {isAdSource ? (
            <>
              <select
                value={searchMode}
                onChange={(event) => {
                  const nextMode = event.target.value;
                  if ((nextMode === 'research' || nextMode === 'competitor') && !hasProAccess) {
                    navigate('/billing?checkoutPlan=pro');
                    return;
                  }
                  setSearchMode(nextMode);
                  if (nextMode === 'keyword') {
                    setIntelligent(false);
                  }
                }}
                className={`${FB_TOOLBAR_CONTROL} min-w-[9.5rem]`}
                title="Research brief runs AI planning then Apify. Keyword is direct search."
              >
              <option value="research">Research brief</option>
              <option value="competitor">Competitor search</option>
              <option value="keyword">Keyword search</option>
              </select>

              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className={`${FB_TOOLBAR_CONTROL} w-[4.5rem]`}
                aria-label="Result limit"
              >
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value={60}>60</option>
                <option value={100}>100</option>
              </select>

              <div ref={countryRef} className="relative min-w-[10rem] flex-1 max-w-[16rem]">
                <button
                  type="button"
                  onClick={() => setCountryOpen((prev) => !prev)}
                  className={`${FB_TOOLBAR_CONTROL} flex w-full items-center justify-between gap-2`}
                >
                  <span className="truncate">{selectedCountry?.label || 'Country'}</span>
                  <span className="text-[10px] uppercase text-white/45">{country}</span>
                </button>

              {countryOpen ? (
                <div
                  className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-sm border bg-[#0b0b0b] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <input
                    value={countrySearch}
                    onChange={(event) => setCountrySearch(event.target.value)}
                    placeholder="Search country..."
                    className={`${FB_TOOLBAR_CONTROL} w-full`}
                  />
                  <div className="mt-2 max-h-64 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                            item.value === country ? 'bg-[#25d366] text-black' : 'text-white/80 hover:bg-white/5'
                          }`}
                        >
                          <span>{item.label}</span>
                          <span className="text-[10px] font-semibold uppercase">{item.value}</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-2 py-2 text-xs text-white/55">No countries found.</p>
                    )}
                  </div>
                </div>
              ) : null}
              </div>

              <select
                value={adActiveStatus}
                onChange={(event) => setAdActiveStatus(event.target.value)}
                className={`${FB_TOOLBAR_CONTROL} min-w-[5.5rem]`}
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
              <option value={20}>20</option>
              <option value={40}>40</option>
              <option value={60}>60</option>
              <option value={100}>100</option>
            </select>
          )}

          {isAdSource ? (
            <label
              className={`${FB_TOOLBAR_BTN} cursor-pointer gap-2 border border-white/10 bg-[var(--app-panel)] text-xs text-white/80`}
              title="Use AI to plan competitors and queries before loading ads from the Ad Library"
            >
              <input
                type="checkbox"
                checked={intelligent}
                onChange={(event) => {
                  if (event.target.checked && !hasProAccess) {
                    navigate('/billing?checkoutPlan=pro');
                    return;
                  }
                  setIntelligent(event.target.checked);
                }}
                className="h-3.5 w-3.5 accent-[#25d366]"
              />
              Intelligence search
            </label>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className={`${FB_TOOLBAR_BTN} ml-auto min-w-[6.75rem] bg-[#25d366] font-semibold text-black disabled:opacity-60`}
          >
            {activeSource.button}
          </button>
        </div>

        <div className="w-full rounded-sm p-4" style={{ background: 'var(--app-panel)' }}>
          {usesBriefInput ? (
            <textarea
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={
                searchMode === 'competitor'
                  ? 'Describe the niche and competitors you want to uncover…'
                  : 'Describe your market, offer, audience, or angle — we plan competitors then search the Ad Library…'
              }
              className="min-h-[9.5rem] w-full resize-y bg-transparent text-sm leading-relaxed text-white outline-none placeholder:text-white/40"
            />
          ) : (
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={activeSource.placeholder}
              className="h-10 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
          )}
        </div>

        {activeSource.helper ? (
          <p className="text-xs text-white/55">
            <span className="font-semibold text-white/80">{activeSource.label}</span> {activeSource.helper}
          </p>
        ) : null}

        {isAdSource && !hasProAccess ? (
          <div className="rounded-sm border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Pro unlocks research brief, competitor search, and AI-assisted keyword expansion.
            <button
              type="button"
              onClick={() => navigate('/billing?checkoutPlan=pro')}
              className="ml-2 font-semibold text-white underline underline-offset-2"
            >
              Upgrade to Pro
            </button>
          </div>
        ) : null}

      </form>

      {isLoading ? (
        <CubeLoaderOverlay label="Searching the Ad Library…" minHeight="calc(100dvh - 11rem)" />
      ) : (
        <>
      {searchNotice ? (
        <div className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {searchNotice}
        </div>
      ) : null}

      {searchPlan ? (
        <div className="rounded-sm border [border-color:var(--app-border)] bg-[#0d1711] p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#25d366]">
            <SearchSparkIcon />
            Intelligent Search
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/55">Searching for</span>
            <span className="rounded-sm bg-[#25d366] px-2 py-1 text-sm font-semibold text-black">
              {searchPlan.query}
            </span>
            {searchPlan.search_mode ? (
              <span className="rounded-sm border border-white/10 px-2 py-1 text-[11px] text-white/70">
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
                  className="rounded-sm border border-white/10 px-2 py-1 text-xs text-white/72 transition hover:border-[#25d366] hover:text-white"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          {Array.isArray(searchPlan.competitor_keywords) && searchPlan.competitor_keywords.length ? (
            <div className="mt-3 space-y-1">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Competitor Leads</p>
              <div className="flex flex-wrap gap-2">
                {searchPlan.competitor_keywords.slice(0, 5).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setKeyword(item)}
                    className="rounded-sm border border-white/10 px-2 py-1 text-xs text-white/72 transition hover:border-[#25d366] hover:text-white"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {Array.isArray(searchPlan.advertiser_page_urls) && searchPlan.advertiser_page_urls.length ? (
            <div className="mt-3 space-y-1">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Advertiser page targets</p>
              <div className="flex flex-wrap gap-2">
                {searchPlan.advertiser_page_urls.map((item) => (
                  <a
                    key={item}
                    href={item}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm border border-white/10 px-2 py-1 text-xs text-white/72 transition hover:border-[#25d366] hover:text-white"
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          {Array.isArray(searchPlan.task_runs) && searchPlan.task_runs.length ? (
            <div className="mt-3 space-y-1">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Executed search targets</p>
              <div className="flex flex-wrap gap-2">
                {searchPlan.task_runs.map((item) => (
                  <span key={`${item.target_type}-${item.target}`} className="rounded-sm border border-white/10 px-2 py-1 text-xs text-white/72">
                    {item.target}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {searchPlan.rationale ? <p className="mt-3 text-xs text-white/58">{searchPlan.rationale}</p> : null}
        </div>
      ) : null}

      {researchSummary ? (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-sm app-card p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Ads surfaced</p>
            <p className="mt-2 text-2xl font-semibold text-white">{researchSummary.total_ads || 0}</p>
          </div>
          <div className="rounded-sm app-card p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Advertisers</p>
            <p className="mt-2 text-2xl font-semibold text-white">{researchSummary.advertiser_count || 0}</p>
          </div>
          <div className="rounded-sm app-card p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Task runs</p>
            <p className="mt-2 text-2xl font-semibold text-white">{researchSummary.task_count || 0}</p>
          </div>
          <div className="rounded-sm app-card p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Best format mix</p>
            <p className="mt-2 text-sm text-white">
              {facets?.formats?.video || 0} video / {facets?.formats?.image || 0} static
            </p>
            {typeof researchSummary.discarded_low_relevance === 'number' ? (
              <p className="mt-2 text-[11px] text-white/45">
                Filtered out {researchSummary.discarded_low_relevance} low-relevance ads
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isAdSource && competitors.length > 0 && results.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border [border-color:var(--app-border)] app-card px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Advertisers in this result set</p>
              <p className="mt-1 text-sm text-white/85">
                Search: <span className="font-semibold text-white">&ldquo;{seedQuery}&rdquo;</span>
                <span className="text-white/55"> — tap a brand to narrow the grid (no new search).</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleClearAdvertiserFocus}
                className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  !selectedCompetitor
                    ? 'border-[#25d366] bg-[#25d366]/20 text-white'
                    : 'border-white/15 text-white/80 hover:bg-white/10'
                }`}
              >
                All advertisers
              </button>
              <span className="rounded-sm border border-white/10 px-2 py-1 text-xs text-white/60">
                {competitors.length} leads
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {competitors.map((c) => {
              const isCardSelected =
                selectedCompetitor &&
                selectedCompetitor.name === c.name &&
                (selectedCompetitor.page_id || '') === (c.page_id || '');
              return (
              <button
                key={`${c.page_id || 'nopage'}-${c.name}`}
                type="button"
                onClick={() => handleCompetitorSelect(c)}
                className={`flex flex-col items-start rounded-sm border bg-white/[0.02] px-4 py-4 text-left transition hover:bg-white/[0.04] disabled:opacity-50 ${
                  isCardSelected ? 'border-[#25d366] shadow-[0_0_0_1px_rgba(37,211,102,0.35)]' : 'border-white/10 hover:border-[#25d366]'
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1877f2]/25 text-sm font-bold text-[#8ab4ff]">
                  {String(c.name).slice(0, 1).toUpperCase()}
                </span>
                <span className="mt-3 line-clamp-2 text-sm font-semibold text-white">{c.name}</span>
                {c.from_plan ? (
                  <span className="mt-1 text-xs text-emerald-200/85">From intelligent search plan</span>
                ) : (
                  <span className="mt-1 text-xs text-white/50">
                    ~{c.count} ad{c.count === 1 ? '' : 's'} in discovery set
                  </span>
                )}
                {c.page_id ? (
                  <span className="mt-2 font-mono text-[10px] text-white/35">Page {c.page_id}</span>
                ) : null}
              </button>
            );
            })}
          </div>
        </div>
      ) : null}

      {results.length ? (
        <div className="space-y-3">
          {isAdSource && seedQuery && selectedCompetitor ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[#25d366]/25 bg-[#25d366]/10 px-3 py-2 text-sm text-white/85">
              <p>
                Showing ads for <span className="font-semibold text-white">{selectedCompetitor.name}</span>
                <span className="text-white/50"> · searched from </span>
                <span className="text-white/70">&ldquo;{seedQuery}&rdquo;</span>
              </p>
              <button
                type="button"
                onClick={handleClearAdvertiserFocus}
                className="shrink-0 rounded-sm border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                Show all advertisers
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveCollection}
              className="rounded-sm bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white"
            >
              Save Results
            </button>
            <select
              value={resultFilter}
              onChange={(event) => setResultFilter(event.target.value)}
              className="rounded-sm app-input px-3 py-2 text-sm"
            >
              <option value="all">All ads</option>
              <option value="video">Video ads</option>
              <option value="image">Static ads</option>
              <option value="facebook">Facebook only</option>
              <option value="instagram">Instagram only</option>
            </select>
            <select
              value={advertiserFilter}
              onChange={(event) => {
                setAdvertiserFilter(event.target.value);
                setSelectedCompetitor(null);
              }}
              className="rounded-sm app-input px-3 py-2 text-sm"
            >
              <option value="all">All advertisers</option>
              {advertiserOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select
              value={ctaFilter}
              onChange={(event) => setCtaFilter(event.target.value)}
              className="rounded-sm app-input px-3 py-2 text-sm"
            >
              <option value="all">All CTAs</option>
              {ctaOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value)}
              className="rounded-sm app-input px-3 py-2 text-sm"
            >
              <option value="all">All platforms</option>
              {platformOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-sm app-input px-3 py-2 text-sm"
            >
              <option value="best_match">Best match</option>
              <option value="newest">Newest first</option>
              <option value="video_first">Video first</option>
              <option value="advertiser">Advertiser A-Z</option>
            </select>
            <p className="text-xs text-white/60">
              {filteredResults.length} shown
              {results.length > 0 && filteredResults.length < results.length ? (
                <span className="text-white/40"> ({results.length} total)</span>
              ) : null}
            </p>
            {saveStatus ? <p className="text-xs text-white/70">{saveStatus}</p> : null}
          </div>

          {competitors.length > 0 || facets?.advertisers?.length ? (
            <div className="rounded-sm app-card p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                {competitors.length > 0
                  ? 'Competitors from your search (tap to filter)'
                  : 'Top advertisers in this research set'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {competitors.length > 0
                  ? planAdvertiserChips.map(({ key, competitor, matchCount }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSelectedCompetitor(competitor);
                          setAdvertiserFilter('all');
                        }}
                        className="rounded-sm border border-white/10 px-2 py-1 text-xs text-white/72 transition hover:border-[#25d366] hover:text-white"
                      >
                        {competitor.name}
                        {matchCount > 0 ? ` (${matchCount})` : ' (0 in this set)'}
                      </button>
                    ))
                  : (facets?.advertisers || []).slice(0, 8).map((item) => (
                      <button
                        key={`${item.page_id || ''}-${item.name}`}
                        type="button"
                        onClick={() => {
                          setSelectedCompetitor({
                            name: item.name,
                            page_id: String(item.page_id || ''),
                            page_url: '',
                            from_plan: false,
                          });
                          setAdvertiserFilter('all');
                        }}
                        className="rounded-sm border border-white/10 px-2 py-1 text-xs text-white/72 transition hover:border-[#25d366] hover:text-white"
                      >
                        {item.name} ({item.count})
                      </button>
                    ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {results.length > 0 && filteredResults.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p>
            Filters are hiding all {results.length} result{results.length === 1 ? '' : 's'}. Clear filters or widen format/platform choices.
          </p>
          <button
            type="button"
            onClick={() => {
              setResultFilter('all');
              setAdvertiserFilter('all');
              setCtaFilter('all');
              setPlatformFilter('all');
              setSortBy('best_match');
              setSelectedCompetitor(null);
            }}
            className="shrink-0 rounded-sm bg-[#25d366] px-3 py-2 text-xs font-semibold text-black"
          >
            Reset filters
          </button>
        </div>
      ) : null}

      {!results.length && !isLoading && (
        <div className="grid min-h-[52vh] place-items-center">
          <div className="flex max-w-sm flex-col items-center text-center">
            <EmptyFacebookIcon />
            <p className="mt-8 text-3xl font-semibold text-white">Search to get started</p>
            <p className="mt-2 text-sm text-white/55">{activeSource.empty}</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredResults.map((item) => (
          <FacebookResultCard key={item.id} item={item} />
        ))}
      </div>
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

/** Poster + video from API fields or Curious Coder `raw.snapshot` (Apify). */
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
    v0.video_preview_image_url,
    snap.page_profile_picture_url,
    assetImage,
    snapImageUrl
  );

  const videoUrl = pickHttpsMediaUrl(item?.video_url, v0.video_hd_url, v0.video_sd_url, assetVideo);

  const snapshotUrl = pickHttpsMediaUrl(item?.ad_snapshot_url, raw.ad_library_url);

  const isVideo =
    Boolean(videoUrl) ||
    String(snap.display_format || item?.display_format || '').toUpperCase() === 'VIDEO';

  return { posterUrl, videoUrl, snapshotUrl, isVideo };
}

function FacebookAdResultCard({ item }) {
  const media = useMemo(() => resolveFacebookAdCreativeMedia(item), [item]);
  const [posterFailed, setPosterFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [playVideo, setPlayVideo] = useState(false);

  useEffect(() => {
    setPosterFailed(false);
    setVideoFailed(false);
    setPlayVideo(false);
  }, [item.id, media.posterUrl, media.videoUrl]);

  const showPoster = Boolean(media.posterUrl) && !posterFailed;
  const showVideoPlayer =
    Boolean(media.videoUrl) && !videoFailed && (playVideo || (!showPoster && media.videoUrl));
  const showPlayOverlay = showPoster && Boolean(media.videoUrl) && !playVideo;

  return (
    <article className="rounded-sm app-card p-4">
      <div className="relative h-48 w-full overflow-hidden rounded-sm bg-black/40">
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
            referrerPolicy="no-referrer"
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
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
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
            <p className="text-xs text-white/60">
              {posterFailed || videoFailed
                ? 'Preview blocked by Facebook CDN. Open the Ad Library page for this creative.'
                : 'No preview image in this row.'}
            </p>
            {media.snapshotUrl ? (
              <a
                href={media.snapshotUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-sm border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                Open Ad Library
              </a>
            ) : null}
          </div>
        )}
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-semibold">{item.page_name || item.title || 'Unknown Page'}</h3>
      <p className="mt-1 text-xs app-muted">{item.page_id ? `Page ID: ${item.page_id}` : item.subtitle || 'N/A'}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(item.publisher_platforms || []).length ? item.publisher_platforms.map((platform) => (
          <span key={platform} className="rounded-sm border border-white/10 px-2 py-1 text-[11px] text-white/65">
            {platform}
          </span>
        )) : <span className="text-xs app-muted">Platforms unavailable</span>}
        {media.videoUrl || media.isVideo ? (
          <span className="rounded-sm bg-emerald-400/15 px-2 py-1 text-[11px] text-emerald-300">Video</span>
        ) : null}
        {media.posterUrl && !media.videoUrl ? (
          <span className="rounded-sm bg-sky-400/15 px-2 py-1 text-[11px] text-sky-300">Static</span>
        ) : null}
      </div>
      <p className="mt-2 text-xs app-muted">Created: {item.ad_creation_time || 'N/A'}</p>
      {item.search_target ? (
        <p className="mt-1 text-[11px] text-white/45">Search target: {item.search_target}</p>
      ) : null}
      {typeof item.relevance_score === 'number' ? (
        <p className="mt-1 text-[11px] text-white/45">Relevance: {item.relevance_score.toFixed(2)}</p>
      ) : null}
      {item.matched_terms?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.matched_terms.slice(0, 3).map((term) => (
            <span key={term} className="rounded-sm border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-200">
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
        <p className="mt-2 text-xs text-white/72">CTA: {item.call_to_action_types[0]}</p>
      )}

      {(item.age_from || item.age_until || item.gender || item.delivery_country) ? (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/55">
          {item.age_from || item.age_until ? <span>Age: {item.age_from || '?'}-{item.age_until || '?'}</span> : null}
          {item.gender ? <span>Gender: {item.gender}</span> : null}
          {item.delivery_country ? <span>Country: {item.delivery_country}</span> : null}
        </div>
      ) : null}
      {item.query_params ? (
        <p className="mt-2 line-clamp-2 text-[11px] text-white/40">Query params: {item.query_params}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {media.snapshotUrl ? (
          <a
            href={media.snapshotUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm border [border-color:var(--app-border)] px-2.5 py-1 text-xs font-semibold app-muted"
          >
            Open Ad Library
          </a>
        ) : null}
        {item.page_url ? (
          <a
            href={item.page_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm border [border-color:var(--app-border)] px-2.5 py-1 text-xs font-semibold app-muted"
          >
            Open Page
          </a>
        ) : null}
      </div>
    </article>
  );
}

function FacebookResultCard({ item }) {
  if (item.kind === 'group') {
    return (
      <article className="rounded-sm app-card p-4">
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="h-40 w-full rounded-sm object-cover" />
        ) : null}
        <h3 className="mt-3 line-clamp-2 text-sm font-semibold">{item.title}</h3>
        {item.subtitle ? <p className="mt-1 text-xs app-muted">{item.subtitle}</p> : null}
        {item.description ? <p className="mt-3 line-clamp-4 text-sm">{item.description}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs app-muted">
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
              className="rounded-sm border [border-color:var(--app-border)] px-2.5 py-1 text-xs font-semibold app-muted"
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
      <article className="rounded-sm app-card p-4">
        <div className="flex items-center gap-3">
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-white/10" />
          )}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{item.title}</h3>
            {item.subtitle ? <p className="mt-1 text-xs app-muted">{item.subtitle}</p> : null}
            {item.follow_type ? <p className="mt-1 text-xs app-muted">Type: {item.follow_type}</p> : null}
          </div>
        </div>
        {item.external_url ? (
          <div className="mt-3">
            <a
              href={item.external_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm border [border-color:var(--app-border)] px-2.5 py-1 text-xs font-semibold app-muted"
            >
              Open Profile
            </a>
          </div>
        ) : null}
      </article>
    );
  }

  return <FacebookAdResultCard item={item} />;
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
