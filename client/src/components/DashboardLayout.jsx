import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';

const railItems = [
  // { key: 'overview', label: 'Overview', to: '/app', icon: HomeIcon },
  { key: 'website', label: 'Website', to: '/website/cro-audit', icon: WebsiteIcon },
  { key: 'tiktok', label: 'TikTok', to: '/tiktok/trending', icon: TikTokIcon },
  { key: 'facebook', label: 'Facebook', to: '/facebook/ads', icon: FacebookIcon },
  { key: 'instagram', label: 'Instagram', to: '/instagram/posts', icon: InstagramIcon },
  { key: 'tutorial', label: 'Tutorial', to: '/tutorial', icon: TutorialIcon },
  // { key: 'articles', label: 'Articles', to: '/articles', icon: ArticlesIcon },
  { key: 'settings', label: 'Settings', to: '/settings', icon: SettingsIcon },
];

const tikTokTabs = [
  { label: 'Trending', to: '/tiktok/trending', icon: TrendIcon, description: 'Keyword search for TikTok videos and ad angles.' },
  { label: 'Hot Takes', to: '/tiktok/hot-takes', icon: TrendIcon, description: 'TikTok Creative Center top ads by country, industry, and filters.' },
  { label: 'Creators', to: '/tiktok/creators', icon: FollowersIcon, description: 'Trending creators by followers, engagement, or avg views — cached with follower bands.' },
  // { label: 'Trending Hashtags', to: '/tiktok/trending-hashtags', icon: TrendIcon, description: 'Industry hashtags from Creative Center for niche and category trends.' },
  { label: 'Hook Library', to: '/tiktok/hooks', icon: SparkIcon, description: 'Opening lines and scroll-stopping hook ideas.' },
  { label: 'Trending Music', to: '/tiktok/trending-music', icon: MusicIcon, description: 'Daily chart plus trending sounds by country.' },
  { label: 'Predictor', to: '/tiktok/predictor', icon: SignalIcon, description: 'Early signals for likely breakout concepts.' },
  { label: 'Workspace', to: '/tiktok/workspace', icon: WorkspaceIcon, description: 'Save TikTok links in folders to review and play later.' },
  // { label: 'Saved', to: '/tiktok/saved', icon: BookmarkMiniIcon, description: 'Collected TikTok winners to revisit later.' },
  // { label: 'For You', to: '/tiktok/for-you', icon: SparkIcon, description: 'A personalized stream tuned to your brand.' },
  // { label: 'Searched', to: '/tiktok/collections', icon: FolderIcon, description: 'Open folders for saved TikTok searches and revisit the results.' },
];

const settingsTabs = [
  { label: 'Billing', to: '/billing', icon: CardIcon, description: 'Plan details, usage, and invoices.' },
  { label: 'Profile', to: '/settings', icon: PaletteIcon, description: 'Theme, defaults, and profile behavior.' },
];

