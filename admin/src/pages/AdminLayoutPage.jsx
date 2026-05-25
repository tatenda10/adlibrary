import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/users', label: 'Users' },
  { to: '/settings', label: 'Settings' },
];

const articleItems = [
  { to: '/articles/all', label: 'All Articles' },
  { to: '/articles/new', label: 'Add Article' },
];

export function AdminLayoutPage() {
  const location = useLocation();
  const { isAuthenticated, logout, admin } = useAdminAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-[#050505] text-[#e9edef]">
      <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0a0a0a] p-4 md:flex md:flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7f8ba0]">ViralAdLibrary</p>
        <h1 className="mt-2 text-lg font-semibold text-white">Admin Panel</h1>
        <nav className="mt-6 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-emerald-500/15 text-emerald-300' : 'text-[#c6d0db] hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="pt-1">
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#7f8ba0]">Articles</p>
            <div className="space-y-1 rounded-lg border border-white/10 bg-[#070707] p-1.5">
              {articleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex rounded-md px-2.5 py-1.5 text-sm transition ${
                      isActive ? 'bg-emerald-500/15 text-emerald-300' : 'text-[#c6d0db] hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
        <div className="mt-auto rounded-lg border border-white/10 bg-[#060606] p-3">
          <p className="text-xs text-[#9ca3af]">Signed in as</p>
          <p className="mt-1 truncate text-sm font-medium text-white">{admin?.username || 'admin'}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#d1d5db] hover:bg-white/5"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-white/10 bg-[#0a0a0a] px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#7f8ba0]">Admin Workspace</p>
              <h2 className="text-lg font-semibold text-white">{pageTitle(location.pathname)}</h2>
            </div>
            <div className="flex gap-2 md:hidden">
              {[...navItems, ...articleItems].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-md px-2.5 py-1.5 text-xs font-medium ${
                      isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-[#c6d0db]'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function pageTitle(pathname) {
  if (pathname.startsWith('/users')) return 'Users';
  if (pathname.startsWith('/articles/new')) return 'Add Article';
  if (pathname.startsWith('/articles/all')) return 'All Articles';
  if (pathname.startsWith('/articles')) return 'Articles';
  if (pathname.startsWith('/settings')) return 'Settings';
  return 'Dashboard';
}
