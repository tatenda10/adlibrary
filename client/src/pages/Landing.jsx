import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar.jsx';
import { SiteFooter } from '../components/layout/SiteFooter.jsx';
import { PlayingCardFan } from '../components/ui/PlayingCardFan.jsx';
import { MOCK_ADS } from '../lib/mock-data.js';
import {
  API_URL,
} from '../lib/api.js';
import { PRICING_PLANS } from '../lib/pricingPlans.js';
import { submitSupportMessage } from '../lib/api.js';
import { trackEvent } from '../lib/firebaseAnalytics.js';
import { trackMetaViewContent } from '../lib/metaPixel.js';

const NICHES = ['All', 'E-commerce', 'SaaS', 'Health', 'Tech', 'Fintech'];

const HERO_FAN_CARDS = [
  { id: 'ace-spades', rank: 'A', suit: 'spades' },
  { id: 'king-hearts', rank: 'K', suit: 'hearts' },
  { id: 'queen-diamonds', rank: 'Q', suit: 'diamonds' },
  { id: 'jack-clubs', rank: 'J', suit: 'clubs' },
  { id: 'ten-hearts', rank: '10', suit: 'hearts' },
  { id: 'ace-diamonds', rank: 'A', suit: 'diamonds' },
  { id: 'nine-spades', rank: '9', suit: 'spades' },
];

const CROSS_POST_METRICS = [
  { id: 'tiktok', name: 'TikTok', views: '532.1k', likes: '89.9k', position: 'left-0 top-[18%] md:-left-4 lg:-left-16' },
  { id: 'instagram', name: 'Instagram', views: '1.2m', likes: '150.2k', position: 'right-0 top-[38%] md:-right-4 lg:-right-20' },
  { id: 'youtube', name: 'YouTube', views: '340.9k', likes: '75.5k', position: 'bottom-[18%] left-0 md:-left-2 lg:-left-12' },
];

const CROSS_POST_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80',
];

const UGC_SHOWCASE_CARDS = [
  {
    id: 'human-ugc',
    name: 'Jess',
    kind: 'Human UGC',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=900&q=80',
    caption: "i didn't know this product could actually calm me down in minutes",
    captionStyle: 'plain',
    views: '36.3m',
    likes: '29.4k',
  },
  {
    id: 'ai-ugc',
    name: 'Nova AI',
    kind: 'AI UGC',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=80',
    caption: '7 hooks that make your ads look insanely competent (save these)',
    captionStyle: 'boxed',
    views: '495.9k',
    likes: '23.4k',
  },
  {
    id: 'ai-influencer',
    name: 'Mira',
    kind: 'AI Influencer',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
    caption: 'POV: your AI creator posts daily while you sleep',
    captionStyle: 'plain',
    views: '228k',
    likes: '5.3k',
  },
  {
    id: 'human-demo',
    name: 'Marcus',
    kind: 'Human UGC',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80',
    caption: 'watch me unbox the exact creative that converted at 4.2%',
    captionStyle: 'boxed',
    views: '170k',
    likes: '2.4k',
  },
  {
    id: 'ai-character',
    name: 'Ayo',
    kind: 'AI Influencer',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80',
    caption: 'same face. same vibe. every short-form video.',
    captionStyle: 'plain',
    views: '111k',
    likes: '1.8k',
  },
  {
    id: 'meme-ugc',
    name: 'Voltage',
    kind: 'AI UGC',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    image: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=900&q=80',
    caption: 'when your competitor posts once a week and you ship 30 days overnight',
    captionStyle: 'boxed',
    views: '89.2k',
    likes: '4.1k',
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
    quote: 'Before this, our Monday planning calls were honestly a mess. Now we walk in with examples everyone can react to, pick a direction faster, and stop going in circles.',
    name: 'Thandiwe Moyo',
    role: 'Performance Marketing Lead',
    tags: ['DTC', 'Creative Ops'],
    score: '5.0',
  },
  {
    quote: 'The biggest change was how much easier feedback became. Instead of vague comments like "make it stronger," we can point to references and the first round is usually much closer.',
    name: 'Liam Carter',
    role: 'Creative Strategy Manager',
    tags: ['Agency', 'Planning'],
    score: '5.0',
  },
  {
    quote: 'Saved collections ended up being the thing our team used most. We stopped dumping random screenshots in Slack and started keeping ideas in one place we could actually come back to.',
    name: 'Marcus Johnson',
    role: 'Senior Growth Manager',
    tags: ['SaaS', 'Reporting'],
    score: '5.0',
  },
  {
    quote: 'As a founder, I mostly wanted fewer expensive guesses. This helped me spot stronger creative ideas earlier, and we wasted a lot less money testing things that were never going to land.',
    name: 'Sophie Dubois',
    role: 'Founder',
    tags: ['E-commerce', 'Launch'],
    score: '4.9',
  },
  {
    quote: 'We juggle multiple clients, so research can get messy fast. This made the weekly strategy pass feel a lot lighter and gave the team a cleaner starting point every time.',
    name: 'Ethan Walker',
    role: 'Media Buying Director',
    tags: ['Media Buying', 'Scale'],
    score: '5.0',
  },
];