const singleSectionTabs = {
  overview: [
    { label: 'Dashboard', to: '/app', icon: HomeIcon, description: 'Market trends, official platform updates, and key headlines in one view.' },
  ],
  tutorial: [
    { label: 'App Tutorial', to: '/tutorial', icon: TutorialIcon, description: 'Learn what each section of the app is for and when to use it.' },
  ],
  website: [
    { label: 'Website Research', to: '/website/cro-audit', icon: WebsiteIcon, description: 'Run a fresh CRO audit for any website.' },
    // { label: 'Competitor Radar', to: '/app/competitor-radar', icon: DecisionIcon, description: 'Map competitors, offers, websites, and audience clues while reviewing your market.' },
    // { label: 'Saved Audits', to: '/website/saved', icon: BookmarkMiniIcon, description: 'Reopen CRO audits saved to your account.' },
  ],
  facebook: [
    { label: 'Ads', to: '/facebook/ads', icon: TrendIcon, description: 'Browse Facebook ad results and creative angles.' },
    { label: 'Trending Music', to: '/facebook/trending-music', icon: MusicIcon, description: 'Explore music-led Facebook creative angles and audio inspiration.' },
    { label: 'Hook Generator', to: '/facebook/hook-generator', icon: SparkIcon, description: 'Generate Facebook hooks, headlines, CTAs, and primary ad copy from your brief.' },
    // { label: 'Workspace', to: '/facebook/workspace', icon: WorkspaceIcon, description: 'Save Facebook post and video links in folders.' },
    // { label: 'Groups', to: '/facebook/groups', icon: GroupIcon, description: 'Search Facebook groups by niche and community topic.' },
    // { label: 'Followers', to: '/facebook/followers', icon: FollowersIcon, description: 'Inspect followers and following from public page or profile URLs.' },
  ],
  instagram: [
    { label: 'Posts', to: '/instagram/posts', icon: GridIcon, description: 'Browse public Instagram profile posts for creative inspiration.' },
    { label: 'Reels', to: '/instagram/reels', icon: ReelIcon, description: 'Use the reel scraper to pull reel-first creative examples.' },
    { label: 'Trending', to: '/instagram/trending', icon: TrendIcon, description: 'Scrape and cache top posts by hashtag for trend research.' },
    { label: 'Workspace', to: '/instagram/workspace', icon: WorkspaceIcon, description: 'Save Instagram post and reel links in folders.' },
  ],
  articles: [{ label: 'Incoming Stories', to: '/articles', icon: ArticlesIcon, description: 'Read published market research and incoming stories.' }],
  google: [{ label: 'Search & Display', to: '/google-ads', icon: GoogleIcon, description: 'Research copy patterns across Google inventory.' }],
  reddit: [{ label: 'Community Ads', to: '/reddit', icon: RedditIcon, description: 'Study conversational ad creative and angles.' }],
};

const sectionMeta = {
  overview: { eyebrow: 'Intelligence', title: 'Marketing dashboard', description: 'Track trend lines, official updates, and what is moving right now before diving deeper.' },
  tutorial: { eyebrow: 'Guide', title: 'App tutorial', description: 'See what each area of the app does before you start using the tools.' },
  website: { eyebrow: 'Website', title: 'Website CRO', description: 'Run fresh website audits and reopen saved CRO reviews from one place.' },
  tiktok: { eyebrow: 'Platform', title: 'TikTok intelligence', description: 'Trend discovery, hooks, audio, and prediction tools live together here.' },
  facebook: { eyebrow: 'Platform', title: 'Facebook research', description: 'Search ads, trending music, and hooks from one Facebook workspace.' },
  instagram: { eyebrow: 'Platform', title: 'Instagram inspiration', description: 'Keep the main Instagram workspace focused on swipe-worthy posts and reels.' },
  articles: { eyebrow: 'Content', title: 'Articles', description: 'Incoming stories and market research for your team.' },
  google: { eyebrow: 'Platform', title: 'Google Ads research', description: 'A tighter workspace for search, display, and keyword-led inspiration.' },
  reddit: { eyebrow: 'Platform', title: 'Reddit ad library', description: 'Community-native creative and copy exploration for niche audiences.' },
  settings: { eyebrow: 'Settings', title: 'Settings', description: 'Billing and profile stay grouped in one utility area.' },
};

