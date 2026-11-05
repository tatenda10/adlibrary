import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { THEMES, applyTheme, getTheme } from '../lib/theme.js';
import { enrichBrandProfile, getBrandProfile, saveOnboardingProfile } from '../lib/api.js';
import { useApiToast } from '../hooks/useApiToast.js';

const emptyProfile = {
  brandName: '',
  websiteUrl: '',
  industry: '',
  country: '',
  niche: '',
  story: '',
  idealCustomers: '',
  suggestedChannelsText: '',
  competitors: [],
  customerSegments: [],
  valueProps: [],
  contentPillars: [],
  toneSummary: '',
  brandSettings: {
    allowAiTools: true,
    requireAiRefresh: true,
    allowCollaboratorEditing: false,
    autoCopyToBriefs: true,
  },
};

function normalizeProfile(data = {}) {
  const preferences = data.preferences || {};
  const brandSettings = preferences.brandSettings || {};
  return {
    brandName: data.brand_name || '',
    websiteUrl: data.website_url || '',
    industry: data.industry || '',
    country: preferences.country || '',
    niche: preferences.niche || '',
    story: data.story || '',
    idealCustomers: preferences.idealCustomers || data.target_audience || '',
    suggestedChannelsText: preferences.suggestedChannelsText || arrayToText(data.channels),
    competitors: Array.isArray(preferences.competitors) ? preferences.competitors : [],
    customerSegments: Array.isArray(preferences.customerSegments) ? preferences.customerSegments : [],
    valueProps: Array.isArray(data.value_props) ? data.value_props : [],
    contentPillars: Array.isArray(data.content_pillars) ? data.content_pillars : [],
    toneSummary: data.tone?.summary || '',
    brandSettings: {
      allowAiTools: brandSettings.allowAiTools !== false,
      requireAiRefresh: brandSettings.requireAiRefresh !== false,
      allowCollaboratorEditing: Boolean(brandSettings.allowCollaboratorEditing),
      autoCopyToBriefs: brandSettings.autoCopyToBriefs !== false,
    },
  };
}

function arrayToText(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : '';
}

