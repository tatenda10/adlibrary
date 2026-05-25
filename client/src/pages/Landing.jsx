import { useCallback, useEffect, useRef, useState } from 'react';
import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import { Navbar } from '../components/layout/Navbar.jsx';
import WebsiteAnalysisPreviewModal from '../components/WebsiteAnalysisPreviewModal.jsx';
import { MOCK_ADS } from '../lib/mock-data.js';
import { AdCard } from '../components/ui/AdCard.jsx';
import {
  API_URL,
} from '../lib/api.js';
import { PRICING_PLANS } from '../lib/pricingPlans.js';
import { submitSupportMessage } from '../lib/api.js';
import logo from '../assets/logo.png';
import { trackEvent } from '../lib/firebaseAnalytics.js';

const NICHES = ['All', 'E-commerce', 'SaaS', 'Health', 'Tech', 'Fintech'];

const FEATURE_BLOCKS = [
  {
    title: 'Shared Creative Direction',
    text: 'Bring your media buyers, strategists, and designers into one workflow with the same visual references.',
    image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Fast Research Collaboration',
    text: 'Move from scattered screenshots to focused research sessions with searchable ad examples.',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Smarter Test Planning',
    text: 'Use AI signals and proven hooks to prioritize better tests before spending budget.',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Reports Teams Actually Use',
    text: 'Save, compare, and share findings in clear summaries your team can execute immediately.',
    image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
  },
];

const FALLBACK_VIDEO_SHOWCASE = [
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
    headline: 'Me after the slightest inconvenience',
    viralScore: 92,
    tiktok_url: 'https://www.tiktok.com/@bryguyferreira/video/7511686549528907039',
  },
];

const TESTIMONIALS = [
  {
    quote: 'Before ViralAdLibrary, our Monday planning meetings were chaos. Now we come in with examples, agree on angles quickly, and our creative team actually enjoys the process again.',
    name: 'Thandiwe Moyo',
    role: 'Performance Marketing Lead',
    company: 'Takealot',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
    tags: ['DTC', 'Creative Ops'],
    score: '5.0',
  },
  {
    quote: 'It gave us a shared language with our designers. Instead of saying "make it punchier", we show references and ship better concepts on the first pass.',
    name: 'Liam Carter',
    role: 'Creative Strategy Manager',
    company: 'Canva',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=300&q=80',
    tags: ['Agency', 'Planning'],
    score: '5.0',
  },
  {
    quote: 'The saved collections alone changed our workflow. We stopped dropping random screenshots in Slack and started making decisions faster as a team.',
    name: 'Marcus Johnson',
    role: 'Senior Growth Manager',
    company: 'HubSpot',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    tags: ['SaaS', 'Reporting'],
    score: '5.0',
  },
  {
    quote: 'As a founder, I finally feel confident in what good ad creative looks like. We wasted less money on weak ideas and improved our first-week results.',
    name: 'Sophie Dubois',
    role: 'Founder',
    company: 'Decathlon',
    avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=300&q=80',
    tags: ['E-commerce', 'Launch'],
    score: '4.9',
  },
  {
    quote: 'We manage multiple clients and this made cross-channel research much less painful. It is now part of our weekly strategy routine.',
    name: 'Ethan Walker',
    role: 'Media Buying Director',
    company: 'WPP',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    tags: ['Media Buying', 'Scale'],
    score: '5.0',
  },
];