function DashboardLayout() {
  const location = useLocation();
  const activeSection = getActiveSection(location.pathname);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sidebarItems = getSidebarItems(activeSection);
  const sidebarMeta = sectionMeta[activeSection];
  const closeMobileNav = () => setMobileNavOpen(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMobileNavOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onBreakpoint = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener('change', onBreakpoint);
    return () => mq.removeEventListener('change', onBreakpoint);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#050505] text-[#e9edef]">
      <aside className="hidden h-full w-[64px] shrink-0 border-r border-white/8 bg-[#141414] sm:w-[72px] md:flex md:flex-col md:items-center md:justify-between md:py-4">
        <div className="flex flex-col items-center gap-0 pt-0.5">
          {railItems.map((item) => (
            <RailLink key={item.key} item={item} isActive={activeSection === item.key} />
          ))}
        </div>
        <div className="flex flex-col items-center gap-3">
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="App navigation">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={closeMobileNav}
          />
          <div
            id="mobile-dashboard-nav"
            className="absolute inset-y-0 left-0 flex w-[min(100vw-2.5rem,20rem)] max-w-[320px] flex-col border-r border-white/10 bg-[#0a0a0a] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-semibold text-white">Navigate</span>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#aebac1] hover:bg-white/10 hover:text-white"
                aria-label="Close menu"
                onClick={closeMobileNav}
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-white/8 bg-[#141414] px-3 py-3">
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#7f8ba0]">Sections</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {railItems.map((item) => (
                  <RailLink
                    key={item.key}
                    item={item}
                    isActive={activeSection === item.key}
                    onNavigate={closeMobileNav}
                    compact
                  />
                ))}
              </div>
            </div>
            <div className="border-b border-white/8 px-4 py-3">
              <p className="truncate text-sm font-medium text-[#c9d2df]">{sidebarMeta.title}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-[#7f8ba0]">{sidebarMeta.eyebrow}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 pb-4">
              {sidebarItems.map((item) => (
                <ContextLink key={`m-${item.to}`} item={item} onNavigate={closeMobileNav} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col bg-[#050505]">
        <header className="border-b border-white/8 bg-[#050505]">
          <div className="hidden border-b border-white/6 md:block">
            <div className="flex justify-center overflow-x-auto px-6 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max items-center justify-center gap-8">
                {sidebarItems.map((item) => (
                  <TopNavLink key={`top-${item.to}`} item={item} />
                ))}
              </div>
            </div>
            <div className="px-6 pb-3 pt-2 text-center">
              <p className="text-sm text-[#7d7d7d]">{sidebarMeta.description}</p>
            </div>
          </div>

          <div className="flex h-[56px] items-center px-3 sm:h-[64px] sm:px-4 md:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#1a1a1a] text-[#e9edef] md:hidden hover:bg-white/10"
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-dashboard-nav"
                aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setMobileNavOpen((o) => !o)}
              >
                {mobileNavOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </header>

        <main
          className="relative min-h-0 flex-1 overflow-y-auto p-4 md:p-6"
          style={{
            backgroundColor: '#050505',
            backgroundImage:
              'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0), radial-gradient(circle at 75px 75px, rgba(255,255,255,0.02) 2px, transparent 0)',
            backgroundSize: '100px 100px',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function getActiveSection(pathname) {
  if (pathname.startsWith('/tutorial')) return 'tutorial';
  if (pathname.startsWith('/website/')) return 'website';
  if (pathname.startsWith('/tiktok/')) return 'tiktok';
  if (pathname.startsWith('/facebook/')) return 'facebook';
  if (pathname.startsWith('/instagram')) return 'instagram';
  if (pathname.startsWith('/articles') || pathname.startsWith('/linkedin')) return 'articles';
  if (pathname.startsWith('/google-ads')) return 'google';
  if (pathname.startsWith('/reddit')) return 'reddit';
  if (
    pathname.startsWith('/bookmarks') ||
    pathname.startsWith('/notes') ||
    pathname.startsWith('/billing') ||
    pathname.startsWith('/settings')
  ) {
    return 'settings';
  }
  return 'overview';
}

function getSidebarItems(activeSection) {
  if (activeSection === 'tiktok') {
    return tikTokTabs;
  }
  if (activeSection === 'settings') return settingsTabs;
  return singleSectionTabs[activeSection] || singleSectionTabs.overview;
}

function RailLink({ item, isActive, onNavigate, compact }) {
  const Icon = item.icon;

  if (compact) {
    return (
      <NavLink
        to={item.to}
        title={item.label}
        onClick={onNavigate}
        className="shrink-0"
      >
        <span
          className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
            isActive
              ? 'border-[#25d366]/50 bg-white/5 text-white'
              : 'border-white/10 bg-[#1a1a1a] text-[#8696a0] hover:bg-white/10 hover:text-white'
          }`}
        >
          <Icon className="h-[18px] w-[18px] stroke-[2.3]" />
        </span>
      </NavLink>
    );
  }

  return (
    <NavLink
      to={item.to}
      title={item.label}
      onClick={onNavigate}
      className="group relative flex w-full justify-center px-3 py-1"
    >
      <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl text-[#8696a0] transition-all hover:text-white">
        <span className={isActive ? 'text-white' : ''}>
          <Icon className="h-5 w-5 stroke-[2.3]" />
        </span>
        {isActive ? <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#25d366]" /> : null}
      </span>
      <span className="pointer-events-none absolute left-[62px] top-1/2 z-30 -translate-y-1/2 rounded-md border border-white/10 bg-[#111111] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {item.label}
      </span>
    </NavLink>
  );
}

function ContextLink({ item, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/app'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
          isActive ? 'text-white' : 'text-[#d7dee8] hover:bg-white/5'
        }`
      }
    >
      {({ isActive }) => (
        <div className="relative flex w-full items-center gap-3">
          <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
            {Icon ? <Icon className="h-[18px] w-[18px]" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-[15px] font-medium ${isActive ? 'text-white' : 'text-[#e7edf6]'}`}>{item.label}</p>
          </div>
          {isActive ? (
            <span className="absolute -bottom-2 -left-3 -right-3 h-1 bg-[#25d366]" />
          ) : (
            <span className="absolute -bottom-2 -left-3 -right-3 h-px bg-white/4" />
          )}
        </div>
      )}
    </NavLink>
  );
}

function TopNavLink({ item, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/app'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `relative flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-1.5 text-sm transition-colors ${
          isActive
            ? 'border-[#25d366] text-white'
            : 'border-transparent text-[#b9c3cc] hover:text-white'
        }`
      }
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      <span className="whitespace-nowrap">{item.label}</span>
    </NavLink>
  );
}

function MenuIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 11l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v10h5v-5h4v5h5V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WebsiteIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 8h18" strokeLinecap="round" />
      <path d="M8 4v16" strokeLinecap="round" />
    </svg>
  );
}

function WorkspaceIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="8" height="7" rx="1.5" />
      <rect x="13" y="4" width="8" height="7" rx="1.5" />
      <rect x="3" y="13" width="8" height="7" rx="1.5" />
      <rect x="13" y="13" width="8" height="7" rx="1.5" />
    </svg>
  );
}

function SettingsIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3.75l1.15 1.86 2.15.34.7 2.06 1.9 1.08-.7 2.06.7 2.06-1.9 1.08-.7 2.06-2.15.34L12 20.25l-1.15-1.86-2.15-.34-.7-2.06-1.9-1.08.7-2.06-.7-2.06 1.9-1.08.7-2.06 2.15-.34L12 3.75Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  );
}

function BookmarkIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 3h12v18l-6-4-6 4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NoteIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 3h12a1 1 0 0 1 1 1v16l-4-3-4 3-4-3-4 3V4a1 1 0 0 1 1-1h2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8h8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

function CardIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function TikTokIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M14 3h2.4c.2 1.6 1.1 2.8 2.6 3.4v2.5c-1.2 0-2.3-.4-3.2-1.1v6.2c0 3-2.2 5-5 5-2.5 0-4.6-2-4.6-4.6S8.3 10 10.9 10c.3 0 .5 0 .8.1v2.5a2.4 2.4 0 0 0-.8-.2c-1.2 0-2.1 1-2.1 2.1 0 1.2.9 2.1 2.1 2.1 1.5 0 2.5-1 2.5-2.6V3z" />
    </svg>
  );
}

function FacebookIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M13.5 21v-8h2.7l.5-3h-3.2V8.3c0-.9.3-1.6 1.6-1.6h1.8V4.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V10H8v3h2.5v8h3z" />
    </svg>
  );
}

function LinkedInIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M6.2 8.4H3.4V20h2.8zM4.8 7.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM20.6 20v-6.2c0-3.3-1.8-4.9-4.2-4.9-1.9 0-2.8 1.1-3.2 1.8V8.4h-2.8V20h2.8v-6.5c0-1.7.3-3.3 2.4-3.3 2 0 2 1.9 2 3.4V20z" />
    </svg>
  );
}

function ArticlesIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" />
    </svg>
  );
}

function TutorialIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 19.5H8.5L4 22V6A1.5 1.5 0 0 1 5.5 4.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 9h6M9 13h4" strokeLinecap="round" />
    </svg>
  );
}

function InstagramIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GoogleIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M21.35 11.1h-9.18v2.92h5.27c-.23 1.5-1.74 4.4-5.27 4.4-3.18 0-5.77-2.63-5.77-5.87s2.59-5.87 5.77-5.87c1.8 0 3.01.77 3.7 1.43l2.52-2.44C16.86 4.2 14.7 3.1 12.17 3.1 7.2 3.1 3.17 7.2 3.17 12.55S7.2 22 12.17 22c6.9 0 8.59-6.05 8.59-8.9 0-.6-.06-1.05-.14-1.5z" />
    </svg>
  );
}

function RedditIcon({ className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19 10.3c.9 0 1.6-.7 1.6-1.6S20 7 19 7c-.7 0-1.3.4-1.5 1l-3.6-.8.8-2.4 2.1.5a1.5 1.5 0 1 0 .3-1.4l-2.8-.7a.8.8 0 0 0-1 .5l-1 3.2c-1.9 0-3.6.6-4.8 1.6-.3-.7-.8-1.2-1.6-1.2-1 0-1.7.7-1.7 1.6 0 .7.4 1.3 1 1.5a3.8 3.8 0 0 0-.1.8c0 3.1 3.1 5.6 6.9 5.6s6.9-2.5 6.9-5.6c0-.3 0-.5-.1-.8.7-.2 1.2-.8 1.2-1.5z" />
    </svg>
  );
}

function TrendIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 16l5-5 4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 8h5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MusicIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
      <path d="M10 18V6l8-2v12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LibraryIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5h5v14H4zM10 5h5v14h-5zM16 5h4v14h-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignalIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 18h2M9 14h2M13 10h2M17 6h2" strokeLinecap="round" />
      <path d="M5 18 19 4" strokeLinecap="round" />
    </svg>
  );
}

function BookmarkMiniIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 4h10v16l-5-3-5 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BriefcaseIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 7V5h8v2" strokeLinecap="round" />
      <rect x="3" y="7" width="18" height="12" rx="2" />
    </svg>
  );
}

function PaletteIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4a8 8 0 1 0 0 16h1.2a2.3 2.3 0 0 0 0-4.6h-.5a1.7 1.7 0 0 1-1.7-1.7A9.7 9.7 0 0 1 20 10 6 6 0 0 0 12 4Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ShieldIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIconMini({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 14l4-4" strokeLinecap="round" />
      <path d="M10 10 7 7a3 3 0 0 0-4 4l2 2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m14 14 3 3a3 3 0 1 0 4-4l-2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FolderIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GridIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="6" height="6" rx="1.2" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" />
    </svg>
  );
}

function ReelIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9 4l3 5M14 4l3 5M4 9h16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m11 11 4 2.5-4 2.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GroupIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M4.5 19a4.5 4.5 0 0 1 9 0" strokeLinecap="round" />
      <path d="M14.5 18a3.5 3.5 0 0 1 5 0" strokeLinecap="round" />
    </svg>
  );
}

function FollowersIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M3.5 19a4.5 4.5 0 0 1 9 0" strokeLinecap="round" />
      <path d="M14 16h6" strokeLinecap="round" />
      <path d="M17 13l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DecisionIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12h8M12 12l-2-2m2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6h6M14 12h6M14 18h6" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default DashboardLayout;
