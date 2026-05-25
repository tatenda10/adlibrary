import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { useBilling } from '../components/billing/BillingContext.jsx';
import { useApiToast } from '../hooks/useApiToast.js';
import { showErrorToast, showInfoToast } from '../lib/toast.js';

function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { subscription, usage, invoices, plans, loading, beginCheckout, openPortal, refreshBilling } = useBilling();
  const { notifyApiError } = useApiToast();
  const [actionLoading, setActionLoading] = useState('');
  const [checkoutNotice, setCheckoutNotice] = useState('');

  const checkoutPlan = searchParams.get('checkoutPlan') || '';
  const checkoutState = searchParams.get('checkout') || '';

  useEffect(() => {
    let cancelled = false;

    async function verifyCheckoutState() {
      if (!checkoutState) {
        setCheckoutNotice('');
        return;
      }
      if (checkoutState === 'canceled') {
        setCheckoutNotice('canceled');
        showInfoToast('Checkout canceled. Your plan has not changed.');
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('checkout');
        setSearchParams(nextParams, { replace: true });
        return;
      }
      if (checkoutState !== 'success') return;

      try {
        setCheckoutNotice('verifying');
        localStorage.removeItem('pending_checkout_plan');
        const data = await refreshBilling();
        if (cancelled) return;
        const ok = data?.subscription?.is_active;
        setCheckoutNotice(ok ? 'success' : 'failed');
        if (ok) {
          showInfoToast('Payment completed. Your subscription is active.');
        } else {
          showErrorToast(null, 'Payment was not completed. Your subscription is still inactive.');
        }
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('checkout');
        setSearchParams(nextParams, { replace: true });
      } catch {
        if (!cancelled) {
          setCheckoutNotice('failed');
          showErrorToast(null, 'Could not verify payment. Check billing or try again.');
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete('checkout');
          setSearchParams(nextParams, { replace: true });
        }
      }
    }

    verifyCheckoutState();
    return () => {
      cancelled = true;
    };
  }, [checkoutState, refreshBilling, searchParams, setSearchParams]);

  const planCards = useMemo(
    () => [
      { label: 'Current Plan', value: labelForPlan(subscription?.current_plan) },
      { label: 'Status', value: subscription?.status || 'unsubscribed' },
      { label: 'Renewal Date', value: formatDate(subscription?.current_period_end) },
      {
        label: 'Monthly Spend',
        value: subscription?.monthly_price ? `$${subscription.monthly_price}.00` : 'None',
      },
    ],
    [subscription]
  );
  const activePlanName = labelForPlan(subscription?.current_plan);
  const isSubscribed = Boolean(subscription?.is_active);
  const cardBrand = inferCardBrand(subscription?.metadata);
  const cardLast4 = inferCardLast4(subscription?.metadata);

  const handleCheckout = async (planKey) => {
    try {
      setActionLoading(planKey);
      if (checkoutPlan) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('checkoutPlan');
        setSearchParams(nextParams, { replace: true });
      }
      if (subscription?.is_active && subscription?.current_plan !== planKey) {
        await openPortal();
      } else {
        await beginCheckout(planKey);
      }
    } catch (err) {
      console.error(err);
      notifyApiError(err, 'Failed to start checkout. Please try again.');
      setActionLoading('');
    }
  };

  const handlePortal = async () => {
    try {
      setActionLoading('portal');
      await openPortal();
    } catch (err) {
      console.error(err);
      notifyApiError(err, 'Failed to open billing portal. Please try again.');
      setActionLoading('');
    }
  };

  if (loading) {
    return <CubeLoaderOverlay label="Loading billing…" minHeight="52vh" />;
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {planCards.map((card) => (
          <article key={card.label} className="rounded-lg app-card p-4">
            <p className="text-xs uppercase tracking-[0.14em] app-muted">{card.label}</p>
            <p className="mt-2 text-xl font-semibold">{card.value}</p>
          </article>
        ))}
      </div>

      {checkoutNotice === 'verifying' ? (
        <div className="rounded-lg border border-slate-500/30 bg-slate-500/10 p-3 text-sm text-slate-300">
          Verifying payment status...
        </div>
      ) : null}

      {checkoutNotice === 'success' ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          Payment completed successfully. Billing status is refreshing.
        </div>
      ) : null}

      <article className="bg-black p-1">
        <p className="text-lg font-semibold">Active subscriptions</p>
        <div className="mt-4 bg-black p-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm app-muted">{activePlanName}</p>
              <p className="mt-2 text-3xl font-semibold">
                {subscription?.monthly_price ? `$${Number(subscription.monthly_price).toFixed(2)}` : '$0.00'}
                <span className="ml-1 text-base font-medium app-muted">/Month</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border px-2.5 py-1 app-muted" style={{ borderColor: 'var(--app-border)' }}>
                renews on {formatDate(subscription?.current_period_end)}
              </span>
              <span className="rounded-full border px-2.5 py-1 app-muted" style={{ borderColor: 'var(--app-border)' }}>
                valid till {formatDate(subscription?.current_period_end)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePortal}
              disabled={actionLoading === 'portal' || !subscription?.dodo_customer_id}
              className="rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {actionLoading === 'portal' ? 'Opening...' : 'Manage subscription'}
            </button>
            {!isSubscribed && plans
              .filter((plan) => plan.key !== 'agency')
              .map((plan) => (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => handleCheckout(plan.key)}
                  disabled={actionLoading === plan.key}
                  className="rounded-md bg-[#25d366] px-3 py-2 text-xs font-semibold text-black disabled:opacity-60"
                >
                  {actionLoading === plan.key ? 'Redirecting...' : plan.cta}
                </button>
              ))}
          </div>
        </div>
      </article>

      <article className="bg-black p-1">
        <p className="text-lg font-semibold">Payment Methods</p>
        <div className="mt-4 flex items-center justify-between gap-3 bg-black px-0 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md border" style={{ borderColor: 'var(--app-border)' }}>
              <CardIcon />
            </div>
            <div>
              <p className="text-sm font-semibold">Card {cardBrand}</p>
              <p className="text-xs app-muted">**** {cardLast4}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePortal}
            disabled={actionLoading === 'portal' || !subscription?.dodo_customer_id}
            className="ml-auto rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {actionLoading === 'portal' ? 'Opening...' : 'Add payment method'}
          </button>
        </div>
      </article>

      <article className="bg-black p-1">
        <p className="text-lg font-semibold">Billing History</p>
        <div className="mt-4 overflow-hidden border" style={{ borderColor: 'var(--app-border)' }}>
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-3 border-b px-4 py-3 text-xs uppercase tracking-[0.12em] app-muted" style={{ borderColor: 'var(--app-border)' }}>
            <span>Date</span>
            <span>Status</span>
            <span>Amount</span>
            <span>Pricing Type</span>
            <span>Entitlements</span>
            <span>Invoice</span>
          </div>
          {invoices.length ? (
            invoices.map((invoice) => (
              <div key={invoice.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] items-center gap-3 px-4 py-3 text-sm">
                <span>{formatDate(invoice.date)}</span>
                <span>
                  <StatusPill value={invoice.status} />
                </span>
                <span>{formatAmount(invoice.amount, subscription?.currency)}</span>
                <span className="app-muted">Subscription</span>
                <span className="app-muted">-</span>
                <button
                  type="button"
                  onClick={handlePortal}
                  disabled={actionLoading === 'portal' || !subscription?.dodo_customer_id}
                  className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                  style={{ borderColor: 'var(--app-border)' }}
                  aria-label={`Open invoice ${invoice.id}`}
                >
                  <DownloadIcon />
                </button>
              </div>
            ))
          ) : (
            <p className="px-4 py-4 text-sm app-muted">
              No invoices yet. This usually appears after webhook sync or a successful invoice fetch from Dodo.
            </p>
          )}
        </div>
      </article>

    </section>
  );
}

