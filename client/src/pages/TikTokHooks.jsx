import { useMemo, useState } from 'react';
import useBookmarks from '../hooks/useBookmarks.js';
import { keyForVideo } from '../lib/analysis-store.js';
import { generateHookScript } from '../lib/api.js';
import { useAuth } from '@clerk/clerk-react';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { getBrandProfile } from '../lib/api.js';
import { useApiToast } from '../hooks/useApiToast.js';

const HOOK_TEMPLATES = [
  'Nobody talks about this {topic}...',
  'This will change how you see {topic}...',
  'I learned this too late about {topic}...',
  'Most people don’t realize {truth}...',
  'This is why you’re still {blank}...',
  'Here is the truth about {topic}...',
  'Avoid this mistake when {action}...',
  'This is the real reason you’re {blank}...',
  'If I had to start over with {topic}...',
  'If you are {audience}, listen carefully...',
];

function TikTokHooks() {
  const { bookmarks } = useBookmarks({ autoLoad: true });
  const { getToken } = useAuth();
  const { notifyApiError } = useApiToast();
  const [selectedHook, setSelectedHook] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [selectedSavedKey, setSelectedSavedKey] = useState('');
  const [draftScript, setDraftScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [useBrandProfile, setUseBrandProfile] = useState(true);
  const [brandContext, setBrandContext] = useState('');
  const [refineNotes, setRefineNotes] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const bookmarkOptions = useMemo(
    () =>
      bookmarks.map((b) => {
        const key = keyForVideo({ url: b.tiktok_url, caption: b.caption });
        const label = b.caption || b.tiktok_url || 'TikTok video';
        return { key, label };
      }),
    [bookmarks]
  );

  const handleUseSavedReference = (event) => {
    const value = event.target.value;
    setSelectedSavedKey(value);
    if (!value) return;
    const found = bookmarks.find((b) => keyForVideo({ url: b.tiktok_url, caption: b.caption }) === value);
    if (found) {
      setReferenceUrl(found.tiktok_url || '');
    }
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setSaveStatus('');

      let context = brandContext;

      // Lazy-load brand profile once when needed
      if (useBrandProfile && !context) {
        try {
          const token = await getToken();
          if (token) {
            const data = await getBrandProfile(token);
            const story = data.story || '';
            const ideal = data.preferences?.idealCustomers || data.target_audience || '';
            context = `${story}\n\nIdeal customers:\n${ideal}`.trim();
            setBrandContext(context);
          }
        } catch (e) {
          console.error('Failed to load brand profile for script generation', e);
        }
      }

      const payload = {
        hook: selectedHook || '',
        referenceUrl: referenceUrl || '',
        brandContext: context,
        product: '',
      };

      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const result = await generateHookScript(token, payload);
      if (result?.script) {
        setDraftScript(result.script);
      }
    } catch (e) {
      notifyApiError(e, 'Failed to generate script');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    try {
      setIsRefining(true);
      setSaveStatus('');

      let context = brandContext;
      if (useBrandProfile && !context) {
        try {
          const token = await getToken();
          if (token) {
            const data = await getBrandProfile(token);
            const story = data.story || '';
            const ideal = data.preferences?.idealCustomers || data.target_audience || '';
            context = `${story}\n\nIdeal customers:\n${ideal}`.trim();
            setBrandContext(context);
          }
        } catch (e) {
          console.error('Failed to load brand profile for refinement', e);
        }
      }

      const refinementContext = `${context || ''}\n\nExisting script:\n${draftScript || ''}\n\nRefinement notes:\n${
        refineNotes || 'Tighten pacing and clarity.'
      }`;

      const payload = {
        hook: selectedHook || '',
        referenceUrl: referenceUrl || '',
        brandContext: refinementContext,
        product: '',
      };

      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const result = await generateHookScript(token, payload);
      if (result?.script) {
        setDraftScript(result.script);
      }
    } catch (e) {
      notifyApiError(e, 'Failed to refine script');
    } finally {
      setIsRefining(false);
    }
  };

  const handleSaveScript = () => {
    try {
      const existingRaw = localStorage.getItem('tiktok_saved_scripts');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const entry = {
        id: Date.now(),
        hook: selectedHook,
        referenceUrl,
        script: draftScript,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem('tiktok_saved_scripts', JSON.stringify([entry, ...existing].slice(0, 50)));
      setSaveStatus('Script saved locally.');
    } catch {
      setSaveStatus('Failed to save script locally.');
    }
  };

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] app-muted">TikTok script writer</p>
        <h3 className="text-2xl font-semibold">Gemini-powered script scribe</h3>
        <p className="text-xs app-muted">
          Paste a reference video, pick a hook, and let Gemini draft a script tailored to your brand profile.
        </p>
      </header>

      <section>
        <article className="rounded-lg p-4" style={{ background: 'var(--app-panel)' }}>
          <p className="text-[11px] uppercase tracking-[0.16em] app-muted">Script workspace</p>
          <h4 className="mt-1 text-sm font-semibold">Reference video + hook → draft script</h4>
          <p className="mt-1 text-xs app-muted">
            Paste a TikTok link or pick from saved videos, choose a hook, then draft your script in the box below.
          </p>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleSaveScript}
              disabled={!draftScript}
              className="rounded-sm bg-[#2c313a] px-3 py-1.5 text-[11px] font-semibold text-[#eef2f7] disabled:opacity-60"
            >
              Save Script
            </button>
            <button
              type="button"
              onClick={handleRefine}
              disabled={isRefining || !selectedHook || !draftScript}
              className="rounded-sm bg-[#223a5e] px-3 py-1.5 text-[11px] font-semibold text-[#d9e8ff] disabled:opacity-60"
            >
              {isRefining ? 'Refining with Gemini...' : 'Refine with Gemini'}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !selectedHook}
              className="rounded-sm bg-[#5a2f82] px-3 py-1.5 text-[11px] font-semibold text-[#f6ebff] disabled:opacity-60"
            >
              {isGenerating ? 'Generating with Gemini...' : 'Generate from hook'}
            </button>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <label className="block">
              <span className="app-muted">Reference video URL</span>
              <input
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@user/video/123..."
                className="mt-1 w-full rounded-sm px-3 py-1.5 text-xs"
                style={{ background: 'var(--app-panel-2)', border: 'none' }}
              />
            </label>

            <label className="block">
              <span className="app-muted">...or use a saved TikTok</span>
              <select
                value={selectedSavedKey}
                onChange={handleUseSavedReference}
                className="mt-1 w-full rounded-sm px-3 py-1.5 text-xs"
                style={{ background: 'var(--app-panel-2)', border: 'none' }}
              >
                <option value="">Select from bookmarks</option>
                {bookmarkOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label.slice(0, 80)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="app-muted">What should this ad hook and video be about?</span>
              <textarea
                value={selectedHook}
                onChange={(e) => setSelectedHook(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-sm px-3 py-1.5 text-xs"
                style={{ background: 'var(--app-panel-2)', border: 'none' }}
                placeholder="e.g. Nobody talks about how lonely late-night shift workers feel... show how our AI companion fixes that."
              />
            </label>

            <label className="block text-[11px] app-muted">
              Use one of our proven hooks
              <select
                className="mt-1 w-full rounded-sm px-3 py-1.5 text-[11px]"
                style={{ background: 'var(--app-panel-2)', border: 'none' }}
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) return;
                  setSelectedHook(value);
                  if (!draftScript) {
                    setDraftScript(
                      `${value
                        .replace('{topic}', '')
                        .replace('{truth}', '')
                        .replace('{blank}', '')
                        .replace('{action}', '')
                        .replace('{audience}', '')}\n\n`
                    );
                  }
                }}
              >
                <option value="">Select a hook template…</option>
                {HOOK_TEMPLATES.map((hook) => (
                  <option key={hook} value={hook}>
                    {hook}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-1 flex items-center gap-2 text-xs app-muted">
              <input
                type="checkbox"
                checked={useBrandProfile}
                onChange={(e) => setUseBrandProfile(e.target.checked)}
                className="h-3.5 w-3.5 rounded border"
              />
              <span>Blend in my AI Brand Profile context when generating the script.</span>
            </label>

            <label className="block">
              <span className="app-muted">Draft script</span>
              <textarea
                value={draftScript}
                onChange={(e) => setDraftScript(e.target.value)}
                rows={6}
                className="mt-1 w-full rounded-sm px-3 py-1.5 text-xs"
                style={{ background: 'var(--app-panel-2)', border: 'none' }}
                placeholder="Outline your first 3 seconds, middle proof, and CTA. You can also paste this into the AI for refinement."
              />
            </label>

            <label className="block">
              <span className="app-muted">Refinement notes (optional)</span>
              <textarea
                value={refineNotes}
                onChange={(e) => setRefineNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-sm px-3 py-1.5 text-xs"
                style={{ background: 'var(--app-panel-2)', border: 'none' }}
                placeholder="e.g. Make this snappier, keep under 25 seconds, emphasize late-night loneliness more."
              />
            </label>

            {saveStatus ? <p className="mt-1 text-[11px] text-emerald-500">{saveStatus}</p> : null}

            {isGenerating || isRefining ? (
              <CubeLoaderOverlay
                label={isRefining ? 'Refining with Gemini…' : 'Generating with Gemini…'}
                minHeight="12rem"
              />
            ) : null}

            <div className="hidden">
              <button
                type="button"
                onClick={handleSaveScript}
                disabled={!draftScript}
                className="rounded-sm border px-3 py-1.5 text-[11px] font-semibold app-muted disabled:opacity-60"
                style={{ borderColor: 'var(--app-border)' }}
              >
                Save script
              </button>
              <button
                type="button"
                onClick={handleRefine}
                disabled={isRefining || !selectedHook || !draftScript}
                className="rounded-sm bg-white px-3 py-1.5 text-[11px] font-semibold text-black disabled:opacity-60"
              >
                {isRefining ? 'Refining with Gemini…' : 'Refine with Gemini'}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !selectedHook}
                className="rounded-sm bg-white px-3 py-1.5 text-[11px] font-semibold text-black disabled:opacity-60"
              >
                {isGenerating ? 'Generating with Gemini…' : 'Generate from hook'}
              </button>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}

export default TikTokHooks;