function Landing() {
  const [activeNiche, setActiveNiche] = useState('All');
  const [showOfferModal, setShowOfferModal] = useState(true);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [showcaseVideos, setShowcaseVideos] = useState(() => pickRandomItems(FALLBACK_VIDEO_SHOWCASE, 4));
  const [isRefreshingShowcase, setIsRefreshingShowcase] = useState(false);
  const [showcaseStatus, setShowcaseStatus] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatSuccess, setChatSuccess] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatForm, setChatForm] = useState({ name: '', email: '', message: '' });
  const [testimonialIndex, setTestimonialIndex] = useState(2);
  const [stickyOffset, setStickyOffset] = useState({ x: 0, y: 0 });
  const heroSectionRef = useRef(null);
  const stickyNoteRef = useRef(null);
  const dragStateRef = useRef(null);

  const filteredAds = activeNiche === 'All'
    ? MOCK_ADS
    : MOCK_ADS.filter((ad) => ad.niche === activeNiche);
  const previewCards = showcaseVideos.slice(0, 4).map((item, index) => ({
    id: item.id || `video-${index}`,
    niche: inferNicheFromText(item.headline),
    brand: item.brand || 'For You pick',
    headline: item.headline || 'Creative example',
    platform: item.platform || 'TikTok',
    image: item.thumbnail || item.cover || item.covers?.default || '',
    thumbnail: item.thumbnail || item.cover || item.covers?.default || '',
    viralScore: Number(item.viralScore || 90),
    videoStreamUrl: resolveVideoStreamUrl(item),
    tiktokUrl: item.tiktok_url || item.url || item.share_url || '',
  }));
  const currentTestimonial = TESTIMONIALS[testimonialIndex % TESTIMONIALS.length];
  const previousTestimonial = TESTIMONIALS[(testimonialIndex - 1 + TESTIMONIALS.length) % TESTIMONIALS.length];
  const nextTestimonial = TESTIMONIALS[(testimonialIndex + 1) % TESTIMONIALS.length];

  useEffect(() => {
    trackEvent('landing_viewed', {
      section: 'hero',
    });
  }, []);

  useEffect(() => {
    if (!showcaseStatus) return undefined;
    const timer = window.setTimeout(() => setShowcaseStatus(''), 2600);
    return () => window.clearTimeout(timer);
  }, [showcaseStatus]);

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handleStickyPointerMove);
      window.removeEventListener('pointerup', handleStickyPointerUp);
    };
  }, []);

  const clampStickyOffset = useCallback((nextX, nextY) => {
    const section = heroSectionRef.current;
    if (!section) return { x: nextX, y: nextY };

    const sectionRect = section.getBoundingClientRect();
    const minX = -dragStateRef.current.baseLeft + sectionRect.left + 8;
    const maxX = sectionRect.right - dragStateRef.current.baseRight - 8;
    const minY = -dragStateRef.current.baseTop + sectionRect.top + 8;
    const maxY = sectionRect.bottom - dragStateRef.current.baseBottom - 8;

    return {
      x: Math.min(maxX, Math.max(minX, nextX)),
      y: Math.min(maxY, Math.max(minY, nextY)),
    };
  }, []);

  const handleStickyPointerMove = useCallback((event) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const next = clampStickyOffset(drag.startOffsetX + deltaX, drag.startOffsetY + deltaY);
    setStickyOffset(next);
  }, [clampStickyOffset]);

  const handleStickyPointerUp = useCallback(() => {
    dragStateRef.current = null;
    window.removeEventListener('pointermove', handleStickyPointerMove);
    window.removeEventListener('pointerup', handleStickyPointerUp);
  }, [handleStickyPointerMove]);

  const handleStickyPointerDown = (event) => {
    if (event.target.closest('input,button,a')) return;
    const section = heroSectionRef.current;
    const note = stickyNoteRef.current;
    if (!section || !note) return;

    const sectionRect = section.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: stickyOffset.x,
      startOffsetY: stickyOffset.y,
      baseLeft: noteRect.left - stickyOffset.x,
      baseRight: noteRect.right - stickyOffset.x,
      baseTop: noteRect.top - stickyOffset.y,
      baseBottom: noteRect.bottom - stickyOffset.y,
    };

    window.addEventListener('pointermove', handleStickyPointerMove);
    window.addEventListener('pointerup', handleStickyPointerUp);
  };

  const handleRefreshShowcase = async () => {
    try {
      setIsRefreshingShowcase(true);
      setShowcaseVideos(pickRandomItems(FALLBACK_VIDEO_SHOWCASE, 4));
      setShowcaseStatus('Loaded another set of TikTok links.');
      trackEvent('landing_showcase_refreshed', {
        source: 'fallback_tiktok_links',
      });
    } catch {
      setShowcaseStatus('Refresh failed. Please try again.');
      trackEvent('landing_showcase_refresh_failed', {});
    } finally {
      setIsRefreshingShowcase(false);
    }
  };

  const handleChatChange = (key, value) => {
    setChatError('');
    setChatSuccess('');
    setChatForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSendChatMessage = async () => {
    try {
      setChatSending(true);
      setChatError('');
      setChatSuccess('');
      await submitSupportMessage({
        name: chatForm.name,
        email: chatForm.email,
        message: chatForm.message,
      });
      trackEvent('landing_support_message_sent', {});
      setChatSuccess('Message sent. Our support team will contact you shortly.');
      setChatForm({ name: '', email: '', message: '' });
    } catch (error) {
      setChatError(error?.message || 'Failed to send message.');
      trackEvent('landing_support_message_failed', {
        error: error?.message || 'send_failed',
      });
    } finally {
      setChatSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      {showOfferModal ? (
        <OfferModal
          onClose={() => {
            setShowOfferModal(false);
          }}
        />
      ) : null}

      <Navbar />

      <section ref={heroSectionRef} className="relative overflow-hidden border-b border-white/8 px-4 pb-16 pt-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,197,94,0.12),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(34,197,94,0.08),transparent_24%),linear-gradient(180deg,#020202_0%,#070707_100%)]" />
        <div className="relative z-10 mx-auto grid w-full max-w-[1280px] gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
              Fresh ad examples across four major channels
            </div>

            <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
              Find winning ad creative faster across TikTok, Instagram, Facebook, and Google Ads.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 md:text-xl">
              Search proven ad examples, spot repeatable angles, score concepts before launch, and hand your team a clearer creative direction.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <SignUpButton mode="modal">
                <button
                  onClick={() => {
                    trackEvent('landing_start_with_starter_clicked', { plan_key: 'starter' });
                    storePendingCheckoutPlan('starter');
                  }}
                  className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
                >
                  Start With Starter
                </button>
              </SignUpButton>
              <a
                href="#library"
                className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                See the Library
              </a>
            </div>

          </div>

          <div className="grid items-center justify-center gap-4 lg:-mt-6">
            <div className="w-full max-w-xl rounded-[2rem] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Website CRO Check</p>
                  <h2 className="mt-1 text-lg font-semibold">Let's rate your website</h2>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Instant Preview
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                Paste your website URL and get a quick conversion-focused score preview before you create your account.
              </p>
              <div className="mt-5">
                <div
                  ref={stickyNoteRef}
                  onPointerDown={handleStickyPointerDown}
                  style={{ transform: `translate3d(${stickyOffset.x}px, ${stickyOffset.y}px, 0)` }}
                  className="noteHolder noteHolderHero active:cursor-grabbing"
                >
                  <input id="hero-fold-note" type="checkbox" className="noteFoldToggle" />
                  <div className="note rounded note-green">
                    <span className="heroNotePin heroNotePinLeft" />
                    <span className="heroNotePin heroNotePinRight" />
                    <div className="heroNoteBody">
                      <p className="heroNoteTitle">Website URL</p>
                      <div className="heroNoteInputRow">
                        <input
                          value={websiteUrl}
                          onChange={(event) => setWebsiteUrl(event.target.value)}
                          placeholder="https://yourwebsite.com"
                          className="heroNoteInput"
                        />
                        {websiteUrl.trim() ? (
                          <button
                            type="button"
                            onClick={() => setAnalysisOpen(true)}
                            className="heroNoteAnalyzeBtn"
                          >
                            Analyze
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="library" className="border-b border-white/8 bg-[#030303] py-16">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Ad Library</p>
            <h2 className="mt-2 text-3xl font-semibold">Browse visual examples before you commit budget.</h2>
            <p className="mt-3 text-base text-slate-400">
              A fast way to inspect creative direction, hooks, product presentation, and angle variety across categories.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRefreshShowcase}
                disabled={isRefreshingShowcase}
                className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-60"
              >
                {isRefreshingShowcase ? 'Refreshing...' : 'Refresh Showcase'}
              </button>
              {showcaseStatus ? <p className="text-xs text-slate-400">{showcaseStatus}</p> : null}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            {NICHES.map((niche) => (
              <button
                key={niche}
                onClick={() => setActiveNiche(niche)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeNiche === niche
                    ? 'bg-white text-black'
                    : 'border border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white'
                }`}
              >
                {niche}
              </button>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {previewCards.map((item) => (
              <LibraryPreviewCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-b border-white/8 bg-[#050505] py-14">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold md:text-4xl">See the workflow in one quick walkthrough.</h2>
            <p className="mt-3 text-base text-slate-400">
              We will place your product walkthrough video here. For now, this section is on standby and ready for a YouTube link.
            </p>
          </div>

          <div className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="aspect-video w-full bg-[radial-gradient(circle_at_18%_24%,rgba(34,197,94,0.16),transparent_36%),linear-gradient(180deg,#0a0a0a_0%,#050505_100%)] p-6 md:p-8">
              <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-emerald-300/30 bg-black/35 text-center">
                <div className="max-w-xl px-4">
                  <p className="text-sm font-semibold text-emerald-300">Video placeholder</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Standby mode: add your YouTube walkthrough link here and we will render it in this player section.
                  </p>
                  <p className="mt-3 text-xs text-slate-500">Example: https://www.youtube.com/watch?v=YOUR_VIDEO_ID</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-white/8 bg-black py-16">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Why teams use it</p>
            <h2 className="mt-2 text-4xl font-semibold leading-tight md:text-5xl">A clearer value proposition for creative research and planning.</h2>
            <p className="mt-3 text-base text-slate-400">
              ViralAdLibrary helps marketers move from inspiration to action with searchable examples, AI guidance, and faster reporting.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-[1.05fr_1fr_1.05fr]">
            <article className="group relative min-h-[420px] overflow-hidden rounded-sm border border-white/10">
              <img src={FEATURE_BLOCKS[0].image} alt={FEATURE_BLOCKS[0].title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
              <div className="absolute bottom-0 p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">Team Workflow</p>
                <h3 className="mt-2 text-2xl font-semibold">{FEATURE_BLOCKS[0].title}</h3>
                <p className="mt-2 text-sm text-slate-200">{FEATURE_BLOCKS[0].text}</p>
              </div>
            </article>

            <div className="grid gap-4">
              {[FEATURE_BLOCKS[1], FEATURE_BLOCKS[2]].map((item, index) => (
                <article key={item.title} className="group relative min-h-[202px] overflow-hidden rounded-sm border border-white/10">
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/15" />
                  <div className="absolute bottom-0 p-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Benefit {index + 1}</p>
                    <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs text-slate-200">{item.text}</p>
                  </div>
                </article>
              ))}
            </div>

            <article className="group relative min-h-[420px] overflow-hidden rounded-sm border border-white/10">
              <img src={FEATURE_BLOCKS[3].image} alt={FEATURE_BLOCKS[3].title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
              <div className="absolute bottom-0 p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">Execution</p>
                <h3 className="mt-2 text-2xl font-semibold">{FEATURE_BLOCKS[3].title}</h3>
                <p className="mt-2 text-sm text-slate-200">{FEATURE_BLOCKS[3].text}</p>
              </div>
            </article>
          </div>

        </div>
      </section>

      <section className="border-b border-white/8 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.14),transparent_55%),#050505] py-20">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
              Our Customers
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Our success stories</h2>
            <p className="mt-3 text-sm text-slate-400 md:text-base">
              Real teams share how they improved research speed, creative clarity, and campaign execution with ViralAdLibrary.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {TESTIMONIALS.map((person, index) => (
              <button
                key={person.name}
                type="button"
                onClick={() => setTestimonialIndex(index)}
                className={`h-11 w-11 overflow-hidden rounded-full border transition ${
                  index === testimonialIndex ? 'scale-110 border-emerald-300 ring-2 ring-emerald-400/40' : 'border-white/25 opacity-80 hover:opacity-100'
                }`}
              >
                <img src={person.avatar} alt={person.name} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>

          <div className="mt-8 grid items-stretch gap-4 md:grid-cols-[0.9fr_1.2fr_0.9fr]">
            <TestimonialSideCard item={previousTestimonial} />
            <article className="rounded-2xl border border-emerald-400/35 bg-gradient-to-b from-[#1a1413] to-[#110f0f] p-6 shadow-[0_14px_36px_rgba(0,0,0,0.38)]">
              <div className="flex items-center gap-3">
                <img src={currentTestimonial.avatar} alt={currentTestimonial.name} className="h-12 w-12 rounded-full object-cover ring-2 ring-emerald-400/40" />
                <div>
                  <p className="text-lg font-semibold text-white">{currentTestimonial.name}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                    {currentTestimonial.role} • {currentTestimonial.company}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1 text-amber-300">
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <span className="ml-2 text-sm text-white">{currentTestimonial.score}</span>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-100">"{currentTestimonial.quote}"</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {currentTestimonial.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
            <TestimonialSideCard item={nextTestimonial} />
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setTestimonialIndex((index) => (index - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]"
            >
              <ArrowLeftIcon />
            </button>
            <button
              type="button"
              onClick={() => setTestimonialIndex((index) => (index + 1) % TESTIMONIALS.length)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]"
            >
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-[#030303] py-16">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pricing</p>
            <h2 className="mt-2 text-3xl font-semibold">Choose the plan that matches your research depth and team needs.</h2>
            <p className="mt-3 text-base text-slate-400">
              Starter and Pro are self-serve. Agency is available through a sales conversation.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`relative rounded-sm border p-6 ${
                  plan.popular
                    ? 'border-emerald-400/40 bg-emerald-400/[0.06]'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                {plan.popular ? (
                  <div className="absolute right-4 top-4 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-black">
                    Popular
                  </div>
                ) : null}

                <p className="text-sm font-semibold text-white">{plan.name}</p>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-semibold text-white">${plan.price}</span>
                  <span className="pb-1 text-sm text-slate-400">/mo</span>
                </div>
                <p className="mt-3 text-sm text-slate-400">{plan.description}</p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">{plan.footnote}</p>

                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <span className="mt-0.5 text-emerald-300">+</span>
                      <span className="text-sm text-white/85">{feature}</span>
                    </div>
                  ))}
                </div>

                {plan.name === 'Agency' ? (
                  <a
                    href="mailto:sales@viraladlibrary.com?subject=Agency%20Plan%20Inquiry"
                    className={`mt-8 inline-flex w-full justify-center rounded-sm py-3 text-sm font-bold ${
                      plan.popular ? 'bg-emerald-400 text-black hover:bg-emerald-300' : 'bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <SignUpButton mode="modal">
                    <button
                      onClick={() => storePendingCheckoutPlan(plan.key)}
                      className={`mt-8 w-full rounded-sm py-3 text-sm font-bold ${
                        plan.popular ? 'bg-emerald-400 text-black hover:bg-emerald-300' : 'bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      {plan.cta}
                    </button>
                  </SignUpButton>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.1),transparent_48%),#050505] py-14">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-6">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3">
                <img src={logo} alt="ViralAdLibrary logo" className="h-14 w-14 rounded-full object-cover" />
                <h2 className="text-2xl font-semibold text-white">ViralAdLibrary</h2>
              </div>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                Ad research, AI scoring, and exportable reporting for modern growth teams that need better creative decisions faster.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href="#pricing" className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/20">
                  Start a plan
                </a>
                <a href="mailto:support@viraladlbrary.site" className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08]">
                  Contact support
                </a>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Product</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <a href="#library" className="block hover:text-white">Ad Library</a>
                <a href="#features" className="block hover:text-white">Features</a>
                <a href="#pricing" className="block hover:text-white">Pricing</a>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workflows</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <a href="/tiktok/trending" className="block hover:text-white">TikTok Trending</a>
                <a href="/website/cro-audit" className="block hover:text-white">Website CRO Audit</a>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Company</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <a href="mailto:sales@viraladlbrary.site" className="block hover:text-white">sales@viraladlbrary.site</a>
                <a href="mailto:support@viraladlbrary.site" className="block hover:text-white">support@viraladlbrary.site</a>
                <a href="tel:+263771472707" className="block hover:text-white">Calls/WhatsApp: +26377472707</a>
                <p className="pt-2 text-xs text-slate-500">Built for marketers, agencies, and performance teams.</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} ViralAdLibrary. All rights reserved.</p>
            <div className="flex flex-wrap gap-4">
              <a href="#" className="hover:text-slate-300">Privacy</a>
              <a href="#" className="hover:text-slate-300">Terms</a>
              <a href="#" className="hover:text-slate-300">Cookies</a>
            </div>
          </div>
        </div>
      </footer>

      <button
        type="button"
        onClick={() => {
          setChatOpen((prev) => !prev);
          trackEvent('landing_support_fab_clicked', { open: !chatOpen });
        }}
        className="fixed bottom-6 right-6 z-[85] rounded-full bg-emerald-400 px-5 py-3 text-sm font-bold text-black shadow-[0_12px_30px_rgba(16,185,129,0.45)] hover:bg-emerald-300"
      >
        {chatOpen ? 'Close chat' : 'Chat support'}
      </button>

      {chatOpen ? (
        <div className="fixed bottom-24 right-6 z-[95] w-[min(92vw,380px)] rounded-2xl border border-white/10 bg-[#080808] p-5 shadow-[0_16px_36px_rgba(0,0,0,0.45)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Contact support</h3>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="space-y-3">
            <input
              value={chatForm.name}
              onChange={(e) => handleChatChange('name', e.target.value)}
              placeholder="Your name"
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            />
            <input
              value={chatForm.email}
              onChange={(e) => handleChatChange('email', e.target.value)}
              placeholder="Your email"
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            />
            <textarea
              value={chatForm.message}
              onChange={(e) => handleChatChange('message', e.target.value)}
              placeholder="How can we help you?"
              rows={4}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            />
          </div>

          {chatError ? <p className="mt-3 text-sm text-rose-400">{chatError}</p> : null}
          {chatSuccess ? <p className="mt-3 text-sm text-emerald-300">{chatSuccess}</p> : null}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendChatMessage}
              disabled={chatSending}
              className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
            >
              {chatSending ? 'Sending...' : 'Send message'}
            </button>
            <a
              href="mailto:support@viraladlbrary.site"
              className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100"
            >
              Email directly
            </a>
          </div>
        </div>
      ) : null}

      {analysisOpen ? (
        <WebsiteAnalysisPreviewModal
          websiteUrl={websiteUrl}
          onClose={() => setAnalysisOpen(false)}
          onSeeMore={() => {
            storePendingOnboarding(websiteUrl);
          }}
        />
      ) : null}
    </div>
  );
}

function FeatureIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 12h14M12 5v14" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.9l-5.4 2.9 1-6.1L3.2 9.4l6.1-.9Z" />
    </svg>
  );
}

