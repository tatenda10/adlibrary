import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { useBilling } from '../components/billing/BillingContext.jsx';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { PRICING_PLANS } from '../lib/pricingPlans.js';
import { trackCheckoutStarted } from '../lib/metaPixelCheckout.js';
import { trackMetaViewContent } from '../lib/metaPixel.js';
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
  const { notifyApiError, showWarning, showSuccess } = useApiToast();
  const [actionLoading, setActionLoading] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(true);

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

  useEffect(() => {
    trackMetaViewContent({
      content_name: 'subscription_expired',
      content_category: 'pricing',
    });
  }, []);

  const startCheckout = async (planKey) => {
    try {
      setActionLoading(planKey);
      trackCheckoutStarted(planKey, 'reactivation');
      await beginCheckout(planKey);
    } catch (err) {
      console.error(err);
      notifyApiError(err, 'Failed to start checkout. Please try again.');
      setActionLoading('');
    }
  };

  const handleRefreshStatus = async () => {
    try {
      setRefreshing(true);
      const subscriptionId =
        new URLSearchParams(window.location.search).get('subscription_id') || undefined;
      let data = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        data = await refreshBilling({ silent: true, subscriptionId });
        if (data?.subscription?.is_active) break;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      if (data?.subscription?.is_active) {
        showSuccess('Payment found — restoring access.');
        navigate('/app', { replace: true });
        return;
      }
      showWarning('No active subscription yet. If you just paid, wait a moment and try again.');
    } catch (err) {
      notifyApiError(err, 'Could not refresh billing status.');
    } finally {
      setRefreshing(false);
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStatusModalOpen(true)}
          className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/15"
        >
          Why is access paused?
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
        >
          Sign out
        </button>
      </div>

      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Renew</p>
        <h1 className="mt-2 text-xl font-semibold md:text-2xl">Choose a plan to continue</h1>
        <p className="mt-2 text-sm text-slate-400">Starter and Pro are self-serve. Agency is available through sales.</p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {PRICING_PLANS.map((plan) => {
          const isAgency = plan.key === 'agency';
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
                  disabled={isBusy}
                  className={`mt-8 w-full rounded-sm py-3 text-sm font-bold disabled:opacity-60 ${
                    plan.popular ? 'bg-emerald-400 text-black hover:bg-emerald-300' : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  {isBusy ? 'Redirecting...' : plan.cta}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {statusModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscription-status-title"
          onClick={() => setStatusModalOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            style={{ background: '#0a0a0a' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 bg-gradient-to-br from-amber-500/12 via-transparent to-emerald-500/10 px-6 py-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300">Subscription ended</p>
              <h2 id="subscription-status-title" className="mt-2 text-xl font-semibold text-white">
                Your workspace access is paused
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {lastPlan !== 'Your plan' ? (
                  <>
                    Your previous plan was <span className="font-semibold text-white">{lastPlan}</span>. Choose a plan
                    below to restore access — no need to redo onboarding.
                  </>
                ) : (
                  <>Your subscription is no longer active. Renew below to restore access.</>
                )}
              </p>
            </div>

            <div className="space-y-3 px-6 py-5">
              <button
                type="button"
                onClick={handleRefreshStatus}
                disabled={refreshing}
                className="w-full rounded-sm border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/15 disabled:opacity-60"
              >
                {refreshing ? 'Checking payment…' : 'I already paid — refresh status'}
              </button>
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="w-full rounded-sm bg-emerald-400 px-4 py-3 text-sm font-bold text-black hover:bg-emerald-300"
              >
                Choose a plan
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-sm border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default SubscriptionExpired;
