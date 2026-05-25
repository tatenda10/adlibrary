import { Navigate, useNavigate } from 'react-router-dom';
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
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(34,197,94,0.12) 0%, transparent 45%), radial-gradient(circle at 80% 60%, rgba(59,130,246,0.08) 0%, transparent 40%)',
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-400/90">Admin</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">ViralAdLibrary</h1>
          <p className="mt-2 text-sm text-[#9ca3af]">Sign in to manage users, articles, and settings.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:p-8">
          <LoginForm onSubmit={handleLogin} loading={loading} error={error} />
        </div>
        <p className="mt-8 text-center text-xs text-[#6b7280]">Staff access only. Sessions stay on this device.</p>
      </div>
    </div>
  );
}