function TestimonialSideCard({ item }) {
  return (
    <article className="hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 opacity-45 blur-[0.2px] md:block">
      <div className="flex items-center gap-3">
        <img src={item.avatar} alt={item.name} className="h-10 w-10 rounded-full object-cover" />
        <div>
          <p className="text-sm font-semibold text-white">{item.name}</p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{item.company}</p>
        </div>
      </div>
      <p className="mt-4 line-clamp-4 text-sm text-slate-300">"{item.quote}"</p>
    </article>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OfferModal({ onClose }) {
  const [secondsLeft, setSecondsLeft] = useState(() => getOfferCountdownSecondsLeft());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft(getOfferCountdownSecondsLeft());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-sm border border-emerald-400/25 bg-[#050505] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400 hover:text-white"
        >
          Close
        </button>

        <div className="inline-flex items-center gap-2 rounded-full border border-[#E50004] bg-[#E50004] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-[0_0_26px_rgba(229,0,4,0.5)]">
          Breaking Offer
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div>
            <h2 className="text-3xl font-semibold leading-tight text-white">
              Our popular offer is now 30% off for early adopters.
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              Claim launch pricing now and get cheaper access to the Pro workflow while we are still opening a limited batch of accounts.
            </p>
          </div>

          <div className="rounded-sm border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Offer ends in</p>
            <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-emerald-300/35 bg-black/35 py-3 text-center">
              <p className="text-3xl font-bold text-white">{formatDuration(secondsLeft)}</p>
            </div>
            <p className="mt-4 text-xs text-slate-300">
              Popular launch deal: <span className="font-semibold text-white">30% off Pro</span>
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <SignUpButton mode="modal">
            <button
              onClick={() => {
                onClose();
              }}
              className="w-full rounded-full bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300"
            >
              Get Started
            </button>
          </SignUpButton>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/5"
          >
            Maybe Later
          </button>
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          Limited onboarding capacity. This message is shown once on your first visit.
        </p>
      </div>
    </div>
  );
}

function storePendingCheckoutPlan(planKey) {
  try {
    localStorage.removeItem('pending_app_flow');
    localStorage.removeItem('pending_website_url');
    localStorage.setItem('pending_checkout_plan', planKey);
  } catch {
    // Ignore storage errors and continue with auth flow.
  }
}

function storePendingOnboarding(websiteUrl = '') {
  try {
    localStorage.removeItem('pending_checkout_plan');
    localStorage.setItem('pending_app_flow', 'onboarding');
    if (String(websiteUrl || '').trim()) {
      localStorage.setItem('pending_website_url', String(websiteUrl).trim());
    } else {
      localStorage.removeItem('pending_website_url');
    }
  } catch {
    // Ignore storage errors and continue with auth flow.
  }
}

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getOfferCountdownSecondsLeft() {
  const deadline = getOfferCountdownDeadline();
  const remainingMs = Math.max(0, deadline - Date.now());
  return Math.floor(remainingMs / 1000);
}

function getOfferCountdownDeadline() {
  const KEY = 'launch_offer_deadline';
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  try {
    const stored = Number(localStorage.getItem(KEY) || 0);
    if (stored > Date.now()) {
      return stored;
    }
    const next = Date.now() + TWELVE_HOURS_MS;
    localStorage.setItem(KEY, String(next));
    return next;
  } catch {
    return Date.now() + TWELVE_HOURS_MS;
  }
}

function LibraryPreviewCard({ item }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [sourceMode, setSourceMode] = useState('proxy');
  const rawVideoUrl = String(item.videoStreamUrl || '').trim();
  const tiktokUrl = String(item.tiktokUrl || '').trim();
  const embedUrl = getTikTokEmbedUrl(tiktokUrl);
  const proxyVideoUrl = getPlayableVideoUrl(rawVideoUrl);
  const activeVideoUrl = sourceMode === 'proxy' ? proxyVideoUrl : rawVideoUrl;

  useEffect(() => {
    setVideoFailed(false);
    setSourceMode('proxy');
  }, [item.videoStreamUrl]);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
      <div className="group relative aspect-[9/16] w-full">
        {activeVideoUrl && !videoFailed ? (
          <video
            src={activeVideoUrl}
            muted
            playsInline
            autoPlay
            loop
            controls
            preload="metadata"
            poster={item.image || item.thumbnail || undefined}
            onError={() => {
              if (sourceMode === 'proxy' && rawVideoUrl) {
                setSourceMode('direct');
                return;
              }
              setVideoFailed(true);
            }}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : embedUrl ? (
          <iframe
            src={embedUrl}
            title={item.headline || 'TikTok video'}
            className="h-full w-full overflow-hidden border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            scrolling="no"
            allowFullScreen
          />
        ) : item.image || item.thumbnail ? (
          <img
            src={item.image || item.thumbnail}
            alt={item.headline}
            onError={(event) => {
              event.currentTarget.src = 'https://placehold.co/720x1280/0f172a/e2e8f0?text=TikTok+Preview';
            }}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-[#0f172a]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        <div className="absolute right-3 top-3 rounded-full border border-lime-400/40 bg-black/65 px-3 py-1 text-xs font-bold text-lime-300">
          {item.viralScore} Viral Score
        </div>

        <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
          {item.platform}
        </div>

        <div className="absolute bottom-0 w-full p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300">{item.niche}</p>
          <h3 className="mt-1 line-clamp-1 text-base font-semibold text-white">{item.brand}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-200">{item.headline}</p>
        </div>
      </div>
    </article>
  );
}

function getPlayableVideoUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return `${API_URL}/api/search/stream?url=${encodeURIComponent(raw)}`;
}

function getTikTokEmbedUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/\/video\/(\d+)/);
  if (!match?.[1]) return '';
  return `https://www.tiktok.com/player/v1/${match[1]}?autoplay=1&loop=1&controls=1&description=0&music_info=0`;
}

function readHomepageShowcaseVideos() {
  try {
    const raw = localStorage.getItem('tiktok_recent_results');
    const parsed = raw ? JSON.parse(raw) : [];
    const recent = Array.isArray(parsed) ? parsed : [];

    const mapped = recent
      .map((item, index) => ({
        id: item.id || item.url || `recent-${index}`,
        platform: inferPlatformLabel(item),
        brand: item.author || item.brand || 'For You pick',
        headline: item.caption || item.desc || item.text || 'Creative example',
        viralScore: Number(item.viralScore || item.virality_score || [98, 94, 91, 89][index] || 90),
        thumbnail: item.thumbnail || item.cover || item.covers?.default || '',
        videoStreamUrl: resolveVideoStreamUrl(item),
      }));

    return mapped.length ? pickRandomItems(mapped, 4) : pickRandomItems(FALLBACK_VIDEO_SHOWCASE, 4);
  } catch {
    return pickRandomItems(FALLBACK_VIDEO_SHOWCASE, 4);
  }
}

function pickLandingShowcaseVideos(dbVideos = [], isSignedIn = false) {
  const fallback = isSignedIn ? pickRandomItems(FALLBACK_VIDEO_SHOWCASE, 4) : readHomepageShowcaseVideos();
  const normalizedDb = Array.isArray(dbVideos) ? dbVideos : [];
  const usableDb = normalizedDb.filter((item) => {
    const stream = resolveVideoStreamUrl(item);
    const thumb = item?.thumbnail || item?.cover || item?.covers?.default || '';
    return Boolean(stream || thumb);
  });

  if (!usableDb.length) {
    return fallback;
  }

  const randomizedDb = pickRandomItems(usableDb, 4);
  if (randomizedDb.length >= 4) {
    return randomizedDb;
  }

  const existingIds = new Set(randomizedDb.map((item) => String(item.id || item.url || item.tiktok_url || '')));
  const merged = [...randomizedDb];
  for (const item of fallback) {
    const key = String(item.id || item.url || item.tiktok_url || '');
    if (!existingIds.has(key)) {
      merged.push(item);
    }
    if (merged.length >= 4) break;
  }
  return merged.slice(0, 4);
}

function pickRandomItems(items = [], count = 4) {
  const list = Array.isArray(items) ? [...items] : [];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, count);
}

function normalizeLandingRecentVideo(item = {}, index = 0) {
  const stream = resolveVideoStreamUrl(item);
  return {
    id: item.id || item.video_id || item.url || `landing-refresh-${index}`,
    url: item.url || item.tiktok_url || '',
    tiktok_url: item.tiktok_url || item.url || '',
    thumbnail: item.thumbnail || item.cover || item.covers?.default || '',
    caption: item.caption || item.desc || item.text || '',
    author: item.author || item.authorMeta?.name || '',
    views: Number(item.views || item.playCount || item.stats?.playCount || 0),
    likes: Number(item.likes || item.diggCount || item.stats?.diggCount || 0),
    videoStreamUrl: stream,
    video_stream_url: stream,
  };
}

function readLastTikTokSearch() {
  try {
    const raw = localStorage.getItem('tiktok_last_search');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function inferPlatformLabel(item = {}) {
  const source = String(item.platform || item.source || item.network || '').toLowerCase();
  if (source.includes('instagram')) return 'Instagram';
  if (source.includes('facebook')) return 'Facebook';
  if (source.includes('google')) return 'Google Ads';
  return 'TikTok';
}

function resolveVideoStreamUrl(item = {}) {
  const candidates = [
    item.videoStreamUrl,
    item.video_stream_url,
    item.videoUrl,
    item.play_url,
    item.playAddr,
    item.downloadAddr,
    item.videoMeta?.downloadAddr,
    item.videoMeta?.playAddr,
    item.video?.playAddr,
    item.video?.downloadAddr,
    item.video?.play_addr?.url_list?.[0],
    item.video?.download_addr?.url_list?.[0],
    item.play_addr?.url_list?.[0],
    item.download_addr?.url_list?.[0],
    item.media?.video?.url,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      const trimmed = value.trim();
      if (isApifyArtifactUrl(trimmed)) continue;
      return trimmed;
    }
  }

  return '';
}

function isApifyArtifactUrl(value = '') {
  const url = String(value || '').toLowerCase();
  return url.includes('api.apify.com/v2/key-value-stores/') || url.includes('/records/video-');
}

function inferNicheFromText(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('skin') || text.includes('serum') || text.includes('shop')) return 'E-commerce';
  if (text.includes('saas') || text.includes('work') || text.includes('lead')) return 'SaaS';
  if (text.includes('health') || text.includes('mobility') || text.includes('protein')) return 'Health';
  if (text.includes('charger') || text.includes('tech')) return 'Tech';
  return 'Featured';
}

export default Landing;
