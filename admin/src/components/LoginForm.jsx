import { useState } from 'react';

export function LoginForm({ onSubmit, loading, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ username: username.trim(), password });
  };

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-[#0f0f10] px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/30 placeholder:text-[#6b7280] focus:border-emerald-500/40 focus:ring-2';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="admin-username" className="mb-1.5 block text-xs font-medium text-[#9ca3af]">
          Username
        </label>
        <input
          id="admin-username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputClass}
          placeholder="Enter username"
          required
        />
      </div>
      <div>
        <label htmlFor="admin-password" className="mb-1.5 block text-xs font-medium text-[#9ca3af]">
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="Enter password"
          required
        />
      </div>
      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-[#041006] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
