import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  createBillingCheckout,
  createBillingPortalSession,
  getBillingStatus as fetchBillingStatus,
} from '../../lib/api.js';

const BillingContext = createContext(null);
const BILLING_DEBUG = true;

function defaultSubscription() {
  return {
    current_plan: 'unsubscribed',
    plan_key: 'unsubscribed',
    status: 'unsubscribed',
    is_active: false,
    is_paid: false,
    is_pro: false,
    cancel_at_period_end: false,
    entitlements: {},
    features: {},
    limits: {},
    catalog_version: 0,
    had_subscription_before: false,
  };
}

function normalizeSubscription(input) {
  const base = { ...defaultSubscription(), ...(input || {}) };
  const currentPlan = String(base.current_plan || base.plan_key || '').toLowerCase();
  const planKey = String(base.plan_key || base.current_plan || '').toLowerCase();
  const status = String(base.status || '').toLowerCase();
  const isActiveStatus = ['active', 'trialing', 'on_trial', 'past_due'].includes(status);
  const looksPro =
    currentPlan.includes('pro') ||
    planKey.includes('pro') ||
    currentPlan === 'agency' ||
    planKey === 'agency';
  const looksPaidPlan = ['starter', 'pro', 'agency'].includes(currentPlan) || ['starter', 'pro', 'agency'].includes(planKey);
  const features = base.features && typeof base.features === 'object' ? base.features : {};
  const limits =
    (base.limits && typeof base.limits === 'object' && base.limits) ||
    (base.entitlements && typeof base.entitlements === 'object' && base.entitlements) ||
    {};

  return {
    ...base,
    current_plan: currentPlan || 'unsubscribed',
    plan_key: planKey || 'unsubscribed',
    is_active: Boolean(base.is_active || isActiveStatus || (looksPaidPlan && status !== 'unsubscribed')),
    is_paid: Boolean(base.is_paid || isActiveStatus || looksPaidPlan),
    is_pro: Boolean(base.is_pro || looksPro),
    features,
    limits,
    entitlements: limits,
    catalog_version: Number(base.catalog_version || 0),
    had_subscription_before: Boolean(base.had_subscription_before),
  };
}

export function BillingProvider({ children }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [billing, setBilling] = useState({
    subscription: defaultSubscription(),
    invoices: [],
    plans: [],
    usage: null,
    credits: null,
  });
  const [loading, setLoading] = useState(true);

  const refreshBilling = useCallback(async (options = {}) => {
    const silent = Boolean(options?.silent);
    const subscriptionId = options?.subscriptionId || null;
    if (!isSignedIn) {
      setBilling({ subscription: defaultSubscription(), invoices: [], plans: [], usage: null, credits: null });
      if (!silent) setLoading(false);
      return null;
    }

    if (!silent) setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await fetchBillingStatus(token, { subscriptionId });
      const normalizedSubscription = normalizeSubscription(data?.subscription);
      if (BILLING_DEBUG) {
        console.log('[BillingContext] fetchBillingStatus raw subscription:', data?.subscription);
        console.log('[BillingContext] normalized subscription used by guards:', normalizedSubscription);
      }
      setBilling({
        subscription: normalizedSubscription,
        invoices: Array.isArray(data?.invoices) ? data.invoices : [],
        plans: Array.isArray(data?.plans) ? data.plans : [],
        usage: data?.usage || null,
        credits: data?.credits || null,
      });
      return { ...data, subscription: normalizedSubscription };
    } catch (err) {
      console.error(err);
      if (BILLING_DEBUG) {
        console.log('[BillingContext] refreshBilling failed:', err?.message || err);
      }
      setBilling({ subscription: defaultSubscription(), invoices: [], plans: [], usage: null, credits: null });
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    refreshBilling();
  }, [isLoaded, refreshBilling]);

  const can = useCallback(
    (featureKey) => {
      if (!featureKey) return false;
      if (!billing.subscription?.is_active) return false;
      return Boolean(billing.subscription?.features?.[featureKey]);
    },
    [billing.subscription]
  );

  const limitFor = useCallback(
    (metricKey) => Number(billing.subscription?.limits?.[metricKey] ?? 0),
    [billing.subscription]
  );

  const beginCheckout = useCallback(async (planKey, options = {}) => {
    const token = await getToken();
    if (!token) throw new Error('No session token available');
    const data = await createBillingCheckout(token, planKey, options);
    if (data?.checkout_url) {
      window.location.href = data.checkout_url;
    }
    return data;
  }, [getToken]);

  const openPortal = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error('No session token available');
    const data = await createBillingPortalSession(token);
    if (data?.link) {
      window.location.href = data.link;
    }
    return data;
  }, [getToken]);

  const value = useMemo(
    () => ({
      subscription: billing.subscription,
      invoices: billing.invoices,
      plans: billing.plans,
      usage: billing.usage,
      credits: billing.credits,
      loading,
      refreshBilling,
      beginCheckout,
      openPortal,
      can,
      limitFor,
    }),
    [beginCheckout, billing, can, limitFor, loading, openPortal, refreshBilling]
  );

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('useBilling must be used within BillingProvider');
  }
  return context;
}
