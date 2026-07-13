import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBilling } from '../components/billing/BillingContext.jsx';
import { MOCK_ADS } from '../lib/mock-data.js';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { trackEvent } from '../lib/firebaseAnalytics.js';

const PREVIEW_ITEMS = [
  ...MOCK_ADS.map((ad) => ({ ...ad, mediaType: 'image' })),
  ...MOCK_ADS.slice(0, 4).map((ad, index) => ({
    ...ad,
    id: `video-${ad.id}-${index}`,
    mediaType: 'video',
    platform: index % 2 === 0 ? 'TikTok' : 'Instagram Reels',
  })),
];

function blurForIndex(index) {
  if (index <= 3) return 0;
  if (index <= 7) return 4;
  return 9;
}

function PreviewCard({ item, blurPx = 0 }) {
  const isVideo = item.mediaType === 'video';

  return (
    <article
      className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70"
      style={{ filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined }}
    >
      <div className="relative aspect-[9/16] w-full">
        <img src={item.image} alt={item.headline} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {isVideo ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-black/55 text-white backdrop-blur-sm">
              <PlayIcon />
            </span>
          </div>
        ) : null}

        <div className="absolute right-2 top-2 rounded-full border border-lime-400/40 bg-black/65 px-2 py-0.5 text-[9px] font-bold text-lime-300">
          {item.viralScore}
        </div>

        <div className="absolute left-2 top-2 rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white">
          {item.platform}
        </div>

        <div className="absolute bottom-0 w-full p-2.5">
          <p className="line-clamp-1 text-[10px] font-semibold text-white">{item.brand}</p>
          <p className="line-clamp-1 text-[10px] text-slate-300">{item.headline}</p>
        </div>
      </div>
    </article>
  );
}

export default function OnboardingUnlock() {
  const navigate = useNavigate();
  const { loading, subscription } = useBilling();

  useEffect(() => {
    trackEvent('onboarding_unlock_viewed');
  }, []);

  useEffect(() => {
    if (!loading && subscription?.is_active) {
      navigate('/app', { replace: true });
    }
  }, [loading, navigate, subscription?.is_active]);

  const handleUnlock = () => {
    trackEvent('onboarding_unlock_clicked');
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
    <section className="relative h-screen overflow-hidden bg-[#040404] text-white">
      <div className="absolute inset-x-0 top-0 px-3 pt-5 sm:px-4 md:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {PREVIEW_ITEMS.map((item, index) => (
            <PreviewCard key={item.id} item={item} blurPx={blurForIndex(index)} />
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

      <div className="absolute inset-x-0 top-3/4 z-10 -translate-y-1/2 px-4 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Your library is ready</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-xl font-semibold leading-tight sm:text-2xl md:text-3xl lg:text-4xl">
          1.5 million+ video and static ad templates, hooks, and trending content
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 md:text-base">
          Unlock full access to search, filter, bookmark, and analyze what is working in your niche —
          before you spend another dollar on creative.
        </p>
        <button
          type="button"
          onClick={handleUnlock}
          className="mt-6 min-w-[240px] rounded-xl bg-emerald-400 px-8 py-3.5 text-sm font-semibold text-black shadow-[0_12px_40px_rgba(52,211,153,0.35)] transition hover:bg-emerald-300"
        >
          Unlock full library
        </button>
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
