import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  createBillingCheckout,
  createBillingPortalSession,
  getBillingStatus as fetchBillingStatus,
} from '../../lib/api.js';
import { showErrorToast } from '../../lib/toast.js';

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
    had_subscription_before: false,
  };
}

function normalizeSubscription(input) {
  const base = { ...defaultSubscription(), ...(input || {}) };
  const currentPlan = String(base.current_plan || base.plan_key || '').toLowerCase();
  const planKey = String(base.plan_key || base.current_plan || '').toLowerCase();
  const status = String(base.status || '').toLowerCase();
  const isActiveStatus = ['active', 'trialing', 'past_due'].includes(status);
  const looksPro = currentPlan.includes('pro') || planKey.includes('pro');

  return {
    ...base,
    current_plan: currentPlan || 'unsubscribed',
    plan_key: planKey || 'unsubscribed',
    is_active: Boolean(base.is_active || isActiveStatus),
    is_paid: Boolean(base.is_paid || isActiveStatus),
    is_pro: Boolean(base.is_pro || looksPro),
    had_subscription_before: Boolean(base.had_subscription_before),
  };
}

export function BillingProvider({ children }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [billing, setBilling] = useState({ subscription: defaultSubscription(), invoices: [], plans: [], usage: null });
  const [loading, setLoading] = useState(true);

  const refreshBilling = useCallback(async () => {
    if (!isSignedIn) {
      setBilling({ subscription: defaultSubscription(), invoices: [], plans: [], usage: null });
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token available');
      const data = await fetchBillingStatus(token);
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
      });
      return data;
    } catch (err) {
      console.error(err);
      if (BILLING_DEBUG) {
        console.log('[BillingContext] refreshBilling failed:', err?.message || err);
      }
      showErrorToast(err, 'Could not load billing. Refresh the page and try again.');
      setBilling({ subscription: defaultSubscription(), invoices: [], plans: [], usage: null });
      return null;
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    refreshBilling();
  }, [isLoaded, refreshBilling]);

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
      loading,
      refreshBilling,
      beginCheckout,
      openPortal,
    }),
    [beginCheckout, billing, loading, openPortal, refreshBilling]
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
