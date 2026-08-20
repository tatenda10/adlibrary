import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useBilling } from '../components/billing/BillingContext.jsx';
import { PRICING_PLANS } from '../lib/pricingPlans.js';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { showInfoToast } from '../lib/toast.js';
import { getBrandProfile } from '../lib/api.js';
import { trackEvent } from '../lib/firebaseAnalytics.js';
import { trackCheckoutCompletedFromBilling, trackCheckoutStarted } from '../lib/metaPixelCheckout.js';
import { trackMetaViewContent } from '../lib/metaPixel.js';

function OnboardingBilling() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getToken } = useAuth();
  const { beginCheckout, refreshBilling, loading, subscription } = useBilling();
  const [actionLoading, setActionLoading] = useState('');
  const [checkoutNotice, setCheckoutNotice] = useState('');
  const progressedRef = useRef(false);
  const roleRef = useRef('');

  const withRole = (params = {}) => ({
    ...params,
    audience_role: roleRef.current || '',
  });

  const checkoutPlan = searchParams.get('checkoutPlan') || '';
  const checkoutState = searchParams.get('checkout') || '';

  useEffect(() => {
    let cancelled = false;
    async function loadRole() {
      try {
        const token = await getToken();
        if (!token) return;
        const profile = await getBrandProfile(token);
        const prefs = profile?.preferences;
        const parsed = typeof prefs === 'string' ? JSON.parse(prefs || '{}') : prefs || {};
        if (!cancelled) roleRef.current = parsed.audienceRole || '';
      } catch {
        // keep empty role
      }
    }
    loadRole();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    if (!checkoutState) {
      setCheckoutNotice('');
      return;
    }
    if (checkoutState === 'canceled') {
      setCheckoutNotice('canceled');
      showInfoToast('Payment canceled. Choose a plan below to continue.');
      trackEvent('onboarding_billing_checkout_canceled', withRole({
        plan_key: checkoutPlan || '',
      }));
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('checkout');
      setSearchParams(nextParams, { replace: true });
      return;
    }
    if (checkoutState !== 'success') return;

    let cancelled = false;
    async function finalizeBilling() {
      try {
        setCheckoutNotice('verifying');
        const data = await refreshBilling();
        const isActive = Boolean(data?.subscription?.is_active);
        if (cancelled) return;
        if (isActive) {
          setCheckoutNotice('success');
          progressedRef.current = true;
          trackEvent('onboarding_billing_payment_success', withRole({
            plan_key: checkoutPlan || data?.subscription?.plan_key || data?.subscription?.current_plan || '',
          }));
          trackCheckoutCompletedFromBilling(data?.subscription, {
            planKey: checkoutPlan || data?.subscription?.plan_key || data?.subscription?.current_plan,
            eventId:
              searchParams.get('payment_id') ||
              searchParams.get('subscription_id') ||
              undefined,
          });
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete('checkout');
          setSearchParams(nextParams, { replace: true });
          navigate('/app', { replace: true });
        } else {
          setCheckoutNotice('failed');
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete('checkout');
          setSearchParams(nextParams, { replace: true });
        }
      } catch {
        if (!cancelled) {
          setCheckoutNotice('failed');
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete('checkout');
          setSearchParams(nextParams, { replace: true });
        }
      }
    }

    finalizeBilling();
    return () => {
      cancelled = true;
    };
  }, [checkoutState, navigate, refreshBilling, searchParams, setSearchParams]);

  useEffect(() => {
    trackEvent('onboarding_billing_viewed', withRole({
      checkout_state: checkoutState || 'initial',
      checkout_plan: checkoutPlan,
    }));
    if (checkoutState !== 'success') {
      trackMetaViewContent({
        content_name: 'onboarding_pricing',
        content_category: 'pricing',
        content_ids: checkoutPlan ? [checkoutPlan] : undefined,
      });
    }
  }, [checkoutPlan, checkoutState]);

  useEffect(() => {
    return () => {
      if (progressedRef.current) return;
      trackEvent('onboarding_billing_dropoff', withRole({
        step_key: 'billing',
        question_label: 'Billing / plans',
      }));
    };
  }, []);

  useEffect(() => {
    if (!loading && subscription?.is_active && checkoutState !== 'success') {
      navigate('/app', { replace: true });
    }
  }, [checkoutState, loading, navigate, subscription?.is_active]);

  useEffect(() => {
    if (loading) return;
    if (subscription?.is_active) return;
    if (subscription?.had_subscription_before) {
      navigate('/subscription-expired', { replace: true });
    }
  }, [loading, navigate, subscription?.had_subscription_before, subscription?.is_active]);

  const startCheckout = async (planKey) => {
    try {
      setActionLoading(planKey);
      trackEvent('onboarding_billing_plan_selected', withRole({ plan_key: planKey }));
      trackEvent('onboarding_billing_checkout_started', withRole({ plan_key: planKey }));
      trackCheckoutStarted(planKey, 'onboarding');
      progressedRef.current = true;
      await beginCheckout(planKey, { flow: 'onboarding' });
    } catch (err) {
      console.error(err);
      progressedRef.current = false;
      setCheckoutNotice('failed');
      trackEvent('onboarding_billing_checkout_failed', withRole({
        plan_key: planKey,
        error: err?.message || 'checkout_failed',
      }));
      setActionLoading('');
    }
  };

  if (loading) {
    return <CubeLoaderOverlay minHeight="100vh" className="min-h-screen bg-[#030303]" />;
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col px-4 py-8 text-white md:px-6 md:py-12">
        {checkoutNotice === 'verifying' ? (
          <CubeLoaderOverlay label="Verifying payment status…" minHeight="12rem" />
        ) : null}

        {checkoutNotice === 'success' ? (
          <div className="mt-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Payment successful. Activating your account...
          </div>
        ) : null}

        {checkoutNotice === 'failed' ? (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            Checkout did not complete. Choose a plan below to try again.
          </div>
        ) : null}

        <div className="mx-auto mt-6 max-w-3xl text-center md:mt-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pricing</p>
          <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
            Unlock the ads and content already converting in your niche.
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PRICING_PLANS.map((plan) => {
            const isAgency = plan.key === 'agency';
            const isCurrent = subscription?.current_plan === plan.key && subscription?.is_active;
            const isBusy = actionLoading === plan.key;
            const highlightPopular = plan.popular;
            const highlightFromQuery = checkoutPlan === plan.key && !highlightPopular;

            return (
              <div
                key={plan.key}
                className={`relative rounded-sm border p-6 ${
                  highlightPopular
                    ? 'border-emerald-400/40 bg-emerald-400/[0.06]'
                    : highlightFromQuery
                      ? 'border-emerald-400/25 bg-emerald-400/[0.04]'
                      : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                {plan.popular ? (
                  <div className="absolute right-4 top-4 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-black">
                    Popular
                  </div>
                ) : null}

                <p className="text-sm font-semibold text-white">{plan.name}</p>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-semibold text-white">${plan.price}</span>
                  <span className="pb-1 text-sm text-slate-400">/mo</span>
                </div>
                <p className="mt-3 text-sm text-slate-400">{plan.description}</p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">{plan.footnote}</p>

                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <span className="mt-0.5 text-emerald-300">+</span>
                      <span className="text-sm text-white/85">{feature}</span>
                    </div>
                  ))}
                </div>

                {isAgency ? (
                  <a
                    href="mailto:sales@viraladlibrary.com?subject=Agency%20Plan%20Inquiry"
                    onClick={() => trackEvent('onboarding_billing_agency_clicked', withRole({ plan_key: 'agency' }))}
                    className={`mt-8 inline-flex w-full justify-center rounded-sm py-3 text-sm font-bold ${
                      plan.popular ? 'bg-emerald-400 text-black hover:bg-emerald-300' : 'bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => startCheckout(plan.key)}
                    disabled={isCurrent || isBusy || checkoutNotice === 'verifying' || loading}
                    className={`mt-8 w-full rounded-sm py-3 text-sm font-bold disabled:opacity-60 ${
                      plan.popular ? 'bg-emerald-400 text-black hover:bg-emerald-300' : 'bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {isBusy ? 'Redirecting...' : isCurrent ? 'Current plan' : plan.cta}
                  </button>
                )}
              </div>
            );
          })}
        </div>
    </section>
  );
}

export default OnboardingBilling;
