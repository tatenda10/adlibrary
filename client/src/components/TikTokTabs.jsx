import { NavLink } from 'react-router-dom';

const tabs = [
  { label: 'Trending', to: '/tiktok/trending', icon: TrendIcon },
  { label: 'Trending Music', to: '/tiktok/trending-music', icon: MusicIcon },
  { label: 'Creators', to: '/tiktok/creators', icon: SparkIcon },
  // { label: 'Trending Hashtags', to: '/tiktok/trending-hashtags', icon: TrendIcon },
  { label: 'Hot Takes', to: '/tiktok/hot-takes', icon: TrendIcon },
  { label: 'Predictor', to: '/tiktok/predictor', icon: SignalIcon },
  { label: 'Workspace', to: '/tiktok/workspace', icon: BriefcaseIcon },
  // { label: 'Saved', to: '/tiktok/saved', icon: BookmarkMiniIcon },
  // { label: 'For You', to: '/tiktok/for-you', icon: SparkIcon },
];

function TikTokTabs() {
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;

        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-sm px-3 py-2 text-xs font-semibold transition ${
                isActive ? 'bg-[#25d366] text-black' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </NavLink>
        );
      })}
    </div>
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

export default TikTokTabs;