function inferCardBrand(metadata) {
  const text = JSON.stringify(metadata || {}).toLowerCase();
  if (text.includes('mastercard')) return 'mastercard';
  if (text.includes('amex')) return 'amex';
  if (text.includes('visa')) return 'visa';
  return 'visa';
}

function inferCardLast4(metadata) {
  const candidates = [
    metadata?.card_last4,
    metadata?.last4,
    metadata?.payment_method?.last4,
  ];
  for (const value of candidates) {
    const asText = String(value || '').trim();
    if (/^\d{4}$/.test(asText)) return asText;
  }
  return '4242';
}

function StatusPill({ value }) {
  const status = String(value || 'pending').toLowerCase();
  const isGood = ['paid', 'active', 'succeeded', 'successful'].includes(status);
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${isGood ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
      {value || 'pending'}
    </span>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4v10" strokeLinecap="round" />
      <path d="m8 10 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}

function labelForPlan(planKey) {
  if (planKey === 'starter') return 'Starter';
  if (planKey === 'pro') return 'Pro';
  if (planKey === 'agency') return 'Agency';
  return 'Unsubscribed';
}

function formatDate(value) {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return String(value);
  }
}

function formatAmount(amount, currency = 'USD') {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 'N/A';
  if (value > 999) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
    }).format(value / 100);
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
  }).format(value);
}

export default Billing;
