import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { useBilling } from '../components/billing/BillingContext.jsx';
import { PRICING_PLANS } from '../lib/pricingPlans.js';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { useApiToast } from '../hooks/useApiToast.js';
import { showErrorToast, showInfoToast } from '../lib/toast.js';
import { trackEvent } from '../lib/firebaseAnalytics.js';

function OnboardingBilling() {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const [searchParams, setSearchParams] = useSearchParams();
  const { beginCheckout, refreshBilling, loading, subscription } = useBilling();
  const { notifyApiError, showWarning } = useApiToast();
  const [actionLoading, setActionLoading] = useState('');
  const [checkoutNotice, setCheckoutNotice] = useState('');

  const checkoutPlan = searchParams.get('checkoutPlan') || '';
  const checkoutState = searchParams.get('checkout') || '';

  useEffect(() => {
    if (!checkoutState) {
      setCheckoutNotice('');
      return;
    }
    if (checkoutState === 'canceled') {
      setCheckoutNotice('canceled');
      showInfoToast('Payment canceled. Choose a plan below to continue.');
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
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete('checkout');
          setSearchParams(nextParams, { replace: true });
          navigate('/app', { replace: true });
        } else {
          setCheckoutNotice('failed');
          showErrorToast(null, 'Payment was not completed. Try checkout again or use a different card.');
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
    trackEvent('onboarding_billing_viewed', {
      checkout_state: checkoutState || 'initial',
      checkout_plan: checkoutPlan,
    });
  }, [checkoutPlan, checkoutState]);

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
      trackEvent('onboarding_billing_checkout_started', { plan_key: planKey });
      await beginCheckout(planKey, { flow: 'onboarding' });
    } catch (err) {
      console.error(err);
      notifyApiError(err, 'Failed to start checkout. Please try again.');
      trackEvent('onboarding_billing_checkout_failed', {
        plan_key: planKey,
        error: err?.message || 'checkout_failed',
      });
      setActionLoading('');
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('pending_checkout_plan');
      localStorage.removeItem('pending_app_flow');
      trackEvent('onboarding_billing_signout_clicked', {});
      await signOut({ redirectUrl: '/' });
    } catch (err) {
      console.error(err);
      showWarning('Failed to sign out. Please try again.');
    }
  };

  if (loading) {
    return <CubeLoaderOverlay minHeight="100vh" className="min-h-screen bg-[#030303]" />;
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col px-4 py-8 text-white md:px-6 md:py-12">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 md:p-10">
        {checkoutNotice === 'verifying' ? (
          <CubeLoaderOverlay label="Verifying payment status…" minHeight="12rem" />
        ) : null}

        {checkoutNotice === 'success' ? (
          <div className="mt-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Payment successful. Activating your account...
          </div>
        ) : null}

        <div className="mx-auto mt-6 max-w-3xl text-center md:mt-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pricing</p>
          <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
            Choose the plan that matches your research depth and team needs.
          </h2>
          <p className="mt-3 text-base text-slate-400">
            Starter and Pro are self-serve. Agency is available through a sales conversation.
          </p>
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
      </div>
    </section>
  );
}

export default OnboardingBilling;
