import { Navigate, useNavigate } from 'react-router-dom';
import logo from '@brand-assets/logo.png';
import { LoginForm } from '../components/LoginForm.jsx';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, isAuthenticated } = useAdminAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (creds) => {
    const ok = await login(creds);
    if (ok) navigate('/dashboard', { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030303] text-white">
      <div className="admin-glow pointer-events-none absolute inset-0" />
      <div className="admin-dot-grid pointer-events-none absolute inset-0 opacity-40" />

      <header className="relative z-10 border-b border-emerald-400/20 bg-emerald-950/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 md:px-6">
          <img src={logo} alt="ViralAdLibrary" className="h-9 w-9 rounded-full object-cover" />
          <div>
            <p className="text-base font-bold tracking-tight">ViralAdLibrary</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-300/80">Admin</p>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex min-h-[calc(100vh-65px)] max-w-lg flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-400/90">Staff access</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Sign in to admin</h1>
          <p className="mt-2 text-sm text-[#9ca3af]">Manage blog posts, users, and platform settings.</p>
        </div>
        <div className="rounded-sm border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8">
          <LoginForm onSubmit={handleLogin} loading={loading} error={error} />
        </div>
        <p className="mt-8 text-center text-xs text-[#6b7280]">Sessions stay on this device only.</p>
      </div>
    </div>
  );
}
