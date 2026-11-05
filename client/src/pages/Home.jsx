import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../lib/api.js';

const trendingTikTokAds = [
  {
    id: 'tiktok-1',
    platform: 'TikTok',
    brand: '@miamansonn',
    hook: 'Trending clip from TikTok showcase',
    format: 'For You creative',
    signal: '97 Viral Score',
    tiktokUrl: 'https://www.tiktok.com/@miamansonn/video/7503176132716432670',
  },
  {
    id: 'tiktok-2',
    platform: 'TikTok',
    brand: '@wiggiediego2',
    hook: 'Trending clip from TikTok showcase',
    format: 'Creator-style hook',
    signal: '95 Viral Score',
    tiktokUrl: 'https://www.tiktok.com/@wiggiediego2/video/7496322671089601834',
  },
  {
    id: 'tiktok-3',
    platform: 'TikTok',
    brand: '@starwalkapp',
    hook: 'Trending clip from TikTok showcase',
    format: 'App discovery',
    signal: '94 Viral Score',
    tiktokUrl: 'https://www.tiktok.com/@starwalkapp/video/7585515709866855713',
  },
  {
    id: 'tiktok-4',
    platform: 'TikTok',
    brand: '@thebellairs',
    hook: 'me + you + a lifetime',
    format: 'Emotional story',
    signal: '93 Viral Score',
    tiktokUrl: 'https://www.tiktok.com/@thebellairs/video/7483907258045173022',
  },
  {
    id: 'tiktok-5',
    platform: 'TikTok',
    brand: '@regivenchy',
    hook: 'When Your Parasailing Line Snaps 500-Feet In The Air',
    format: 'Pattern interrupt',
    signal: '96 Viral Score',
    tiktokUrl: 'https://www.tiktok.com/@regivenchy/video/7362227340598086958',
  },
  {
    id: 'tiktok-6',
    platform: 'TikTok',
    brand: '@espn',
    hook: 'Incredible Basketball Dunk Between the Legs Move',
    format: 'Sports highlight',
    signal: '95 Viral Score',
    tiktokUrl: 'https://www.tiktok.com/@espn/video/7495918458274729246',
  },
];

const facebookStaticFormats = [
  {
    name: 'Problem → Product',
    use: 'Lead with the pain, then show the product as the clear fix.',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/651163c2f8bf867f9098b92c.jpg',
  },
  {
    name: 'Problem → Proof → Product',
    use: 'Best for skincare, fitness, SaaS, and home products.',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/651163c2f8bf867f9098b92c.jpg',
  },
  {
    name: 'Before / After',
    use: 'Show the transformation quickly with one bold outcome line.',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/5028369d584dd5e53a4cfc5c.jpg',
  },
  {
    name: 'Review Proof',
    use: 'Use a strong customer quote as the hero of the creative.',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/8e31abf631dcc102c4052f99.jpg',
  },
  {
    name: 'Offer Stack',
    use: 'Bundle the value, bonus, guarantee, and CTA into one frame.',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/5afc22b8520fd6038b0f49ee.jpg',
  },
  {
    name: 'Feature Callouts',
    use: 'Point to 3-4 product features with clean labels.',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/2d82e3f84ad84ee27cedd524.jpg',
  },
  {
    name: 'Founder Quote',
    use: 'Make the founder POV the hook for trust and differentiation.',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/8af8dc41e35e3d44981b5126.jpg',
  },
  {
    name: 'Comparison Grid',
    use: 'Compare old way vs new way for faster product understanding.',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/0df41ca6a317775234ff2812.jpg',
  },
  {
    name: 'Urgency Promo',
    use: 'Use a direct offer headline with deadline or limited quantity.',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/33a5a67f7ff834c3930f7499.jpg',
  },
];

const bestExamples = [
  {
    title: 'Before/after static product ad',
    note: 'Use a direct outcome headline and one visual proof point.',
    tag: 'Static Ad',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/2d82e3f84ad84ee27cedd524.jpg',
  },
  {
    title: 'Founder face + contrarian hook',
    note: 'Lead with a belief your market already feels but rarely says.',
    tag: 'UGC Angle',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/8af8dc41e35e3d44981b5126.jpg',
  },
  {
    title: 'Offer stack ad',
    note: 'Show the bundle, value, guarantee, and CTA in one clean frame.',
    tag: 'Conversion',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/0df41ca6a317775234ff2812.jpg',
  },
];

const newsItems = [
  {
    title: 'Meta advertisers are leaning harder into creator-style proof.',
    source: 'Creative note',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/33a5a67f7ff834c3930f7499.jpg',
  },
  {
    title: 'TikTok hooks under 2 seconds continue to outperform slow intros.',
    source: 'Format watch',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/4f28dd2522c78fdcd7738d30.jpg',
  },
  {
    title: 'Static ads with fewer claims and clearer product framing are easier to adapt.',
    source: 'Production tip',
    imageUrl: '/uploads/content-library/user_3I5B9jVlBdrC62lNuHQk1CzeztP/images/c4cd8147ab1010587dd20fc0.jpg',
  },
];

