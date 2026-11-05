import { useEffect, useMemo, useState } from 'react';
import { adminGetEntitlements, adminPutEntitlements } from '../lib/api.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { AdminButton, AdminCard, AdminPageHeader, adminInputClass } from '../components/ui/AdminUi.jsx';

export function PlansPage() {
  const { token } = useAdminAuth();
  const [catalog, setCatalog] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const data = await adminGetEntitlements(token);
        if (cancelled) return;
        setCatalog(data);
        setDraft(structuredClone(data));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load entitlements');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token) load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const dirty = useMemo(() => {
    if (!catalog || !draft) return false;
    return JSON.stringify(catalog) !== JSON.stringify(draft);
  }, [catalog, draft]);

  const toggleFeature = (planKey, featureKey) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const plans = prev.plans.map((plan) => {
        if (plan.plan_key !== planKey) return plan;
        return {
          ...plan,
          features: {
            ...plan.features,
            [featureKey]: !plan.features?.[featureKey],
          },
        };
      });
      return { ...prev, plans };
    });
  };

  const setLimit = (planKey, metricKey, value) => {
    const nextValue = Math.max(0, Number.parseInt(String(value || '0'), 10) || 0);
    setDraft((prev) => {
      if (!prev) return prev;
      const plans = prev.plans.map((plan) => {
        if (plan.plan_key !== planKey) return plan;
        return {
          ...plan,
          limits: {
            ...plan.limits,
            [metricKey]: nextValue,
          },
        };
      });
      return { ...prev, plans };
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      setError('');
      setNotice('');
      const features = [];
      const limits = [];
      for (const plan of draft.plans) {
        for (const [featureKey, enabled] of Object.entries(plan.features || {})) {
          features.push({ plan_key: plan.plan_key, feature_key: featureKey, enabled: Boolean(enabled) });
        }
        for (const [metricKey, limitValue] of Object.entries(plan.limits || {})) {
          limits.push({ plan_key: plan.plan_key, metric_key: metricKey, limit_value: Number(limitValue) || 0 });
        }
      }

      const saved = await adminPutEntitlements(token, {
        plans: draft.plans.map((plan) => ({
          plan_key: plan.plan_key,
          name: plan.name,
          monthly_price_cents: plan.monthly_price_cents,
          sort_order: plan.sort_order,
          is_self_serve: plan.is_self_serve,
          is_active: plan.is_active,
        })),
        features,
        limits,
      });
      setCatalog(saved);
      setDraft(structuredClone(saved));
      setNotice(`Saved. Catalog version ${saved.catalog_version}.`);
    } catch (err) {
      setError(err.message || 'Failed to save entitlements');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!catalog) return;
    setDraft(structuredClone(catalog));
    setNotice('');
  };

  const plans = draft?.plans || [];
  const featureDefs = draft?.feature_definitions || [];
  const metricDefs = draft?.metric_definitions || [];

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        eyebrow="Billing"
        title="Plans & entitlements"
        description="Toggle feature access and monthly limits per plan. Changes apply immediately after save (in-memory catalog refresh)."
        actions={
          <>
            <AdminButton variant="secondary" onClick={handleReset} disabled={!dirty || saving}>
              Reset
            </AdminButton>
            <AdminButton onClick={handleSave} disabled={!dirty || saving || loading}>
              {saving ? 'Saving…' : 'Save changes'}
            </AdminButton>
          </>
        }
      />

      {error ? <p className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      {notice ? <p className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</p> : null}

      {loading || !draft ? (
        <AdminCard>
          <p className="text-sm text-[#9ca3af]">Loading entitlement catalog…</p>
        </AdminCard>
      ) : (
        <>
          <p className="text-xs uppercase tracking-[0.14em] text-[#7f8ba0]">
            Catalog version {draft.catalog_version}
            {dirty ? ' · unsaved changes' : ''}
          </p>

          <AdminCard className="overflow-x-auto p-0">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Feature access</h2>
              <p className="mt-1 text-xs text-[#9ca3af]">Checkboxes enable route/API access for that plan.</p>
            </div>
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-black/20 text-[11px] uppercase tracking-[0.12em] text-[#7f8ba0]">
                <tr>
                  <th className="px-4 py-3 font-medium">Feature</th>
                  {plans.map((plan) => (
                    <th key={plan.plan_key} className="px-4 py-3 font-medium">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureDefs.map((feature) => (
                  <tr key={feature.feature_key} className="border-b border-white/5">
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-white">{feature.label}</p>
                      <p className="mt-0.5 text-xs text-[#9ca3af]">{feature.feature_key}</p>
                    </td>
                    {plans.map((plan) => (
                      <td key={`${plan.plan_key}-${feature.feature_key}`} className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(plan.features?.[feature.feature_key])}
                          onChange={() => toggleFeature(plan.plan_key, feature.feature_key)}
                          className="h-4 w-4 accent-emerald-400"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminCard>

          <AdminCard className="overflow-x-auto p-0">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Usage limits</h2>
              <p className="mt-1 text-xs text-[#9ca3af]">Numeric quotas per billing cycle (0 = blocked).</p>
            </div>
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-black/20 text-[11px] uppercase tracking-[0.12em] text-[#7f8ba0]">
                <tr>
                  <th className="px-4 py-3 font-medium">Metric</th>
                  {plans.map((plan) => (
                    <th key={plan.plan_key} className="px-4 py-3 font-medium">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricDefs.map((metric) => (
                  <tr key={metric.metric_key} className="border-b border-white/5">
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-white">{metric.label}</p>
                      <p className="mt-0.5 text-xs text-[#9ca3af]">{metric.metric_key}</p>
                    </td>
                    {plans.map((plan) => (
                      <td key={`${plan.plan_key}-${metric.metric_key}`} className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          className={`${adminInputClass} max-w-[7rem]`}
                          value={plan.limits?.[metric.metric_key] ?? 0}
                          onChange={(event) => setLimit(plan.plan_key, metric.metric_key, event.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminCard>
        </>
      )}
    </section>
  );
}