function Brand() {
  const { getToken } = useAuth();
  const { notifyApiError, showError, showSuccess } = useApiToast();
  const [profile, setProfile] = useState(emptyProfile);
  const [draftProfile, setDraftProfile] = useState(emptyProfile);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [enrichingProfile, setEnrichingProfile] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [theme, setTheme] = useState(getTheme() || THEMES.DARK);

  const loadProfile = async () => {
    const token = await getToken();
    if (!token) return;
    const data = await getBrandProfile(token);
    const nextProfile = normalizeProfile(data);
    setProfile(nextProfile);
    setDraftProfile(nextProfile);
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const data = await getBrandProfile(token);
        if (cancelled) return;
        const nextProfile = normalizeProfile(data);
        setProfile(nextProfile);
        setDraftProfile(nextProfile);
      } catch (error) {
        notifyApiError(error, 'Failed to load brand profile');
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [getToken, notifyApiError]);

  const update = (field, value) => {
    setDraftProfile((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const updateBrandSetting = (field, value) => {
    setDraftProfile((prev) => ({
      ...prev,
      brandSettings: {
        ...prev.brandSettings,
        [field]: value,
      },
    }));
    setSaved(false);
  };

  const save = async () => {
    try {
      setSavingProfile(true);
      const token = await getToken();
      if (!token) {
        showError('Authentication error. Please refresh and try again.');
        return;
      }

      const competitors = textToLines(draftProfile.competitors);
      const customerSegments = Array.isArray(draftProfile.customerSegments) ? draftProfile.customerSegments : profile.customerSegments;

      await saveOnboardingProfile(token, {
        brandName: draftProfile.brandName,
        websiteUrl: draftProfile.websiteUrl,
        industry: draftProfile.industry,
        targetAudience: draftProfile.idealCustomers,
        goals: [],
        channels: textToLines(draftProfile.suggestedChannelsText),
        preferences: {
          country: draftProfile.country,
          niche: draftProfile.niche,
          idealCustomers: draftProfile.idealCustomers,
          suggestedChannelsText: draftProfile.suggestedChannelsText,
          competitors,
          customerSegments,
          brandSettings: draftProfile.brandSettings,
        },
        story: draftProfile.story,
        content_pillars: textToLines(draftProfile.contentPillars),
        value_props: draftProfile.valueProps,
      });

      await loadProfile();
      setIsEditing(false);
      setSaved(true);
    } catch (error) {
      notifyApiError(error, 'Failed to save brand profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const refreshFromWebsite = async () => {
    try {
      setEnrichingProfile(true);
      const token = await getToken();
      if (!token) {
        showError('Authentication error. Please refresh and try again.');
        return;
      }
      const data = await enrichBrandProfile(token, { websiteUrl: profile.websiteUrl });
      const nextProfile = normalizeProfile(data);
      setProfile(nextProfile);
      setDraftProfile(nextProfile);
      showSuccess('Brand profile enriched and saved.');
    } catch (error) {
      notifyApiError(error, 'Failed to enrich brand profile');
    } finally {
      setEnrichingProfile(false);
    }
  };

  const toggleTheme = () => {
    const next = theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyTheme(next);
    setTheme(next);
  };

  const brandName = profile.brandName || 'Brand';
  const website = profile.websiteUrl || 'https://yourbrand.com';
  const angles = profile.contentPillars;
  const customerSegments = profile.customerSegments.length ? profile.customerSegments : [];

  return (
    <section className="min-h-full bg-white text-slate-950">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        <header className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-10 w-12 place-items-center rounded-md border border-slate-200 bg-slate-50 text-lg font-black text-emerald-600">
                {brandName.slice(0, 1).toLowerCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-[-0.04em]">{brandName}</h1>
                  <button type="button" onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-emerald-600">
                    Edit
                  </button>
                </div>
                <p className="mt-1 text-sm text-slate-500">{website.replace(/^https?:\/\//, '')} · {profile.country || 'country not set'}</p>
              </div>
            </div>
          </div>
        </header>

        {loadingProfile ? (
          <section className="rounded-md border border-slate-200 bg-white p-12">
            <CubeLoaderOverlay label="Loading brand profile..." minHeight="32vh" />
          </section>
        ) : (
          <>
            <section className="rounded-md border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <h2 className="text-lg font-semibold">Brand Settings</h2>
                  <p className="mt-1 text-sm text-slate-500">Backend profile used by content generation, research, and planning tools.</p>
                </div>
                <div className="flex items-center gap-3">
                  {saved ? <span className="text-xs font-medium text-emerald-600">Saved</span> : null}
                  <button
                    type="button"
                    onClick={refreshFromWebsite}
                    disabled={enrichingProfile}
                    className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-normal text-slate-600 disabled:opacity-60"
                  >
                    {enrichingProfile ? 'Refreshing...' : 'AI refresh from website'}
                  </button>
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftProfile(profile);
                          setIsEditing(false);
                        }}
                        className="rounded-md border border-slate-200 px-4 py-2 text-sm font-normal text-slate-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={save}
                        disabled={savingProfile}
                        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {savingProfile ? 'Saving...' : 'Save Brand'}
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
                      className="rounded-md border border-slate-200 px-4 py-2 text-sm font-normal text-slate-600"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div>
                <SettingsRow label="Name" help="Changes will update your saved brand profile.">
                  {isEditing ? (
                    <TextInput value={draftProfile.brandName} onChange={(value) => update('brandName', value)} placeholder="Brand name" />
                  ) : (
                    <ReadOnlyInput value={profile.brandName || 'Not set'} />
                  )}
                  {isEditing ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_0.7fr]">
                      <TextInput value={draftProfile.websiteUrl} onChange={(value) => update('websiteUrl', value)} placeholder="https://yourwebsite.com" />
                      <TextInput value={draftProfile.country} onChange={(value) => update('country', value)} placeholder="Country" />
                    </div>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_0.7fr]">
                      <ReadOnlyInput value={profile.websiteUrl || 'Not set'} />
                      <ReadOnlyInput value={profile.country || 'Not set'} />
                    </div>
                  )}
                </SettingsRow>

                <SettingsRow label="Category" help="Used by AI to understand your market.">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {isEditing ? (
                      <>
                        <TextInput value={draftProfile.industry} onChange={(value) => update('industry', value)} placeholder="Industry" />
                        <TextInput value={draftProfile.niche} onChange={(value) => update('niche', value)} placeholder="Niche" />
                      </>
                    ) : (
                      <>
                        <ReadOnlyInput value={profile.industry || 'Not set'} />
                        <ReadOnlyInput value={profile.niche || 'Not set'} />
                      </>
                    )}
                  </div>
                </SettingsRow>

                <SettingsRow label="Tagline" help="A quick snapshot of your brand.">
                  {isEditing ? (
                    <textarea
                      value={draftProfile.story}
                      onChange={(event) => update('story', event.target.value)}
                      rows={3}
                      placeholder="Write a short brand summary..."
                      className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-emerald-300"
                    />
                  ) : (
                    <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                      {profile.story || 'Not set'}
                    </p>
                  )}
                </SettingsRow>

                <SettingsRow label="Advanced settings" help="Saved to brand profile">
                  <div className="space-y-3">
                    <SettingsCheck
                      checked={draftProfile.brandSettings.allowAiTools}
                      onChange={(value) => updateBrandSetting('allowAiTools', value)}
                      label="Allow AI tools to use this brand profile"
                      help="Generation, planning, and research tools can use this profile as context."
                    />
                    <SettingsCheck
                      checked={draftProfile.brandSettings.requireAiRefresh}
                      onChange={(value) => updateBrandSetting('requireAiRefresh', value)}
                      label="Require AI refresh before content generation"
                      help="Keeps niche, customers, competitors, and platform suggestions up to date."
                    />
                    <SettingsCheck
                      checked={draftProfile.brandSettings.allowCollaboratorEditing}
                      onChange={(value) => updateBrandSetting('allowCollaboratorEditing', value)}
                      label="Allow workspace collaborators to edit brand profile"
                      help="Team editing can be enabled later when roles are added."
                    />
                    <SettingsCheck
                      checked={draftProfile.brandSettings.autoCopyToBriefs}
                      onChange={(value) => updateBrandSetting('autoCopyToBriefs', value)}
                      label="Automatically copy brand data into content briefs"
                      help="Brand data is added to new content and ad generation requests."
                    />
                  </div>
                </SettingsRow>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <EditableTextCard
                title="Brand Story & Positioning"
                value={isEditing ? draftProfile.story : profile.story}
                editing={isEditing}
                onChange={(value) => update('story', value)}
                placeholder="Write a short narrative about what you sell, why it matters, and how you position the brand."
              />
              <div className="grid gap-4">
                <EditableTextCard
                  title="Ideal Customers"
                  value={isEditing ? draftProfile.idealCustomers : profile.idealCustomers}
                  editing={isEditing}
                  onChange={(value) => update('idealCustomers', value)}
                  placeholder="Who is this really for? Include motivations and key problems."
                />
                <EditableTextCard
                  title="Suggested Platforms"
                  value={isEditing ? draftProfile.suggestedChannelsText : profile.suggestedChannelsText}
                  editing={isEditing}
                  onChange={(value) => update('suggestedChannelsText', value)}
                  placeholder="TikTok, Instagram Reels, YouTube Shorts, Meta feed ads..."
                />
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Content Angles</h2>
                <button type="button" onClick={() => setIsEditing(true)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-normal text-slate-600">Edit</button>
              </div>
              {isEditing ? (
                <textarea
                  value={draftProfile.contentPillars.join('\n')}
                  onChange={(event) => update('contentPillars', textToLines(event.target.value))}
                  rows={6}
                  placeholder="One content angle per line"
                  className="mt-4 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-emerald-300"
                />
              ) : angles.length ? (
                <div className="mt-4 space-y-4">
                  {angles.map((angle) => (
                    <p key={angle} className="text-sm font-normal text-slate-900">{angle}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No content angles saved yet. Click AI refresh from website to generate and save them.</p>
              )}
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-black">Tone & Voice</h2>
              <p className="mt-2 text-slate-500">{profile.toneSummary || 'Define rules for how your content copy should sound.'}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <ToneInput label="Do's" placeholder="e.g., Use casual, conversational tone" />
                <ToneInput label="Don'ts" placeholder="e.g., Never use corporate jargon" danger />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <BrandInfoCard title="Identity & Product">
                <InfoBlock label="Core Identity" text={profile.story || `${brandName} is a brand profile used for content generation and research.`} />
                <InfoBlock label="Product Offering" text={profile.valueProps.length ? profile.valueProps.join(' ') : 'AI-enriched product offering will appear here after refreshing from the website.'} />
                <InfoBlock label="Unique Benefits" text={profile.contentPillars.length ? profile.contentPillars.join(' • ') : 'Content pillars will appear here after AI enrichment.'} />
              </BrandInfoCard>

              <BrandInfoCard title="Purpose & Positioning">
                <InfoBlock label="Mission" text={profile.story || 'AI-enriched mission and positioning will appear here.'} />
                <InfoBlock label="Differentiation" text={profile.valueProps.length ? profile.valueProps.join(' ') : 'AI-enriched differentiation will appear here.'} />
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  Owned space will be generated and saved from your website and brand profile.
                </div>
              </BrandInfoCard>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Market & Competition</h2>
                <button type="button" className="text-sm font-black text-slate-500">Edit</button>
              </div>
              <div className="mt-4 grid gap-8 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Customer Segments</p>
                  <div className="mt-4 h-2 rounded-full bg-gradient-to-r from-sky-400 via-purple-500 via-pink-500 to-emerald-500" />
                  <div className="mt-4 space-y-4">
                    {customerSegments.length ? (
                      customerSegments.map((segment) => (
                        <div key={segment.name} className="flex items-center justify-between gap-4">
                          <p className="font-bold text-slate-900">{segment.name}</p>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-500">{segment.percent || 0}%</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">AI customer segments will appear here after refreshing from website.</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Competitors</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.competitors.length ? (
                      profile.competitors.map((competitor) => (
                        <span key={competitor} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">
                          {competitor}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">AI competitors will appear here after refreshing from website.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black">Preferences</h2>
                  <p className="mt-1 text-sm text-slate-500">Dashboard behavior and default workspace preferences.</p>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${theme === THEMES.DARK ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                  {theme === THEMES.DARK ? 'Black theme' : 'White theme'}
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <PreferenceCard title="Default Region" value={profile.country || 'United States'} />
                <PreferenceCard title="Analysis Style" value="Concise actionable summaries" />
                <PreferenceCard title="Feed Density" value="Comfortable" />
                <PreferenceCard title="Notifications" value="Muted for now" />
              </div>
            </section>
          </>
        )}
      </div>
    </section>
  );
}

function textToLines(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function SettingsRow({ label, help, children }) {
  return (
    <div className="grid gap-4 border-b border-slate-200 px-4 py-4 last:border-b-0 md:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <p className="text-sm font-medium text-slate-950">{label}</p>
        <p className="mt-1 text-xs text-slate-500">{help}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-emerald-300"
      placeholder={placeholder}
    />
  );
}

function ReadOnlyInput({ value }) {
  return (
    <div className="flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900">
      {value || 'Not set'}
    </div>
  );
}

function SettingsCheck({ checked = false, label, help, onChange }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange?.(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
      <span>
        <span className="block text-sm font-normal text-slate-900">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{help}</span>
      </span>
    </label>
  );
}

function EditableTextCard({ title, value, editing, onChange, placeholder }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-black">{title}</h2>
      {editing ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          placeholder={placeholder}
          className="mt-3 w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm leading-6 outline-none focus:border-emerald-300 focus:bg-white"
        />
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{value || 'Not set'}</p>
      )}
    </section>
  );
}

function PreferenceCard({ title, value }) {
  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <p className="mt-2 text-sm font-black text-slate-800">{value}</p>
    </section>
  );
}

function ToneInput({ label, placeholder, danger = false }) {
  return (
    <div>
      <p className={`font-black ${danger ? 'text-red-500' : 'text-emerald-600'}`}>{label} <span className="text-slate-400">(0/10)</span></p>
      <div className="mt-3 flex gap-3">
        <input className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-4 outline-none" placeholder={placeholder} />
        <button type="button" className="rounded-md border border-slate-200 px-4 text-sm font-black text-slate-500">+ Add</button>
      </div>
    </div>
  );
}

function BrandInfoCard({ title, children }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-black">{title}</h2>
        <button type="button" className="text-sm font-black text-slate-500">Edit</button>
      </div>
      <div className="space-y-4">{children}</div>
    </article>
  );
}

function InfoBlock({ label, text }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-800">{text}</p>
    </div>
  );
}

export default Brand;
