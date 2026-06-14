import { useState } from 'react';
import { adminInputClass, AdminButton } from './ui/AdminUi.jsx';

export function LoginForm({ onSubmit, loading, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ username: username.trim(), password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="admin-username" className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-[#7f8ba0]">
          Username
        </label>
        <input
          id="admin-username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={adminInputClass}
          placeholder="Enter username"
          required
        />
      </div>
      <div>
        <label htmlFor="admin-password" className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-[#7f8ba0]">
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={adminInputClass}
          placeholder="Enter password"
          required
        />
      </div>
      {error ? (
        <p className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}
      <AdminButton type="submit" disabled={loading} className="w-full">
        {loading ? 'Signing in…' : 'Sign in'}
      </AdminButton>
    </form>
  );
}
