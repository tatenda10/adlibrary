import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import CubeLoader, { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { THEMES, applyTheme, getTheme } from '../lib/theme.js';
import { useApiToast } from '../hooks/useApiToast.js';
import { getBrandProfile, previewOnboardingProfile, saveOnboardingProfile } from '../lib/api.js';

function Settings() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getToken } = useAuth();
  const { notifyApiError, showError } = useApiToast();
  const [profile, setProfile] = useState({
    brandName: '',
    websiteUrl: '',
    industry: '',
    country: '',
    niche: '',
    story: '',
    idealCustomers: '',
    suggestedChannelsText: '',
  });
  const [draftProfile, setDraftProfile] = useState({
    brandName: '',
    websiteUrl: '',
    industry: '',
    country: '',
    niche: '',
    story: '',
    idealCustomers: '',
    suggestedChannelsText: '',
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saved, setSaved] = useState(false);
  const [theme, setTheme] = useState(getTheme() || THEMES.DARK);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProfile, setPreviewProfile] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countryOpen, setCountryOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const onboardingMode = searchParams.get('onboarding') === '1';
  const shouldRedirect =
    location.pathname === '/settings' ||
    location.pathname.includes('/settings/security') ||
    location.pathname.includes('/settings/integrations');
  const filteredCountries = useMemo(() => {
    const q = String(draftProfile.country || '').trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((name) => name.toLowerCase().includes(q));
  }, [countries, draftProfile.country]);

  const update = (field, value) => {
    setDraftProfile((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const save = async () => {
    try {
      setSavingProfile(true);
      const token = await getToken();
      if (!token) {
        showError('Authentication error. Please refresh and try again.');
        setSavingProfile(false);
        return;
      }

      const payload = {
        brandName: profile.brandName,
        websiteUrl: draftProfile.websiteUrl,
        industry: draftProfile.industry,
        targetAudience: draftProfile.idealCustomers,
        goals: [],
        channels: [],
        preferences: {
          country: draftProfile.country,
          niche: draftProfile.niche,
          idealCustomers: draftProfile.idealCustomers,
          suggestedChannelsText: draftProfile.suggestedChannelsText,
        },
        story: draftProfile.story,
      };

      await saveOnboardingProfile(token, payload);
      setProfile(draftProfile);
      setIsEditing(false);
      setSaved(true);
    } catch (e) {
      notifyApiError(e, 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const token = await getToken();
        if (!token) {
          setLoadingProfile(false);
          return;
        }
        const data = await getBrandProfile(token);
        if (cancelled || !data) {
          setLoadingProfile(false);
          return;
        }

        const nextProfile = {
          brandName: data.brand_name || '',
          websiteUrl: data.website_url || '',
          industry: data.industry || '',
          country: data.preferences?.country || '',
          niche: data.preferences?.niche || '',
          story: data.story || '',
          idealCustomers: data.preferences?.idealCustomers || data.target_audience || '',
          suggestedChannelsText: data.preferences?.suggestedChannelsText || '',
        };
        setProfile(nextProfile);
        setDraftProfile(nextProfile);
      } catch (e) {
        notifyApiError(e, 'Failed to load brand profile');
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [getToken, notifyApiError]);

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
    if (!onboardingMode) return;
    try {
      const pendingWebsite = localStorage.getItem('pending_website_url') || '';
      if (pendingWebsite && !draftProfile.websiteUrl) {
        setDraftProfile((prev) => ({ ...prev, websiteUrl: pendingWebsite }));
      }
    } catch {
      // Ignore storage read issues.
    }
  }, [draftProfile.websiteUrl, onboardingMode]);

  const toggleTheme = () => {
    const next = theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyTheme(next);
    setTheme(next);
  };

  const runOnboardingPreview = async () => {
    try {
      setPreviewLoading(true);
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication error. Please refresh and try again.');
      }

      const payload = {
        brandName: draftProfile.brandName,
        websiteUrl: draftProfile.websiteUrl,
        industry: draftProfile.industry || draftProfile.niche,
        niche: draftProfile.niche,
        goals: draftProfile.idealCustomers ? [draftProfile.idealCustomers] : [],
      };

      const data = await previewOnboardingProfile(token, payload);
      setPreviewProfile(data?.profile || null);

      try {
        localStorage.removeItem('pending_website_url');
        localStorage.removeItem('pending_app_flow');
      } catch {
        // Ignore storage cleanup issues.
      }
    } catch (e) {
      notifyApiError(e, 'Failed to generate onboarding preview');
      setPreviewProfile(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (shouldRedirect) {
    return <Navigate to="/settings/profile" replace />;
  }

  return (
    <section className="space-y-4">
      {location.pathname.includes('/settings/profile') && (
        <article className="space-y-4">
          {onboardingMode && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">New account flow</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Onboard your brand, then rate the website</h3>
              <p className="mt-2 text-sm text-slate-300">
                Fill in your brand details first. Then we generate an initial website analysis preview. If you want the
                deeper conversion explanation after that, we route you into the paid workflow.
              </p>
            </div>
          )}

          {loadingProfile ? (
            <CubeLoaderOverlay label="Loading brand profile…" minHeight="40vh" />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-white">Profile</h3>
                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftProfile(profile);
                          setIsEditing(false);
                          setCountryOpen(false);
                        }}
                        className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={save}
                        disabled={savingProfile}
                        className="rounded-md bg-[#25d366] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                      >
                        {savingProfile ? 'Saving...' : onboardingMode ? 'Save Onboarding' : 'Save Profile'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftProfile(profile);
                        setIsEditing(true);
                        setSaved(false);
                      }}
                      className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Edit
                    </button>
                  )}
                  {saved && <span className="text-xs text-emerald-500">Saved</span>}
                </div>
              </div>

              <div className="grid gap-3">
                <section className="app-card rounded-sm p-4">
                  {isEditing ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Brand name">
                        <input
                          value={draftProfile.brandName}
                          onChange={(e) => update('brandName', e.target.value)}
                          className="w-full rounded-sm bg-transparent px-0 py-2 text-sm outline-none"
                          placeholder="Brand name"
                        />
                      </Field>
                      <Field label="Website">
                        <input
                          value={draftProfile.websiteUrl}
                          onChange={(e) => update('websiteUrl', e.target.value)}
                          className="w-full rounded-sm bg-transparent px-0 py-2 text-sm outline-none"
                          placeholder="https://yourwebsite.com"
                        />
                      </Field>
                      <Field label="Industry">
                        <input
                          value={draftProfile.industry}
                          onChange={(e) => update('industry', e.target.value)}
                          className="w-full rounded-sm bg-transparent px-0 py-2 text-sm outline-none"
                          placeholder="Industry"
                        />
                      </Field>
                      <Field label="Niche">
                        <input
                          value={draftProfile.niche}
                          onChange={(e) => update('niche', e.target.value)}
                          className="w-full rounded-sm bg-transparent px-0 py-2 text-sm outline-none"
                          placeholder="Niche"
                        />
                      </Field>
                      <Field label="Country">
                        <div className="relative">
                          <input
                            value={draftProfile.country}
                            onChange={(e) => update('country', e.target.value)}
                            onFocus={() => setCountryOpen(true)}
                            onBlur={() => {
                              window.setTimeout(() => setCountryOpen(false), 120);
                            }}
                            autoComplete="country-name"
                            className="w-full rounded-sm bg-transparent px-0 py-2 text-sm outline-none"
                            placeholder="Select country"
                          />
                          {countryOpen ? (
                            <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-sm border border-white/10 bg-[#0d0d0d] p-1 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
                              {countriesLoading ? (
                                <div className="flex justify-center py-4">
                                  <CubeLoader size={56} />
                                </div>
                              ) : filteredCountries.length ? (
                                filteredCountries.map((country) => (
                                  <button
                                    key={country}
                                    type="button"
                                    onMouseDown={() => {
                                      update('country', country);
                                      setCountryOpen(false);
                                    }}
                                    className="block w-full rounded-sm px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
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
                      </Field>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <DisplayField label="Brand name" value={profile.brandName} />
                      <DisplayField label="Website" value={profile.websiteUrl} />
                      <DisplayField label="Industry" value={profile.industry} />
                      <DisplayField label="Niche" value={profile.niche} />
                      <DisplayField label="Country" value={profile.country} />
                    </div>
                  )}
                </section>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {isEditing ? (
                  <CompactTextarea
                    label="Brand story & positioning"
                    value={draftProfile.story}
                    onChange={(e) => update('story', e.target.value)}
                    rows={5}
                    placeholder="Write a short narrative about what you sell, why it matters, and how you position the brand."
                  />
                ) : (
                  <DisplayCard label="Brand story & positioning" value={profile.story} />
                )}
                <div className="grid gap-3">
                  {isEditing ? (
                    <>
                      <CompactTextarea
                        label="Ideal customers"
                        value={draftProfile.idealCustomers}
                        onChange={(e) => update('idealCustomers', e.target.value)}
                        rows={4}
                        placeholder="Who is this really for? Include age ranges, motivations, and key problems."
                      />
                      <CompactTextarea
                        label="Suggested platforms"
                        value={draftProfile.suggestedChannelsText}
                        onChange={(e) => update('suggestedChannelsText', e.target.value)}
                        rows={3}
                        placeholder="e.g. TikTok, Instagram Reels, YouTube Shorts, Meta feed ads."
                      />
                    </>
                  ) : (
                    <>
                      <DisplayCard label="Ideal customers" value={profile.idealCustomers} />
                      <DisplayCard label="Suggested platforms" value={profile.suggestedChannelsText} />
                    </>
                  )}
                </div>
              </div>

              <div className="mt-1 flex items-center gap-3">
                {onboardingMode && (
                  <button
                    onClick={runOnboardingPreview}
                    disabled={previewLoading || !profile.websiteUrl.trim()}
                    className="rounded-md border px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    {previewLoading ? 'Analyzing Website...' : 'Rate My Website'}
                  </button>
                )}
              </div>
              {previewLoading ? <CubeLoaderOverlay label="Analyzing website…" fullscreen /> : null}

              {previewProfile && onboardingMode && (
                <section
                  className="rounded-lg border p-4"
                  style={{ borderColor: 'var(--app-border)', background: 'var(--app-panel)' }}
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] app-muted">Initial Website Analysis</p>
                  <h4 className="mt-2 text-lg font-semibold text-white">Here is the first layer of what we see</h4>
                  <p className="mt-2 text-sm app-muted">
                    {previewProfile.tone_summary || 'We generated a brand and positioning read from your site.'}
                  </p>

                  {(previewProfile.value_props || []).length ? (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-white">Value props</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {previewProfile.value_props.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border px-2.5 py-1 text-xs text-white"
                            style={{ borderColor: 'var(--app-border)' }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {(previewProfile.content_pillars || []).length ? (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-white">Content pillars</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {previewProfile.content_pillars.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border px-2.5 py-1 text-xs text-white"
                            style={{ borderColor: 'var(--app-border)' }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 rounded-md border border-amber-500/25 bg-amber-500/10 p-4">
                    <p className="text-sm font-semibold text-white">Want the deeper conversion explanation?</p>
                    <p className="mt-2 text-xs text-amber-100">
                      Unlock the full website conversion breakdown, stronger CRO recommendations, and premium AI workflows on Pro.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/billing?checkoutPlan=pro')}
                      className="mt-3 rounded-md bg-[#25d366] px-4 py-2 text-sm font-semibold text-black"
                    >
                      Unlock Deeper Analysis
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </article>
      )}

      {location.pathname.includes('/settings/preferences') && (
        <article className="space-y-3">
          <section className="app-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">Theme</h3>
                <p className="mt-1 text-xs app-muted">Toggle between black and white theme for the dashboard.</p>
              </div>
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    theme === THEMES.DARK ? 'bg-emerald-400' : 'bg-slate-500'
                  }`}
                />
                {theme === THEMES.DARK ? 'Black' : 'White'}
              </button>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <PreferenceCard title="Default Region" value="United States" />
            <PreferenceCard title="Analysis Style" value="Concise actionable summaries" />
            <PreferenceCard title="Feed Density" value="Comfortable" />
            <PreferenceCard title="Notifications" value="Muted for now" />
          </div>
        </article>
      )}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block rounded-sm bg-[#141414] px-3 py-3">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] app-muted">{label}</span>
      {children}
    </label>
  );
}

function DisplayField({ label, value }) {
  return (
    <div className="rounded-sm bg-[#141414] px-3 py-3">
      <p className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] app-muted">{label}</p>
      <p className="text-sm text-white">{value || 'Not set'}</p>
    </div>
  );
}

function CompactTextarea({ label, value, onChange, rows, placeholder }) {
  return (
    <section className="app-card rounded-sm p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] app-muted">{label}</p>
      <textarea
        value={value}
        onChange={onChange}
        className="mt-3 w-full rounded-sm bg-[#141414] px-3 py-2 text-sm leading-relaxed outline-none resize-none"
        rows={rows}
        placeholder={placeholder}
      />
    </section>
  );
}

function DisplayCard({ label, value }) {
  return (
    <section className="app-card rounded-sm p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] app-muted">{label}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white">{value || 'Not set'}</p>
    </section>
  );
}

function PreferenceCard({ title, value }) {
  return (
    <section className="rounded-sm app-panel-soft p-3">
      <p className="text-xs uppercase tracking-[0.14em] app-muted">{title}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </section>
  );
}

export default Settings;