function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path}`;
}

function getTikTokEmbedUrl(value = '') {
  const match = String(value || '').match(/\/video\/(\d+)/);
  if (!match?.[1]) return '';
  return `https://www.tiktok.com/player/v1/${match[1]}?autoplay=0&loop=1&controls=1&description=0&music_info=0`;
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function Home() {
  const today = todayLabel();
  const tiktokSliderRef = useRef(null);

  const moveTikTokSlider = (direction = 1) => {
    const slider = tiktokSliderRef.current;
    if (!slider) return;

    const distance = Math.min(slider.clientWidth * 0.82, 380);
    const isAtEnd = slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 8;
    const isAtStart = slider.scrollLeft <= 8;

    if (direction > 0 && isAtEnd) {
      slider.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    if (direction < 0 && isAtStart) {
      slider.scrollTo({ left: slider.scrollWidth, behavior: 'smooth' });
      return;
    }

    slider.scrollBy({ left: distance * direction, behavior: 'smooth' });
  };

  useEffect(() => {
    const autoScroll = window.setInterval(() => {
      moveTikTokSlider(1);
    }, 4200);

    return () => window.clearInterval(autoScroll);
  }, []);

  return (
    <section className="space-y-5 text-slate-950">
      <header className="rounded-sm border border-slate-200 bg-white p-4 md:p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">Dashboard</p>
        <h1 className="mt-2 max-w-3xl text-2xl font-black leading-tight tracking-[-0.04em] md:text-3xl">
          Today's ad intelligence
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          A simple snapshot of trending TikTok ads, reusable TikTok formats, ad examples to try today, and news worth acting on.
        </p>
      </header>

      <Panel title="Trending TikTok Ads" action={{ label: 'View TikTok ads', to: '/tiktok/hot-takes' }}>
        <div className="mb-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => moveTikTokSlider(-1)}
            className="grid h-10 w-10 place-items-center rounded-sm border border-slate-200 bg-white text-lg font-black text-slate-950 hover:border-emerald-400 hover:text-emerald-600"
            aria-label="Move TikTok ads left"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => moveTikTokSlider(1)}
            className="grid h-10 w-10 place-items-center rounded-sm border border-slate-200 bg-emerald-500 text-lg font-black text-white hover:bg-emerald-600"
            aria-label="Move TikTok ads right"
          >
            ›
          </button>
        </div>
        <div ref={tiktokSliderRef} className="-mx-4 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-5 md:px-5">
          <div className="flex snap-x snap-mandatory gap-4">
            {trendingTikTokAds.map((item) => (
              <article key={item.id} className="min-w-[13.5rem] snap-start overflow-hidden rounded-sm border border-slate-200 bg-white sm:min-w-[14.5rem] lg:min-w-[15.5rem] xl:min-w-[16rem]">
                <div className="relative aspect-[9/16] bg-slate-950">
                  <iframe
                    src={getTikTokEmbedUrl(item.tiktokUrl)}
                    title={item.hook}
                    className="h-full w-full border-0"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    scrolling="no"
                    allowFullScreen
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                  <span className="pointer-events-none absolute left-2 top-2 rounded-sm bg-black/70 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
                    {item.platform}
                  </span>
                  <span className="pointer-events-none absolute right-2 top-2 rounded-sm bg-emerald-500 px-2 py-1 text-[9px] font-black text-white">
                    {item.signal}
                  </span>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">{item.brand}</p>
                    <h3 className="mt-1 line-clamp-2 text-sm font-black leading-5 text-white">{item.hook}</h3>
                    <p className="mt-1 text-xs text-slate-200">{item.format}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Panel>

      <section>
        <Panel title="Facebook Static Ads Formats" action={{ label: 'Open examples', to: '/facebook/ad-examples' }}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {facebookStaticFormats.filter((_, index) => index !== 1).slice(0, 8).map((item) => (
              <article key={item.name} className="overflow-hidden rounded-sm border border-slate-200 bg-white">
                <div className="relative aspect-[4/3] bg-slate-100">
                  <img src={mediaUrl(item.imageUrl)} alt={item.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
                    <span className="inline-flex rounded-sm bg-emerald-500 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">Format</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-base font-black text-slate-950">{item.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.use}</p>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Best Ad Examples To Try Today" action={{ label: 'Open examples', to: '/facebook/ad-examples' }}>
          <div className="grid gap-3">
            {bestExamples.map((item) => (
              <article key={item.title} className="grid overflow-hidden rounded-sm border border-slate-200 bg-white sm:grid-cols-[11rem_1fr]">
                <div className="aspect-[4/3] bg-slate-100 sm:aspect-auto">
                  <img src={mediaUrl(item.imageUrl)} alt={item.title} className="h-full w-full object-cover" />
                </div>
                <div className="p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-600">{item.tag}</p>
                  <h3 className="mt-2 text-lg font-black text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.note}</p>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="News & Notifications" action={{ label: 'Read updates', to: '/articles' }}>
          <div className="space-y-3">
            {newsItems.map((item) => (
              <article key={item.title} className="grid grid-cols-[5.5rem_1fr] overflow-hidden rounded-sm border border-slate-200 bg-slate-50">
                <img src={mediaUrl(item.imageUrl)} alt={item.title} className="h-full min-h-24 w-full object-cover" />
                <div className="p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{item.source}</p>
                  <h3 className="mt-2 text-base font-black leading-6 text-slate-950">{item.title}</h3>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </section>
    </section>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="rounded-sm border border-slate-200 bg-white p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black tracking-[-0.02em] text-slate-950">{title}</h2>
        {action ? (
          <Link to={action.to} className="rounded-sm bg-emerald-500 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-emerald-600">
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default Home;
