import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const tutorialSections = [
  {
    key: 'website',
    title: 'Website',
    eyebrow: 'Landing pages and market review',
    summary: 'Understand your page, your offer, and the competitive space before pushing more traffic.',
    icon: 'WE',
    details: [
      {
        name: 'Website Research',
        path: '/website/cro-audit',
        description:
          'Run a CRO audit on any landing page or website to find weak headlines, unclear offers, friction points, and conversion issues.',
      },
      {
        name: 'Competitor Radar',
        path: '/app/competitor-radar',
        description:
          'Review the competitor landscape, compare offers, and understand how others in the niche are positioning themselves.',
      },
    ],
  },
  {
    key: 'facebook',
    title: 'Facebook',
    eyebrow: 'Meta ad research',
    summary: 'Study ads, hooks, and saved references for Facebook-first campaign work.',
    icon: 'FB',
    details: [
      {
        name: 'Ads',
        path: '/facebook/ads',
        description:
          'Search and review Facebook ad creatives to see angles, offers, formatting, and copy patterns used by other advertisers.',
      },
      {
        name: 'Trending Music',
        path: '/facebook/trending-music',
        description:
          'Explore music-led creative direction and audio-inspired ad concepts for social video campaigns.',
      },
      {
        name: 'Hook Generator',
        path: '/facebook/hook-generator',
        description:
          'Generate hooks, headlines, CTAs, and primary copy variations from a short brief.',
      },
      {
        name: 'Workspace',
        path: '/facebook/workspace',
        description:
          'Save Facebook links into folders so you can keep your best ad references organized.',
      },
    ],
  },
  {
    key: 'instagram',
    title: 'Instagram',
    eyebrow: 'Visual and reel research',
    summary: 'Find inspiration across posts, reels, hashtag trends, and saved references.',
    icon: 'IG',
    details: [
      {
        name: 'Posts',
        path: '/instagram/posts',
        description:
          'Browse Instagram post content to understand feed design, visual direction, and static content ideas.',
      },
      {
        name: 'Reels',
        path: '/instagram/reels',
        description:
          'Focus on reel-style content to study short-form motion, pacing, and presentation.',
      },
      {
        name: 'Trending',
        path: '/instagram/trending',
        description:
          'Review trending content by hashtag so you can quickly see what formats and topics are working.',
      },
      {
        name: 'Workspace',
        path: '/instagram/workspace',
        description:
          'Save post and reel links into folders for later use, campaign building, or team review.',
      },
    ],
  },
  {
    key: 'tiktok',
    title: 'TikTok',
    eyebrow: 'Short-form trend research',
    summary: 'Explore trends, creators, hooks, sounds, and saved inspiration in one section.',
    icon: 'TT',
    details: [
      {
        name: 'Trending',
        path: '/tiktok/trending',
        description:
          'Search TikTok videos by keyword and discover hooks, creative angles, and content patterns worth testing.',
      },
      {
        name: 'Hot Takes',
        path: '/tiktok/hot-takes',
        description:
          'Review structured trend data inspired by TikTok Creative Center for a clearer market read.',
      },
      {
        name: 'Creators',
        path: '/tiktok/creators',
        description:
          'Study creators and identify accounts whose style, audience, or format is worth monitoring.',
      },
      {
        name: 'Hook Library',
        path: '/tiktok/hooks',
        description:
          'Focus on opening lines and hook ideas so you can improve first-second performance.',
      },
      {
        name: 'Trending Music',
        path: '/tiktok/trending-music',
        description:
          'Explore rising sounds and music trends that can shape ad concepts and content direction.',
      },
      {
        name: 'Predictor',
        path: '/tiktok/predictor',
        description:
          'Surface early signals that can hint at breakout concepts before they become obvious.',
      },
      {
        name: 'Workspace',
        path: '/tiktok/workspace',
        description:
          'Save TikTok links into folders so your research becomes a reusable idea library.',
      },
    ],
  },
];

function Tutorial() {
  const [activeKey, setActiveKey] = useState(null);

  const activeSection = useMemo(
    () => tutorialSections.find((section) => section.key === activeKey) || null,
    [activeKey]
  );

  useEffect(() => {
    if (!activeSection) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveKey(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [activeSection]);

  return (
    <section className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-2">
        {tutorialSections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setActiveKey(section.key)}
            className="rounded-sm border border-white/10 bg-black/20 p-5 text-left text-white shadow-[0_18px_50px_rgba(0,0,0,0.14)] transition hover:border-white/20 hover:bg-white/[0.03]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-emerald-400 text-sm font-semibold text-black">
                {section.icon}
              </div>
              <div className="rounded-sm border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Section
              </div>
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              {section.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{section.summary}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
              Open guide
              <ArrowRightIcon />
            </span>
          </button>
        ))}
      </div>

      {activeSection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/75"
            aria-label="Close tutorial"
            onClick={() => setActiveKey(null)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-sm border border-white/10 bg-[#0a0a0a] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  {activeSection.eyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{activeSection.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{activeSection.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveKey(null)}
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 text-slate-400 hover:text-white"
                aria-label={`Close ${activeSection.title} guide`}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-5 py-5">
              <div className="grid gap-4">
                {activeSection.details.map((item) => (
                  <article key={item.path} className="rounded-sm border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{item.description}</p>
                      </div>
                      <Link
                        to={item.path}
                        className="shrink-0 rounded-sm border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/5"
                        onClick={() => setActiveKey(null)}
                      >
                        Open page
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

export default Tutorial;