function Landing() {
  const [activeNiche, setActiveNiche] = useState('All');
  const [showOfferModal, setShowOfferModal] = useState(true);
  const [showcaseVideos, setShowcaseVideos] = useState(() => pickRandomItems(FALLBACK_VIDEO_SHOWCASE, 4));
  const [isRefreshingShowcase, setIsRefreshingShowcase] = useState(false);
  const [showcaseStatus, setShowcaseStatus] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatSuccess, setChatSuccess] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatForm, setChatForm] = useState({ name: '', email: '', message: '' });
  const [testimonialIndex, setTestimonialIndex] = useState(2);

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
    trackMetaViewContent({
      content_name: 'landing',
      content_category: 'marketing',
    });
  }, []);

  useEffect(() => {
    if (!showcaseStatus) return undefined;
    const timer = window.setTimeout(() => setShowcaseStatus(''), 2600);
    return () => window.clearTimeout(timer);
  }, [showcaseStatus]);

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

      <section className="relative overflow-hidden border-b border-white/8 px-4 pb-16 pt-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,197,94,0.12),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(34,197,94,0.08),transparent_24%),linear-gradient(180deg,#020202_0%,#070707_100%)]" />
        <div className="relative z-10 mx-auto grid w-full max-w-[1280px] gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
              Research, create, and publish in one place
            </div>

            <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
              Turn winning ads into content you can ship every week.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 md:text-xl">
              Find proven creative, generate AI UGC and influencer videos for your brand, then schedule and post across TikTok, Instagram, YouTube, and LinkedIn.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/sign-up"
                onClick={() => {
                  trackEvent('landing_start_with_starter_clicked', { plan_key: 'starter' });
                  storePendingCheckoutPlan('starter');
                }}
                className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
              >
                Start With Starter
              </Link>
              <a
                href="#library"
                className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                See the Library
              </a>
            </div>
          </div>

          <div className="relative mx-auto h-[360px] w-full max-w-xl overflow-hidden lg:h-[420px]">
            <PlayingCardFan cards={HERO_FAN_CARDS} cardWidth={108} />
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

      <section id="testimonials" className="border-b border-white/8 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.14),transparent_55%),#050505] py-20">
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
                className={`rounded-full border px-4 py-2 text-left transition ${
                  index === testimonialIndex
                    ? 'scale-105 border-emerald-300 bg-emerald-400/10 text-white ring-2 ring-emerald-400/30'
                    : 'border-white/15 bg-white/[0.03] text-slate-300 hover:border-white/30 hover:text-white'
                }`}
              >
                <span className="block text-sm font-semibold">{person.name}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 grid items-stretch gap-4 md:grid-cols-[0.9fr_1.2fr_0.9fr]">
            <TestimonialSideCard item={previousTestimonial} />
            <article className="rounded-2xl border border-emerald-400/35 bg-gradient-to-b from-[#1a1413] to-[#110f0f] p-6 shadow-[0_14px_36px_rgba(0,0,0,0.38)]">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full border border-emerald-400/35 bg-emerald-400/10 text-sm font-bold text-emerald-200">
                  {getInitials(currentTestimonial.name)}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{currentTestimonial.name}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                    {currentTestimonial.role}
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

      {/*
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
      */}

      {/* Native publishing — post across platforms */}
      <section id="features" className="border-b border-white/8 bg-[#030303] py-20">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/90">Publish</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Post across every social platform
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-400 md:text-lg">
              Connect accounts and publish the same winning creative to TikTok, Instagram Reels, YouTube Shorts, and LinkedIn.
            </p>
          </div>

          <CrossPlatformPublishVisual />
        </div>
      </section>

      {/* Content calendar — Fastlane-style mockup + copy */}
      <section id="content-calendar" className="border-b border-white/8 bg-[#030303] py-16 md:py-24">
        <div className="mx-auto grid w-full max-w-[1280px] items-center gap-10 px-4 md:px-6 lg:grid-cols-2 lg:gap-0">
          <div className="relative lg:pr-12">
            <div className="absolute inset-0 overflow-hidden rounded-sm">
              <img
                src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1400&q=80"
                alt=""
                className="h-full w-full scale-110 object-cover opacity-50 blur-md"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-amber-900/40 via-transparent to-emerald-950/50" />
            </div>
            <div className="relative p-4 sm:p-6 md:p-8">
              <CalendarMockup />
            </div>
          </div>

          <div className="relative flex flex-col justify-center lg:border-l lg:border-emerald-400/50 lg:pl-12">
            <p className="text-sm font-medium text-slate-500">03</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
              Fill up your calendar
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-slate-400 md:text-lg">
              Schedule content across TikTok, IG Reels, YT Shorts, and LinkedIn in one click.
            </p>
          </div>
        </div>
      </section>

      {/* AI + Human UGC showcase — phone cards */}
      <section id="ai-ugc" className="border-b border-white/8 bg-[#030303] py-20">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/90">Create</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              AI UGC, influencers & human creators
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-400 md:text-lg">
              Generate AI UGC, keep a consistent AI influencer, or pull from a human UGC library — then ship it.
            </p>
          </div>

          <UgcShowcaseCarousel />
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
                  <Link
                    to="/sign-up"
                    onClick={() => storePendingCheckoutPlan(plan.key)}
                    className={`mt-8 inline-flex w-full justify-center rounded-sm py-3 text-sm font-bold ${
                      plan.popular ? 'bg-emerald-400 text-black hover:bg-emerald-300' : 'bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />

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
    </div>
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
        <div className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-xs font-bold text-slate-200">
          {getInitials(item.name)}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{item.name}</p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{item.role}</p>
        </div>
      </div>
      <p className="mt-4 line-clamp-4 text-sm text-slate-300">"{item.quote}"</p>
    </article>
  );
}

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
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
            <p className="mt-2 text-xs text-slate-300">
              Promo code: <span className="rounded-full border border-emerald-300/35 bg-black/35 px-2 py-1 font-bold tracking-[0.14em] text-emerald-200">EARLYBIRD</span>
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/sign-up"
            onClick={() => {
              onClose();
            }}
            className="w-full rounded-full bg-emerald-400 px-4 py-3 text-center text-sm font-bold text-slate-950 hover:bg-emerald-300"
          >
            Get Started
          </Link>
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

function CrossPlatformPublishVisual() {
  return (
    <div className="mt-14">
      <div className="relative mx-auto flex max-w-[720px] justify-center px-2 py-8 md:px-10 md:py-12">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/20 blur-[70px]" />

        <div className="relative z-10 w-[min(100%,280px)] sm:w-[300px]">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 shadow-[0_0_60px_rgba(16,185,129,0.28)]">
            <div className="relative aspect-[9/16]">
              <img
                src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=900&q=80"
                alt="Cross-posted creative example"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/55" />
              <p className="absolute inset-x-5 top-[42%] -translate-y-1/2 text-center text-xl font-bold leading-snug text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] sm:text-2xl">
                3 years researching ads and NOW i find this??
              </p>
              <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 text-white/90">
                <HandTapIcon />
                <span className="h-5 w-px bg-white/30" />
                <MenuLinesIcon />
              </div>
            </div>
          </div>
        </div>

        {CROSS_POST_METRICS.map((metric) => (
          <div
            key={metric.id}
            className={`absolute z-20 ${metric.position}`}
          >
            <PlatformMetricPill metric={metric} />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <div className="flex -space-x-2">
          {CROSS_POST_AVATARS.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              className="h-9 w-9 rounded-full border-2 border-[#030303] object-cover"
            />
          ))}
        </div>
        <p className="text-sm text-slate-400">
          Teams already researching with <span className="font-semibold text-white">ViralAdLibrary</span>
        </p>
      </div>
    </div>
  );
}

function PlatformMetricPill({ metric }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111]/95 px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <PlatformBrandIcon platform={metric.id} />
      <div className="flex items-center gap-3 text-xs font-semibold text-white sm:text-sm">
        <span className="inline-flex items-center gap-1">
          <EyeIcon />
          {metric.views}
        </span>
        <span className="inline-flex items-center gap-1">
          <HeartIcon />
          {metric.likes}
        </span>
      </div>
    </div>
  );
}

function PlatformBrandIcon({ platform }) {
  if (platform === 'tiktok') {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-black">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M14.5 3c.5 2.4 1.9 4 4.2 4.4v2.3c-1.5-.1-2.9-.6-4-1.5v6.5a5.3 5.3 0 1 1-5.3-5.3c.3 0 .6 0 .9.1v2.5a2.8 2.8 0 1 0 2 2.7V3h2.2Z" />
        </svg>
      </span>
    );
  }
  if (platform === 'youtube') {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ff0033] text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15.2V8.8L15.5 12 10 15.2Z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

function HandTapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 11V7.5a1.5 1.5 0 0 1 3 0V11" strokeLinecap="round" />
      <path d="M11 10.5V6.8a1.5 1.5 0 0 1 3 0V11" strokeLinecap="round" />
      <path d="M14 10.8V8.5a1.5 1.5 0 0 1 3 0V14c0 3-2 5-5 5H9.5C6.5 19 5 17 5 14.5V12a1.5 1.5 0 0 1 3 0v-1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuLinesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 8h14M5 12h14M5 16h14" strokeLinecap="round" />
    </svg>
  );
}

function UgcShowcaseCarousel() {
  const [index, setIndex] = useState(0);
  const maxIndex = Math.max(0, UGC_SHOWCASE_CARDS.length - 3);
  const visible = UGC_SHOWCASE_CARDS.slice(index, index + 3);

  return (
    <div className="relative mt-12">
      <div className="grid gap-5 md:grid-cols-3">
        {visible.map((card, cardIndex) => (
          <UgcPhoneCard key={card.id} card={card} showArrows={cardIndex === 1} onPrev={() => setIndex((v) => Math.max(0, v - 1))} onNext={() => setIndex((v) => Math.min(maxIndex, v + 1))} />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Previous showcase cards"
          onClick={() => setIndex((v) => Math.max(0, v - 1))}
          disabled={index === 0}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 text-white disabled:opacity-35"
        >
          <ChevronIcon direction="left" />
        </button>
        <button
          type="button"
          aria-label="Next showcase cards"
          onClick={() => setIndex((v) => Math.min(maxIndex, v + 1))}
          disabled={index >= maxIndex}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 text-white disabled:opacity-35"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>
    </div>
  );
}

function UgcPhoneCard({ card, showArrows = false, onPrev, onNext }) {
  return (
    <article className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#111] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
      <div className="relative aspect-[9/16]">
        <img src={card.image} alt={card.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/70" />

        <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-2.5">
          <img src={card.avatar} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/30" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-white">{card.name}</p>
              <span className="text-xs text-white/70">({card.kind})</span>
              <VerifiedBadge />
            </div>
          </div>
        </div>

        <div className="absolute inset-x-4 top-[42%] z-10 -translate-y-1/2">
          {card.captionStyle === 'boxed' ? (
            <div className="space-y-2">
              {card.caption.split('(').map((part, i) => {
                const text = i === 0 ? part.trim() : `(${part.trim()}`;
                if (!text) return null;
                return (
                  <p
                    key={`${card.id}-cap-${i}`}
                    className="inline-block max-w-full rounded-md bg-white px-2.5 py-1.5 text-sm font-bold leading-snug text-black"
                  >
                    {text}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-lg font-semibold leading-snug text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {card.caption}
            </p>
          )}
        </div>

        {showArrows ? (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={onPrev}
              className="absolute left-2 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm"
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={onNext}
              className="absolute right-2 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm"
            >
              <ChevronIcon direction="right" />
            </button>
          </>
        ) : null}

        <div className="absolute bottom-4 right-4 z-10 space-y-3 text-right text-white">
          <div className="flex items-center justify-end gap-1.5 text-sm font-semibold">
            <EyeIcon />
            <span>{card.views}</span>
          </div>
          <div className="flex items-center justify-end gap-1.5 text-sm font-semibold">
            <HeartIcon />
            <span>{card.likes}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function VerifiedBadge() {
  return (
    <span className="grid h-4 w-4 place-items-center rounded-full bg-[#1d9bf0] text-white">
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2.5 6.2 4.8 8.5 9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20s-7-4.4-9.2-8.2C1 8.8 2.8 5.5 6.2 5.1c2-.2 3.6.9 4.8 2.3 1.2-1.4 2.8-2.5 4.8-2.3 3.4.4 5.2 3.7 3.4 6.7C19 15.6 12 20 12 20Z" />
    </svg>
  );
}

function ChevronIcon({ direction = 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${direction === 'left' ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CALENDAR_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CALENDAR_POSTS = {
  1: [{ platform: 'tiktok', label: 'TikTok Video', time: '1:00 PM' }],
  2: [
    { platform: 'youtube', label: 'YouTube Shorts', time: '11:30 AM' },
    { platform: 'instagram', label: 'IG Reel', time: '4:15 PM' },
  ],
  3: [{ platform: 'tiktok', label: 'TikTok Video', time: '9:00 AM' }],
  4: [
    { platform: 'linkedin', label: 'LinkedIn Post', time: '10:00 AM' },
    { platform: 'youtube', label: 'YouTube Shorts', time: '2:45 PM' },
  ],
  5: [{ platform: 'instagram', label: 'IG Reel', time: '6:00 PM' }],
  6: [
    { platform: 'tiktok', label: 'TikTok Video', time: '12:00 PM' },
    { platform: 'youtube', label: 'YouTube Shorts', time: '3:30 PM' },
  ],
  7: [{ platform: 'instagram', label: 'IG Reel', time: '5:00 PM' }],
  8: [
    { platform: 'tiktok', label: 'TikTok Video', time: '8:30 AM' },
    { platform: 'linkedin', label: 'LinkedIn Post', time: '1:00 PM' },
  ],
  9: [{ platform: 'youtube', label: 'YouTube Shorts', time: '4:00 PM' }],
  10: [
    { platform: 'instagram', label: 'IG Reel', time: '11:00 AM' },
    { platform: 'tiktok', label: 'TikTok Video', time: '7:00 PM' },
  ],
  11: [{ platform: 'youtube', label: 'YouTube Shorts', time: '2:00 PM' }],
  12: [
    { platform: 'tiktok', label: 'TikTok Video', time: '10:30 AM' },
    { platform: 'instagram', label: 'IG Reel', time: '3:00 PM' },
  ],
  13: [{ platform: 'linkedin', label: 'LinkedIn Post', time: '9:15 AM' }],
  14: [
    { platform: 'youtube', label: 'YouTube Shorts', time: '1:45 PM' },
    { platform: 'tiktok', label: 'TikTok Video', time: '5:30 PM' },
  ],
};

const PLATFORM_STYLES = {
  tiktok: 'bg-neutral-100 text-neutral-800',
  youtube: 'bg-rose-50 text-rose-700',
  instagram: 'bg-sky-50 text-sky-700',
  linkedin: 'bg-blue-50 text-blue-700',
};

function CalendarMockup() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#f4f4f5] shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-white text-neutral-700 shadow-sm">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M8 3v4M16 3v4M3 10h18" />
            </svg>
          </span>
          <p className="text-sm font-semibold text-neutral-900">March 2026</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-neutral-600">
          <span className="inline-flex items-center gap-1.5">
            <CalendarStatIcon kind="check" /> 19
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarStatIcon kind="hot" /> 6
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarStatIcon kind="stack" /> 67
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-black/5 bg-white/70 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        {CALENDAR_DAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-black/5 p-px">
        {Array.from({ length: 14 }, (_, index) => {
          const day = index + 1;
          const posts = CALENDAR_POSTS[day] || [];
          return (
            <div key={day} className="min-h-[88px] bg-[#f7f7f8] p-1.5 sm:min-h-[104px]">
              <p className="mb-1 text-[10px] font-semibold text-neutral-400">{day}</p>
              <div className="space-y-1">
                {posts.map((post) => (
                  <div
                    key={`${day}-${post.label}-${post.time}`}
                    className={`rounded-md px-1.5 py-1 ${PLATFORM_STYLES[post.platform]}`}
                  >
                    <p className="truncate text-[9px] font-semibold leading-tight sm:text-[10px]">{post.label}</p>
                    <p className="text-[8px] opacity-70 sm:text-[9px]">{post.time}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-xs font-semibold text-neutral-700 shadow-lg backdrop-blur">
        <span className="inline-flex items-center gap-1.5">
          <CalendarStatIcon kind="check" /> 19
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarStatIcon kind="hot" /> 6
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarStatIcon kind="stack" /> 67
        </span>
      </div>
    </div>
  );
}

function CalendarStatIcon({ kind }) {
  if (kind === 'check') {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'hot') {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-orange-500" fill="currentColor">
        <path d="M8 1.5c.4 1.8-.4 3 1 4.4 1.2 1.2 2 2.4 2 4 0 2.1-1.6 3.6-3.5 3.6S4 12 4 9.9c0-1.5.7-2.7 1.7-3.9.7-.8 1.3-1.7 1.5-2.9.1-.5.4-1.1.8-1.6Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="3.5" width="11" height="3" rx="0.8" />
      <rect x="2.5" y="7.5" width="11" height="3" rx="0.8" />
      <rect x="2.5" y="11.5" width="11" height="2" rx="0.8" />
    </svg>
  );
}

export default Landing;
