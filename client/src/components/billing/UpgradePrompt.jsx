import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CubeLoader from '../CubeLoader.jsx';
import { useApiToast } from '../../hooks/useApiToast.js';
import { useBilling } from './BillingContext.jsx';

function UpgradePrompt({
  title = 'Unlock the research workspace',
  description = 'Choose a paid plan to access searches, saves, and analysis tools.',
  requirePro = false,
}) {
  const navigate = useNavigate();
  const { subscription, beginCheckout, openPortal } = useBilling();
  const { notifyApiError } = useApiToast();
  const [loadingPlan, setLoadingPlan] = useState('');

  const isStarter = subscription?.current_plan === 'starter';

  const handleCheckout = async (planKey) => {
    try {
      setLoadingPlan(planKey);
      if (subscription?.is_active && subscription?.current_plan !== planKey) {
        await openPortal();
      } else {
        await beginCheckout(planKey);
      }
    } catch (err) {
      console.error(err);
      notifyApiError(err, 'Failed to start checkout');
      setLoadingPlan('');
    }
  };

  return (
    <section className="grid min-h-[52vh] place-items-center">
      <div className="w-full max-w-3xl rounded-xl app-card p-6 text-center">
        <p className="text-xs uppercase tracking-[0.18em] app-muted">Billing</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-3 text-sm app-muted">{description}</p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <PlanCard
            name="Starter"
            price="$49/mo"
            active={subscription?.current_plan === 'starter'}
            buttonLabel={isStarter && !requirePro ? 'Current plan' : 'Choose Starter'}
            loading={loadingPlan === 'starter'}
            disabled={subscription?.current_plan === 'starter'}
            onClick={() => handleCheckout('starter')}
          />
          <PlanCard
            name="Pro"
            price="$99/mo"
            active={subscription?.current_plan === 'pro'}
            buttonLabel={subscription?.current_plan === 'pro' ? 'Current plan' : isStarter ? 'Upgrade to Pro' : 'Choose Pro'}
            loading={loadingPlan === 'pro'}
            disabled={subscription?.current_plan === 'pro'}
            onClick={() => handleCheckout('pro')}
          />
          <article className="rounded-lg border p-4 text-left" style={{ borderColor: 'var(--app-border)' }}>
            <p className="text-sm font-semibold text-white">Agency</p>
            <p className="mt-1 text-2xl font-semibold text-white">$299/mo</p>
            <p className="mt-3 text-xs app-muted">For teams that need multi-brand workflows and white-label support.</p>
            <a
              href="mailto:sales@viraladlibrary.com?subject=Agency%20Plan%20Inquiry"
              className="mt-4 inline-flex rounded-md border px-3 py-2 text-xs font-semibold text-white"
              style={{ borderColor: 'var(--app-border)' }}
            >
              Talk to Sales
            </a>
          </article>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="rounded-md border px-4 py-2 text-sm font-semibold text-white"
            style={{ borderColor: 'var(--app-border)' }}
          >
            Open Billing
          </button>
        </div>

      </div>
    </section>
  );
}

function PlanCard({ name, price, active, buttonLabel, loading, disabled, onClick }) {
  return (
    <article
      className="rounded-lg border p-4 text-left"
      style={{ borderColor: active ? '#25d366' : 'var(--app-border)' }}
    >
      <p className="text-sm font-semibold text-white">{name}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{price}</p>
      <p className="mt-3 text-xs app-muted">
        {name === 'Starter'
          ? 'Core research access across the workspace.'
          : 'Advanced AI workflows, CRO audit, and premium tools.'}
      </p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="mt-4 flex min-h-[2.25rem] items-center justify-center rounded-md bg-[#25d366] px-3 py-2 text-xs font-semibold text-black disabled:opacity-60"
      >
        {loading ? <CubeLoader size={48} /> : buttonLabel}
      </button>
    </article>
  );
}

export default UpgradePrompt;
