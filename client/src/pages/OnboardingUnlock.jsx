import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useBilling } from '../components/billing/BillingContext.jsx';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { getBrandProfile } from '../lib/api.js';
import { trackEvent } from '../lib/firebaseAnalytics.js';
import { trackMetaViewContent } from '../lib/metaPixel.js';
import {
  claimUnlockIframe,
  getTikTokEmbedUrl,
  getUnlockShowcaseVideos,
  preloadUnlockShowcase,
  releaseUnlockIframe,
  waitForUnlockShowcase,
} from '../lib/unlockShowcase.js';

const UNLOCK_COPY = {
  founder: {
    kicker: 'Built for founders',
    title: 'What this does for you',
    body: 'You get one place to see ads and organic content already working in your category — so you stop guessing creatives and spending test budget on weak ideas.',
    bullets: [
      'Search competitor ads and content in your niche',
      'Steal hooks, offers, and angles before you shoot',
      'Save examples your designer or editor can actually use',
    ],
    cta: 'Unlock my research library',
  },
  media_buyer: {
    kicker: 'Built for media buyers',
    title: 'What this does for you',
    body: 'You get competitor ads and content for the accounts you buy — so you can brief tests, swipe angles, and raise spend on ideas that already have proof.',
    bullets: [
      'Pull ads and organic examples by geo and placement',
      'Filter what is working before you launch another test',
      'Save collections per account instead of screenshot dumps',
    ],
    cta: 'Unlock competitor research',
  },
  in_house: {
    kicker: 'Built for in-house growth',
    title: 'What this does for your team',
    body: 'Media, content, and strategy share one library. Everyone briefs from the same ads and organic examples instead of scattered Slack screenshots.',
    bullets: [
      'One research workspace for ads and content',
      'Shared saves so creative and media stay aligned',
      'Analyze hooks and angles before the next sprint',
    ],
    cta: 'Unlock team research',
  },
  agency: {
    kicker: 'Built for agencies',
    title: 'What this does for your team',
    body: 'Your whole roster gets a shared ads-and-content library. Anyone on the team can research winning examples for the brands you manage — without starting from a blank brief.',
    bullets: [
      'Research ads and content across the clients you manage',
      'Give media buyers and creatives the same examples',
      'Brief faster: hooks, angles, and proof already in market',
    ],
    cta: 'Unlock the agency library',
  },
};

function blurForIndex(index) {
  if (index <= 3) return 0;
  if (index <= 5) return 4;
  return 9;
}

