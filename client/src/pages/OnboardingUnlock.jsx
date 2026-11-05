import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useBilling } from '../components/billing/BillingContext.jsx';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { getBrandProfile } from '../lib/api.js';
import { trackEvent } from '../lib/firebaseAnalytics.js';
import { trackMetaViewContent } from '../lib/metaPixel.js';

const SHOWCASE_VIDEOS = [
  {
    id: 'tiktok-1',
    platform: 'TikTok',
    brand: '@miamansonn',
    headline: 'Trending clip from TikTok showcase',
    viralScore: 97,
    tiktok_url: 'https://www.tiktok.com/@miamansonn/video/7503176132716432670',
  },
  {
    id: 'tiktok-2',
    platform: 'TikTok',
    brand: '@wiggiediego2',
    headline: 'Trending clip from TikTok showcase',
    viralScore: 95,
    tiktok_url: 'https://www.tiktok.com/@wiggiediego2/video/7496322671089601834',
  },
  {
    id: 'tiktok-3',
    platform: 'TikTok',
    brand: '@starwalkapp',
    headline: 'Trending clip from TikTok showcase',
    viralScore: 94,
    tiktok_url: 'https://www.tiktok.com/@starwalkapp/video/7585515709866855713',
  },
  {
    id: 'tiktok-4',
    platform: 'TikTok',
    brand: '@thebellairs',
    headline: 'me + you + a lifetime',
    viralScore: 93,
    tiktok_url: 'https://www.tiktok.com/@thebellairs/video/7483907258045173022',
  },
  {
    id: 'tiktok-5',
    platform: 'TikTok',
    brand: '@regivenchy',
    headline: 'When Your Parasailing Line Snaps 500-Feet In The Air',
    viralScore: 96,
    tiktok_url: 'https://www.tiktok.com/@regivenchy/video/7362227340598086958',
  },
  {
    id: 'tiktok-6',
    platform: 'TikTok',
    brand: '@beautifscenery',
    headline: 'Blade Mountain in Guizhou Province',
    viralScore: 91,
    tiktok_url: 'https://www.tiktok.com/@beautifscenery/video/7218937151273061674',
  },
  {
    id: 'tiktok-7',
    platform: 'TikTok',
    brand: '@espn',
    headline: 'Incredible Basketball Dunk Between the Legs Move',
    viralScore: 95,
    tiktok_url: 'https://www.tiktok.com/@espn/video/7495918458274729246',
  },
  {
    id: 'tiktok-8',
    platform: 'TikTok',
    brand: '@bryguyferreira',
    headline: 'POV: you finally find the creative that converts',
    viralScore: 92,
    tiktok_url: 'https://www.tiktok.com/@bryguyferreira/video/7511686549528907039',
  },
];

const UNLOCK_REVIEWS = [
  {
    quote: 'We walk into Monday planning with examples everyone can react to — fewer circles, clearer creative.',
    name: 'Thandiwe Moyo',
    role: 'Performance Marketing Lead',
  },
  {
    quote: 'Feedback got easier. We point to references instead of vague “make it stronger” comments.',
    name: 'Liam Carter',
    role: 'Creative Strategy Manager',
  },
  {
    quote: 'Saved collections replaced Slack screenshot dumps. The team actually comes back to ideas.',
    name: 'Marcus Johnson',
    role: 'Senior Growth Manager',
  },
  {
    quote: 'Fewer expensive guesses. We spot stronger creative earlier and waste less test budget.',
    name: 'Sophie Dubois',
    role: 'Founder',
  },
  {
    quote: 'Multi-client research stopped feeling messy. Weekly strategy finally has a clean starting point.',
    name: 'Ethan Walker',
    role: 'Media Buying Director',
  },
  {
    quote: 'From research to UGC to posting — this is the workflow we needed in one product.',
    name: 'Ayo Okonkwo',
    role: 'Growth Lead',
  },
];

const UNLOCK_COPY = {
  founder: {
    kicker: 'Built for founders',
    cta: 'Turn winners into posts',
  },
  media_buyer: {
    kicker: 'Built for media buyers',
    cta: 'Steal the angle. Ship it.',
  },
  in_house: {
    kicker: 'Built for in-house growth',
    cta: 'Fill the calendar from winners',
  },
  agency: {
    kicker: 'Built for agencies',
    cta: 'Scale every brand from proof',
  },
};

function blurForIndex(index) {
  if (index <= 3) return 0;
  if (index <= 5) return 3;
  return 8;
}

function getTikTokEmbedUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/\/video\/(\d+)/);
  if (!match?.[1]) return '';
  return `https://www.tiktok.com/player/v1/${match[1]}?autoplay=1&loop=1&controls=0&description=0&music_info=0&rel=0`;
}

function getInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function UnlockVideoCard({ item, blurPx = 0 }) {
  const embedUrl = getTikTokEmbedUrl(item.tiktok_url);

  return (
    <article
      className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70"
      style={{ filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined }}
    >
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-[#0a0a0a]">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={item.headline || 'TikTok video'}
            className="pointer-events-none absolute inset-0 h-full w-full scale-[1.02] overflow-hidden border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            scrolling="no"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-black/55 text-white">
              <PlayIcon />
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/25" />

        <div className="pointer-events-none absolute right-2 top-2 rounded-full border border-lime-400/40 bg-black/65 px-2 py-0.5 text-[9px] font-bold text-lime-300">
          {item.viralScore}
        </div>

        <div className="pointer-events-none absolute left-2 top-2 rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white">
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

function ReviewMarquee() {
  const loop = [...UNLOCK_REVIEWS, ...UNLOCK_REVIEWS];

  return (
    <div className="relative w-full overflow-hidden py-1">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#040404] to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#040404] to-transparent sm:w-24" />

      <div className="unlock-review-marquee gap-3 px-2">
        {loop.map((review, index) => (
          <article
            key={`${review.name}-${index}`}
            className="w-[280px] shrink-0 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur-md sm:w-[320px]"
          >
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-[11px] font-bold text-emerald-200">
                {getInitials(review.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{review.name}</p>
                <p className="truncate text-[11px] text-slate-400">{review.role}</p>
              </div>
              <div className="ml-auto flex items-center gap-0.5 text-amber-300">
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
              </div>
            </div>
            <p className="mt-2.5 line-clamp-3 text-xs leading-5 text-slate-200">"{review.quote}"</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingUnlock() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { loading, subscription } = useBilling();
  const progressedRef = useRef(false);
  const [audienceRole, setAudienceRole] = useState('');
  const [roleReady, setRoleReady] = useState(false);
  const roleRef = useRef('');
  const unlockCopy = UNLOCK_COPY[audienceRole] || UNLOCK_COPY.founder;
  roleRef.current = audienceRole;

  const withRole = (params = {}) => ({
    ...params,
    audience_role: roleRef.current || '',
  });

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
    if (!roleReady) return undefined;
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
  }, [roleReady]);

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

  if (loading) {
    return <CubeLoaderOverlay label="Loading preview…" fullscreen />;
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#040404] text-white">
      <div className="absolute inset-x-0 top-0 px-3 pt-5 sm:px-4 md:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {SHOWCASE_VIDEOS.map((item, index) => (
            <UnlockVideoCard key={item.id} item={item} blurPx={blurForIndex(index)} />
          ))}
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, transparent 18%, rgba(4,4,4,0.35) 36%, rgba(4,4,4,0.82) 58%, #040404 74%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] backdrop-blur-[1px]"
        style={{
          WebkitMaskImage: 'linear-gradient(to top, black 40%, transparent 100%)',
          maskImage: 'linear-gradient(to top, black 40%, transparent 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] backdrop-blur-md"
        style={{
          WebkitMaskImage: 'linear-gradient(to top, black 25%, transparent 92%)',
          maskImage: 'linear-gradient(to top, black 25%, transparent 92%)',
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col justify-end pb-10 pt-[42vh] sm:pb-12 sm:pt-[46vh]">
        <div className="mb-6 w-full">
          <ReviewMarquee />
        </div>

        <div className="px-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">{unlockCopy.kicker}</p>
          <button
            type="button"
            onClick={handleUnlock}
            className="mt-5 min-w-[240px] rounded-xl bg-emerald-400 px-8 py-3.5 text-sm font-semibold text-black shadow-[0_12px_40px_rgba(52,211,153,0.35)] transition hover:bg-emerald-300"
          >
            {unlockCopy.cta}
          </button>
        </div>
      </div>
    </section>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M6.5 4.8v10.4c0 .7.8 1.1 1.4.7l8.2-5.2c.6-.4.6-1.1 0-1.5L7.9 4.1c-.6-.4-1.4 0-1.4.7Z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="M8 1.4l1.8 3.7 4.1.6-3 2.9.7 4.1L8 11.7l-3.6 1.9.7-4.1-3-2.9 4.1-.6L8 1.4Z" />
    </svg>
  );
}
