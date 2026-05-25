import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  createCompetitorWatchlistItem,
  deleteCompetitorWatchlistItem,
  deleteSavedPlan,
  getCompetitorWatchlist,
  getSavedPlans,
  updateCompetitorWatchlistItem,
} from '../lib/api.js';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { useApiToast } from '../hooks/useApiToast.js';

const DEFAULT_ALERT_PREFERENCES = {
  notify_on_spike: true,
  notify_on_drop: true,
  notify_on_new_offer: true,
};

function SavedPlans() {
  const { getToken } = useAuth();
  const { notifyApiError } = useApiToast();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [working, setWorking] = useState('');
  const [form, setForm] = useState({
    competitor_name: '',
    platform: 'tiktok',
    keyword: '',
    notes: '',
    alert_preferences: { ...DEFAULT_ALERT_PREFERENCES },
  });

  const loadData = async () => {
    const token = await getToken();
    if (!token) throw new Error('Session token unavailable');
    const [plansData, watchlistData] = await Promise.all([getSavedPlans(token), getCompetitorWatchlist(token)]);
    setPlans(plansData?.plans || []);
    setWatchlist(watchlistData?.watchlist || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await loadData();
      } catch (err) {
        if (!cancelled) notifyApiError(err, 'Failed to load saved plans.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, notifyApiError]);

  const handleDeletePlan = async (id) => {
    try {
      setWorking(`delete-plan-${id}`);
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      await deleteSavedPlan(token, id);
      setPlans((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      notifyApiError(err, 'Failed to delete saved plan.');
    } finally {
      setWorking('');
    }
  };

  const handleCreateWatch = async (event) => {
    event.preventDefault();
    try {
      setWorking('create-watch');
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      await createCompetitorWatchlistItem(token, form);
      setForm({
        competitor_name: '',
        platform: 'tiktok',
        keyword: '',
        notes: '',
        alert_preferences: { ...DEFAULT_ALERT_PREFERENCES },
      });
      await loadData();
    } catch (err) {
      notifyApiError(
        err?.upgrade_prompt ? `${err.message} ${err.upgrade_prompt}` : err,
        'Failed to create watchlist item.'
      );
    } finally {
      setWorking('');
    }
  };

  const handleToggleWatch = async (item) => {
    try {
      setWorking(`watch-${item.id}`);
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      await updateCompetitorWatchlistItem(token, item.id, { is_active: !item.is_active });
      setWatchlist((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, is_active: !entry.is_active } : entry)));
    } catch (err) {
      notifyApiError(
        err?.upgrade_prompt ? `${err.message} ${err.upgrade_prompt}` : err,
        'Failed to update watchlist item.'
      );
    } finally {
      setWorking('');
    }
  };

  const handleDeleteWatch = async (id) => {
    try {
      setWorking(`delete-watch-${id}`);
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      await deleteCompetitorWatchlistItem(token, id);
      setWatchlist((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      notifyApiError(err, 'Failed to delete watchlist item.');
    } finally {
      setWorking('');
    }
  };

  const handleToggleCreatePreference = (key) => {
    setForm((prev) => ({
      ...prev,
      alert_preferences: {
        ...prev.alert_preferences,
        [key]: !prev.alert_preferences[key],
      },
    }));
  };

  const handleToggleItemPreference = async (item, key) => {
    try {
      setWorking(`pref-${item.id}-${key}`);
      const token = await getToken();
      if (!token) throw new Error('Session token unavailable');
      const nextPreferences = {
        notify_on_spike: Boolean(item.alert_preferences?.notify_on_spike),
        notify_on_drop: Boolean(item.alert_preferences?.notify_on_drop),
        notify_on_new_offer: Boolean(item.alert_preferences?.notify_on_new_offer),
        [key]: !item.alert_preferences?.[key],
      };
      await updateCompetitorWatchlistItem(token, item.id, { alert_preferences: nextPreferences });
      setWatchlist((prev) => prev.map((entry) => (
        entry.id === item.id
          ? { ...entry, alert_preferences: nextPreferences }
          : entry
      )));
    } catch (err) {
      notifyApiError(err, 'Failed to update alert preferences.');
    } finally {
      setWorking('');
    }
  };

  if (loading) {
    return <CubeLoaderOverlay label="Loading saved plans…" minHeight="52vh" />;
  }

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Saved strategy</p>
        <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Saved plans and watchlist</h1>
        <p className="mt-2 text-sm text-slate-300">
          Reuse generated plans and manage tracked competitors with scheduled alerts.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <h2 className="text-lg font-semibold text-white">Saved plans</h2>
        <div className="mt-3 space-y-2">
          {plans.length ? plans.map((plan) => (
            <article key={plan.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{plan.title}</p>
                  <p className="text-xs text-slate-400">
                    {plan.plan_type} | Matrix {Array.isArray(plan.matrix) ? plan.matrix.length : 0} items | {new Date(plan.updated_at).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePlan(plan.id)}
                  disabled={working === `delete-plan-${plan.id}`}
                  className="rounded-md border border-rose-400/40 px-2 py-1 text-xs text-rose-200 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </article>
          )) : <p className="text-sm text-slate-400">No saved plans yet. Save one from Decision Engine.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <h2 className="text-lg font-semibold text-white">Competitor watchlist</h2>
        <form onSubmit={handleCreateWatch} className="mt-3 space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={form.competitor_name}
              onChange={(event) => setForm((prev) => ({ ...prev, competitor_name: event.target.value }))}
              placeholder="Competitor name"
              className="rounded-md border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none"
            />
            <select
              value={form.platform}
              onChange={(event) => setForm((prev) => ({ ...prev, platform: event.target.value }))}
              className="rounded-md border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="tiktok">TikTok</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
            <input
              value={form.keyword}
              onChange={(event) => setForm((prev) => ({ ...prev, keyword: event.target.value }))}
              placeholder="Keyword to track"
              className="rounded-md border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none"
            />
            <input
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Notes"
              className="rounded-md border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Alert preferences</p>
            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={Boolean(form.alert_preferences.notify_on_spike)}
                onChange={() => handleToggleCreatePreference('notify_on_spike')}
              />
              Spike
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={Boolean(form.alert_preferences.notify_on_drop)}
                onChange={() => handleToggleCreatePreference('notify_on_drop')}
              />
              Drop
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={Boolean(form.alert_preferences.notify_on_new_offer)}
                onChange={() => handleToggleCreatePreference('notify_on_new_offer')}
              />
              New offer
            </label>
            <button
              type="submit"
              disabled={working === 'create-watch'}
              className="ml-auto rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
            >
              {working === 'create-watch' ? 'Adding...' : 'Add watch'}
            </button>
          </div>
        </form>

        <div className="mt-3 space-y-2">
          {watchlist.length ? watchlist.map((item) => (
            <article key={item.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{item.competitor_name}</p>
                  <p className="text-xs text-slate-300">{item.platform} | {item.keyword}</p>
                  {item.notes ? <p className="mt-1 text-xs text-slate-400">{item.notes}</p> : null}
                  <p className="mt-1 text-xs text-slate-500">
                    Last results {item.last_results_count || 0} | Signal {item.last_signal_score || 0}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleWatch(item)}
                    disabled={working === `watch-${item.id}`}
                    className="rounded-md border border-white/20 px-2 py-1 text-xs text-white disabled:opacity-60"
                  >
                    {item.is_active ? 'Pause' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteWatch(item.id)}
                    disabled={working === `delete-watch-${item.id}`}
                    className="rounded-md border border-rose-400/40 px-2 py-1 text-xs text-rose-200 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3">
                <PreferenceToggle
                  label="Spike"
                  checked={Boolean(item.alert_preferences?.notify_on_spike)}
                  disabled={working === `pref-${item.id}-notify_on_spike`}
                  onChange={() => handleToggleItemPreference(item, 'notify_on_spike')}
                />
                <PreferenceToggle
                  label="Drop"
                  checked={Boolean(item.alert_preferences?.notify_on_drop)}
                  disabled={working === `pref-${item.id}-notify_on_drop`}
                  onChange={() => handleToggleItemPreference(item, 'notify_on_drop')}
                />
                <PreferenceToggle
                  label="New offer"
                  checked={Boolean(item.alert_preferences?.notify_on_new_offer)}
                  disabled={working === `pref-${item.id}-notify_on_new_offer`}
                  onChange={() => handleToggleItemPreference(item, 'notify_on_new_offer')}
                />
              </div>
            </article>
          )) : <p className="text-sm text-slate-400">No tracked competitors yet.</p>}
        </div>
      </section>
    </div>
  );
}

function PreferenceToggle({ label, checked, disabled, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-200">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      {label}
    </label>
  );
}

export default SavedPlans;