function VideoPreviewCard({ item, blurPx = 0 }) {
  const mountRef = useRef(null);
  const [claimed, setClaimed] = useState(null);
  const embedUrl = getTikTokEmbedUrl(item.tiktok_url);

  useEffect(() => {
    const node = mountRef.current;
    if (!node) return undefined;
    const ok = claimUnlockIframe(item.id, node);
    setClaimed(ok);
    return () => {
      releaseUnlockIframe(item.id);
    };
  }, [item.id]);

  return (
    <article
      className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70"
      style={{ filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined }}
    >
      <div className="relative aspect-[9/16] w-full bg-[#0f172a]">
        <div ref={mountRef} className="absolute inset-0 overflow-hidden" />
        {claimed === false && embedUrl ? (
          <iframe
            src={embedUrl}
            title={item.headline || 'TikTok video'}
            className="absolute inset-0 h-full w-full overflow-hidden border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            scrolling="no"
            allowFullScreen
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        <div className="absolute right-2 top-2 rounded-full border border-lime-400/40 bg-black/65 px-2 py-0.5 text-[9px] font-bold text-lime-300">
          {item.viralScore}
        </div>

        <div className="absolute left-2 top-2 rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white">
          {item.platform}
        </div>

        <div className="pointer-events-none absolute bottom-0 w-full p-2.5">
          <p className="line-clamp-1 text-[10px] font-semibold text-white">{item.brand}</p>
          <p className="line-clamp-1 text-[10px] text-slate-300">{item.headline}</p>
        </div>
      </div>
    </article>
  );
}

export default function OnboardingUnlock() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { loading, subscription } = useBilling();
  const progressedRef = useRef(false);
  const [audienceRole, setAudienceRole] = useState('');
  const [roleReady, setRoleReady] = useState(false);
  const [videosReady, setVideosReady] = useState(false);
  const roleRef = useRef('');
  const [showcaseVideos] = useState(() => getUnlockShowcaseVideos());
  const unlockCopy = UNLOCK_COPY[audienceRole] || UNLOCK_COPY.founder;
  roleRef.current = audienceRole;

  const withRole = (params = {}) => ({
    ...params,
    audience_role: roleRef.current || '',
  });

  useEffect(() => {
    preloadUnlockShowcase();
    let cancelled = false;
    waitForUnlockShowcase(8000).then(() => {
      if (!cancelled) setVideosReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadRole() {
      try {
        const token = await getToken();
        if (!token) return;
        const profile = await getBrandProfile(token);
        const prefs = profile?.preferences;
        const parsed = typeof prefs === 'string' ? JSON.parse(prefs || '{}') : prefs || {};
        const role = parsed.audienceRole || '';
        if (!cancelled) {
          setAudienceRole(role);
          setRoleReady(true);
        }
      } catch {
        if (!cancelled) setRoleReady(true);
      }
    }
    loadRole();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    if (!roleReady || !videosReady) return undefined;
    trackEvent('onboarding_unlock_viewed', withRole());
    trackMetaViewContent({
      content_name: 'onboarding_unlock',
      content_category: 'pricing_teaser',
    });
    return () => {
      if (progressedRef.current) return;
      trackEvent('onboarding_billing_dropoff', withRole({
        step_key: 'unlock',
        question_label: 'Unlock teaser',
      }));
    };
  }, [roleReady, videosReady]);

  useEffect(() => {
    if (!loading && subscription?.is_active) {
      navigate('/app', { replace: true });
    }
  }, [loading, navigate, subscription?.is_active]);

  const handleUnlock = () => {
    progressedRef.current = true;
    trackEvent('onboarding_unlock_clicked', withRole());
    trackMetaViewContent({
      content_name: 'unlock_to_pricing',
      content_category: 'pricing',
    });
    const pendingPlan = typeof window !== 'undefined' ? localStorage.getItem('pending_checkout_plan') : '';
    navigate(
      pendingPlan ? `/onboarding/billing?checkoutPlan=${pendingPlan}` : '/onboarding/billing',
      { replace: true }
    );
  };

  if (loading || !videosReady) {
    return <CubeLoaderOverlay label="Preparing your preview…" fullscreen />;
  }

  return (
    <section className="relative h-screen overflow-hidden bg-[#040404] text-white">
      <div className="absolute inset-x-0 top-0 px-3 pt-5 sm:px-4 md:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {showcaseVideos.map((item, index) => (
            <VideoPreviewCard key={item.id} item={item} blurPx={blurForIndex(index)} />
          ))}
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, transparent 28%, rgba(4,4,4,0.45) 48%, rgba(4,4,4,0.88) 68%, #040404 82%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] backdrop-blur-[1px]"
        style={{
          WebkitMaskImage: 'linear-gradient(to top, black 35%, transparent 100%)',
          maskImage: 'linear-gradient(to top, black 35%, transparent 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] backdrop-blur-md"
        style={{
          WebkitMaskImage: 'linear-gradient(to top, black 20%, transparent 92%)',
          maskImage: 'linear-gradient(to top, black 20%, transparent 92%)',
        }}
      />

      <div className="absolute inset-x-0 top-[70%] z-10 -translate-y-1/2 px-4 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">{unlockCopy.kicker}</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-xl font-semibold leading-tight sm:text-2xl md:text-3xl lg:text-4xl">
          {unlockCopy.title}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 md:text-base">
          {unlockCopy.body}
        </p>
        {unlockCopy.bullets?.length ? (
          <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-left text-sm text-slate-200">
            {unlockCopy.bullets.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-0.5 text-emerald-300">+</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          onClick={handleUnlock}
          className="mt-6 min-w-[240px] rounded-xl bg-emerald-400 px-8 py-3.5 text-sm font-semibold text-black shadow-[0_12px_40px_rgba(52,211,153,0.35)] transition hover:bg-emerald-300"
        >
          {unlockCopy.cta}
        </button>
      </div>
    </section>
  );
}
