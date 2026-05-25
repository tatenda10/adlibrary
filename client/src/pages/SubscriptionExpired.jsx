import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { useBilling } from '../components/billing/BillingContext.jsx';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { PRICING_PLANS } from '../lib/pricingPlans.js';
import { useApiToast } from '../hooks/useApiToast.js';

function planLabel(key) {
  if (key === 'starter') return 'Starter';
  if (key === 'pro') return 'Pro';
  if (key === 'agency') return 'Agency';
  return 'Your plan';
}

function SubscriptionExpired() {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { beginCheckout, refreshBilling, loading, subscription } = useBilling();
  const { notifyApiError, showWarning } = useApiToast();
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    if (!loading && subscription?.is_active) {
      navigate('/app', { replace: true });
    }
  }, [loading, navigate, subscription?.is_active]);

  useEffect(() => {
    if (loading) return;
    if (subscription?.is_active) return;
    if (!subscription?.had_subscription_before) {
      navigate('/onboarding/billing', { replace: true });
    }
  }, [loading, navigate, subscription?.had_subscription_before, subscription?.is_active]);

  const startCheckout = async (planKey) => {
    try {
      setActionLoading(planKey);
      await beginCheckout(planKey);
    } catch (err) {
      console.error(err);
      notifyApiError(err, 'Failed to start checkout. Please try again.');
      setActionLoading('');
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('pending_checkout_plan');
      localStorage.removeItem('pending_app_flow');
      await signOut({ redirectUrl: '/' });
    } catch (err) {
      console.error(err);
      showWarning('Failed to sign out. Please try again.');
    }
  };

  if (loading) {
    return <CubeLoaderOverlay minHeight="100vh" className="min-h-screen bg-[#030303]" />;
  }

  const lastPlan = planLabel(subscription?.plan_key);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col bg-[#030303] px-4 py-8 text-white md:px-6 md:py-12">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
        >
          Sign out
        </button>
      </div>

      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-6 md:p-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300">Subscription ended</p>
        <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Your workspace access is paused</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300 md:text-base">
          {lastPlan !== 'Your plan' ? (
            <>
              Your previous plan was <span className="font-semibold text-white">{lastPlan}</span>. It is no longer active, so you do not need to complete onboarding again. Choose a plan below to restore access.
            </>
          ) : (
            <>Your subscription is no longer active. Renew below to restore access without going through onboarding again.</>
          )}
        </p>
        <button
          type="button"
          onClick={() => refreshBilling()}
          className="mt-4 text-xs font-semibold text-emerald-300 underline-offset-2 hover:underline"
        >
          I already paid — refresh status
        </button>
      </div>

      <div className="mx-auto mt-8 max-w-3xl text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Renew</p>
        <h2 className="mt-2 text-xl font-semibold md:text-2xl">Choose a plan to continue</h2>
        <p className="mt-2 text-sm text-slate-400">Starter and Pro are self-serve. Agency is available through sales.</p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {PRICING_PLANS.map((plan) => {
          const isAgency = plan.key === 'agency';
          const isCurrent = subscription?.current_plan === plan.key && subscription?.is_active;
          const isBusy = actionLoading === plan.key;

          return (
            <div
              key={plan.key}
              className={`relative rounded-sm border p-6 ${
                plan.popular ? 'border-emerald-400/40 bg-emerald-400/[0.06]' : 'border-white/10 bg-white/[0.03]'
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
                  disabled={isCurrent || isBusy}
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

export default SubscriptionExpired;
