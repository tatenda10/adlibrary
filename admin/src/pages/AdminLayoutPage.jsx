import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import logo from '@brand-assets/logo.png';
import { adminGetIncidentsSummary } from '../lib/api.js';
import { getIncidentsLastSeenId, markIncidentsSeenFromSummary } from '../lib/incidentStorage.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import {
  AnalyticsIcon,
  ArticlesIcon,
  CloseIcon,
  DashboardIcon,
  ExternalIcon,
  IncidentsIcon,
  MenuIcon,
  OnboardingIcon,
  SettingsIcon,
  UsersIcon,
} from '../components/AdminIcons.jsx';
import { AdminButton } from '../components/ui/AdminUi.jsx';

const railItems = [
  { key: 'dashboard', to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { key: 'content', to: '/articles/all', label: 'Content', icon: ArticlesIcon },
  { key: 'users', to: '/users', label: 'Users', icon: UsersIcon },
  { key: 'analytics', to: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
  { key: 'onboarding', to: '/onboarding', label: 'Onboarding', icon: OnboardingIcon },
  { key: 'incidents', to: '/incidents', label: 'Incidents', icon: IncidentsIcon },
  { key: 'settings', to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const contentNav = [
  { to: '/articles/all', label: 'All articles', description: 'Review, edit, and delete blog posts.' },
  { to: '/articles/new', label: 'New article', description: 'Write and publish to the public blog.' },
];

const productNav = [
  { to: '/users', label: 'Users', description: 'Accounts, plans, and login activity.' },
  { to: '/analytics', label: 'Analytics', description: 'Events, funnels, and navigation.' },
  { to: '/onboarding', label: 'Onboarding', description: 'Brand and audience data from signup flow.' },
  { to: '/incidents', label: 'Incidents', description: 'API failures and empty scrapes.' },
];

const PRODUCT_SECTIONS = new Set(['users', 'analytics', 'onboarding', 'incidents']);

const sectionMeta = {
  dashboard: {
    eyebrow: 'Overview',
    title: 'Dashboard',
    description: 'Quick stats and shortcuts for content publishing.',
  },
  content: {
    eyebrow: 'Content',
    title: 'Blog & articles',
    description: 'Manage public blog posts shown at /blog on the main site.',
  },
  users: {
    eyebrow: 'Accounts',
    title: 'Users',
    description: 'Sign-up date, last login, login count, and subscription plan for every user.',
  },
  analytics: {
    eyebrow: 'Product',
    title: 'Analytics',
    description: 'Where users click and navigate — mirrored from Firebase events into your database.',
  },
  onboarding: {
    eyebrow: 'Product',
    title: 'Onboarding',
    description: 'Brand, audience, and website data collected during user onboarding.',
  },
  incidents: {
    eyebrow: 'Reliability',
    title: 'Incidents',
    description: 'API failures, empty scrapes, and unhealthy Apify runs with user attribution.',
  },
  settings: {
    eyebrow: 'Platform',
    title: 'Settings',
    description: 'Security, publishing defaults, and admin controls.',
  },
};

export function AdminLayoutPage() {
  const location = useLocation();
  const { isAuthenticated, logout, admin, token } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [incidentAlertCount, setIncidentAlertCount] = useState(0);

  const activeSection = getActiveSection(location.pathname);
  const meta = sectionMeta[activeSection] || sectionMeta.dashboard;
  const sidebarItems = activeSection === 'content'
    ? contentNav
    : PRODUCT_SECTIONS.has(activeSection)
      ? productNav
      : [];

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!token || !isAuthenticated) return undefined;

    let cancelled = false;

    async function pollIncidents() {
      try {
        const summary = await adminGetIncidentsSummary(token, {
          hours: 24,
          sinceId: getIncidentsLastSeenId(),
        });
        if (cancelled) return;

        if (activeSection === 'incidents') {
          markIncidentsSeenFromSummary(summary);
          setIncidentAlertCount(0);
          return;
        }

        setIncidentAlertCount(Number(summary?.new_since_id || 0));
      } catch {
        if (!cancelled) setIncidentAlertCount(0);
      }
    }

    pollIncidents();
    const timer = window.setInterval(pollIncidents, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, isAuthenticated, location.pathname, activeSection]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const publicBlogUrl = import.meta.env.VITE_PUBLIC_SITE_URL
    ? `${import.meta.env.VITE_PUBLIC_SITE_URL.replace(/\/$/, '')}/blog`
    : 'http://localhost:5173/blog';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#030303] text-[#e9edef]">
      <aside className="admin-rail hidden h-full w-[72px] shrink-0 flex-col items-center border-r border-white/8 bg-[#141414] py-4 md:flex">
        <NavLink to="/dashboard" className="mb-4 flex shrink-0 flex-col items-center gap-1">
          <img src={logo} alt="ViralAdLibrary" className="h-9 w-9 rounded-full object-cover ring-1 ring-emerald-400/30" />
        </NavLink>
        <nav className="admin-rail-nav flex min-h-0 w-full flex-1 flex-col items-center gap-1 px-1">
          {railItems.map((item) => (
            <RailLink
              key={item.key}
              item={item}
              isActive={activeSection === item.key}
              badgeCount={item.key === 'incidents' ? incidentAlertCount : 0}
            />
          ))}
        </nav>
        <div className="mt-2 flex shrink-0 flex-col items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-xs font-bold text-emerald-300">
            {(admin?.username || 'A').slice(0, 1).toUpperCase()}
          </span>
        </div>
      </aside>

      {sidebarItems.length ? (
        <aside className="hidden h-full w-[260px] shrink-0 flex-col border-r border-white/8 bg-[#0a0a0a] md:flex">
          <div className="border-b border-white/8 px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/90">{meta.eyebrow}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{meta.title}</h2>
          </div>
          <nav className="admin-scroll-y flex-1 space-y-1 p-3">
            {sidebarItems.map((item) => (
              <SidebarLink key={item.to} item={item} />
            ))}
          </nav>
          <div className="border-t border-white/8 p-4">
            <a
              href={publicBlogUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-sm border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/10"
            >
              View public blog
              <ExternalIcon />
            </a>
          </div>
        </aside>
      ) : null}

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(100vw-2rem,20rem)] flex-col border-r border-white/10 bg-[#0a0a0a]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-semibold">Admin menu</span>
              <button type="button" onClick={() => setMobileOpen(false)} className="text-[#9ca3af]">
                <CloseIcon />
              </button>
            </div>
            <div className="space-y-1 p-3">
              {railItems.map((item) => (
                <MobileRailLink key={item.key} item={item} isActive={activeSection === item.key} onNavigate={() => setMobileOpen(false)} />
              ))}
            </div>
            {sidebarItems.length ? (
              <div className="border-t border-white/8 p-3">
                {sidebarItems.map((item) => (
                  <SidebarLink key={`m-${item.to}`} item={item} onNavigate={() => setMobileOpen(false)} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="admin-glow shrink-0 border-b border-emerald-400/15 bg-emerald-950/40 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-sm border border-white/10 bg-[#141414] md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <MenuIcon />
              </button>
              <div className="min-w-0 md:hidden">
                <p className="truncate text-sm font-semibold text-white">{meta.title}</p>
              </div>
              <div className="hidden md:block">
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">{meta.eyebrow}</p>
                <h1 className="text-lg font-semibold text-white">{meta.title}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="hidden text-sm text-[#9ca3af] sm:inline">
                {admin?.username || 'admin'}
              </span>
              <AdminButton variant="ghost" onClick={logout}>
                Log out
              </AdminButton>
            </div>
          </div>
          {sidebarItems.length === 0 ? (
            <div className="hidden border-t border-white/6 px-6 py-3 md:block">
              <p className="text-sm text-[#7f8ba0]">{meta.description}</p>
            </div>
          ) : null}
        </header>

        <main className="admin-dot-grid min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {incidentAlertCount > 0 && activeSection !== 'incidents' ? (
            <div className="mx-auto mb-4 max-w-6xl rounded-sm border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {incidentAlertCount} new incident{incidentAlertCount === 1 ? '' : 's'} in the last 24 hours.{' '}
              <NavLink to="/incidents" className="font-semibold text-white underline">
                View incidents
              </NavLink>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function getActiveSection(pathname) {
  if (pathname.startsWith('/articles')) return 'content';
  if (pathname.startsWith('/users')) return 'users';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/onboarding')) return 'onboarding';
  if (pathname.startsWith('/incidents')) return 'incidents';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

function RailLink({ item, isActive, badgeCount = 0 }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} title={item.label} className="group relative flex w-full justify-center px-2 py-1">
      <span
        className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
          isActive ? 'text-white' : 'text-[#8696a0] hover:text-white'
        }`}
      >
        <Icon className="h-5 w-5 stroke-[2.3]" />
        {badgeCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        ) : null}
        {isActive ? <span className="absolute bottom-0 left-1 right-1 h-1 rounded-full bg-[#25d366]" /> : null}
      </span>
    </NavLink>
  );
}

function MobileRailLink({ item, isActive, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium ${
        isActive ? 'bg-emerald-400/10 text-emerald-300' : 'text-[#c6d0db] hover:bg-white/5'
      }`}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </NavLink>
  );
}

function SidebarLink({ item, onNavigate }) {
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `block rounded-sm border px-3 py-3 transition ${
          isActive
            ? 'border-emerald-400/30 bg-emerald-400/[0.08] text-white'
            : 'border-transparent text-[#c6d0db] hover:border-white/10 hover:bg-white/[0.03]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <p className={`text-sm font-semibold ${isActive ? 'text-emerald-300' : 'text-white'}`}>{item.label}</p>
          {item.description ? <p className="mt-1 text-xs leading-5 text-[#7f8ba0]">{item.description}</p> : null}
        </>
      )}
    </NavLink>
  );
}
