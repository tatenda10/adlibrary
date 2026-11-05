import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CubeLoaderOverlay } from '../components/CubeLoader.jsx';
import { useBilling } from '../components/billing/BillingContext.jsx';
import { trackCheckoutCompletedFromBilling, trackCheckoutStarted } from '../lib/metaPixelCheckout.js';
import { trackMetaViewContent } from '../lib/metaPixel.js';
import { showInfoToast } from '../lib/toast.js';

const CHECKOUT_QUERY_KEYS = [
  'checkout',
  'checkoutPlan',
  'subscription_id',
  'payment_id',
  'status',
  'email',
];

function clearCheckoutParams(searchParams) {
  const nextParams = new URLSearchParams(searchParams);
  CHECKOUT_QUERY_KEYS.forEach((key) => nextParams.delete(key));
  return nextParams;
}

function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { subscription, usage, invoices, plans, loading, beginCheckout, openPortal, refreshBilling } = useBilling();
  const [actionLoading, setActionLoading] = useState('');
  const [checkoutNotice, setCheckoutNotice] = useState('');
  const checkoutHandledRef = useRef('');

  const checkoutPlan = searchParams.get('checkoutPlan') || '';
  const checkoutState = searchParams.get('checkout') || '';
  const checkoutEventId =
    searchParams.get('payment_id') || searchParams.get('subscription_id') || '';

  useEffect(() => {
    if (!checkoutState) {
      setCheckoutNotice((prev) => (prev === 'verifying' ? '' : prev));
      return undefined;
    }

    if (checkoutState === 'canceled') {
      if (checkoutHandledRef.current === 'canceled') return undefined;
      checkoutHandledRef.current = 'canceled';
      setCheckoutNotice('canceled');
      showInfoToast('Checkout canceled. Your plan has not changed.');
      setSearchParams((prev) => clearCheckoutParams(prev), { replace: true });
      return undefined;
    }

    if (checkoutState !== 'success') return undefined;
    if (checkoutHandledRef.current === 'success') return undefined;
    checkoutHandledRef.current = 'success';

    let cancelled = false;
    const planKeyAtStart = checkoutPlan;
    const eventIdAtStart = checkoutEventId;
    const subscriptionIdAtStart = searchParams.get('subscription_id') || '';

    async function verifyCheckoutState() {
      try {
        setCheckoutNotice('verifying');
        localStorage.removeItem('pending_checkout_plan');

        let data = null;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          data = await refreshBilling({
            silent: true,
            subscriptionId: subscriptionIdAtStart || undefined,
          });
          if (cancelled) return;
          if (data?.subscription?.is_active) break;
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
          }
        }

        if (cancelled) return;
        const ok = Boolean(data?.subscription?.is_active);
        setCheckoutNotice(ok ? 'success' : 'failed');
        if (ok) {
          showInfoToast('Payment completed. Your subscription is active.');
          trackCheckoutCompletedFromBilling(data?.subscription, {
            planKey: planKeyAtStart || data?.subscription?.plan_key || data?.subscription?.current_plan,
            eventId: eventIdAtStart || undefined,
          });
        }
        setSearchParams((prev) => clearCheckoutParams(prev), { replace: true });
      } catch {
        if (!cancelled) {
          setCheckoutNotice('failed');
          setSearchParams((prev) => clearCheckoutParams(prev), { replace: true });
        }
      }
    }

    verifyCheckoutState();
    return () => {
      cancelled = true;
    };
  }, [checkoutEventId, checkoutPlan, checkoutState, refreshBilling, searchParams, setSearchParams]);

  useEffect(() => {
    if (checkoutState === 'success') return;
    trackMetaViewContent({
      content_name: 'billing',
      content_category: 'pricing',
      content_ids: checkoutPlan ? [checkoutPlan] : undefined,
    });
  }, [checkoutPlan, checkoutState]);

  const activePlanName = labelForPlan(subscription?.current_plan);
  const isSubscribed = Boolean(subscription?.is_active);
  const currentPlan = useMemo(
    () => plans.find((plan) => plan.key === subscription?.current_plan) || null,
    [plans, subscription?.current_plan]
  );
  const planPrice = Number(subscription?.monthly_price ?? currentPlan?.price ?? 0);
  const cardBrand = inferCardBrand(subscription?.metadata);
  const cardLast4 = inferCardLast4(subscription?.metadata);
  const paymentEmail = inferBillingEmail(subscription?.metadata);
  const usageSnapshot = getUsageSnapshot(usage);

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
        trackCheckoutStarted(planKey, 'billing');
        await beginCheckout(planKey);
      }
    } catch (err) {
      console.error(err);
      setCheckoutNotice('failed');
      setActionLoading('');
    }
  };

  const handlePortal = async () => {
    try {
      setActionLoading('portal');
      await openPortal();
    } catch (err) {
      console.error(err);
      setActionLoading('');
    }
  };

  if (loading && checkoutState !== 'success') {
    return <CubeLoaderOverlay label="Loading billing..." minHeight="52vh" />;
  }

  return (
    <section className="min-h-full bg-white text-slate-950">
      <header className="border-b border-slate-200 px-8 py-7">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your billing and payment details.</p>
      </header>

      <div className="space-y-7 px-8 py-7">
        <CheckoutNotice value={checkoutNotice} />

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{activePlanName} plan</p>
                    {isSubscribed ? (
                      <span className="rounded-sm bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Monthly
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {isSubscribed ? 'Your active plan for ad research and creation.' : 'Choose a plan to unlock the app.'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-semibold tracking-tight">
                    ${Number.isFinite(planPrice) ? planPrice : 0}
                    <span className="ml-1 text-sm font-normal text-slate-500">per month</span>
                  </p>
                </div>
              </div>

              <div className="mt-7">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{usageSnapshot.label}</span>
                  <span className="text-slate-500">{usageSnapshot.caption}</span>
                </div>
                <div className="h-2 rounded-full bg-emerald-50">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{ width: `${usageSnapshot.percent}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={isSubscribed ? handlePortal : () => handleCheckout('starter')}
                disabled={actionLoading === 'portal' || actionLoading === 'starter'}
                className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 disabled:opacity-60"
              >
                {isSubscribed ? 'Upgrade plan' : 'Choose plan'}
                <ArrowUpRightIcon />
              </button>
            </div>
          </article>

          <article className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="p-5">
              <p className="text-sm font-semibold">Payment method</p>
              <p className="mt-1 text-xs text-slate-500">Change how you pay for your plan.</p>

              <div className="mt-6 flex items-center justify-between rounded-md border border-slate-200 px-4 py-4">
                <div className="flex items-center gap-4">
                  <div className="grid h-11 w-16 place-items-center rounded-sm bg-slate-50 text-sm font-bold uppercase text-blue-800">
                    {cardBrand}
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">{cardBrand} ending in {cardLast4}</p>
                    <p className="text-xs text-slate-500">Expiry {inferCardExpiry(subscription?.metadata)}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <MailIcon />
                      {paymentEmail}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePortal}
                  disabled={actionLoading === 'portal' || !subscription?.dodo_customer_id}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                >
                  {actionLoading === 'portal' ? 'Opening...' : 'Edit'}
                </button>
              </div>
            </div>
          </article>
        </div>

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Billing and invoicing</h2>
              <p className="mt-1 text-sm text-slate-500">Pick an account plan that fits your workflow.</p>
            </div>
            <button
              type="button"
              onClick={handlePortal}
              disabled={actionLoading === 'portal' || !subscription?.dodo_customer_id}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              <DownloadCloudIcon />
              Download all
            </button>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <span className="block h-4 w-4 rounded-sm border border-slate-200 bg-white" />
                  </th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Billing date ↓</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length ? (
                  invoices.map((invoice, index) => (
                    <tr key={invoice.id || index} className="bg-white">
                      <td className="px-4 py-4">
                        <span className="block h-4 w-4 rounded-sm border border-slate-200" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                            <FileIcon />
                          </span>
                          <span className="font-medium">Invoice #{formatInvoiceNumber(invoice, index)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{formatDate(invoice.date)}</td>
                      <td className="px-4 py-4">
                        <StatusPill value={invoice.status} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">{formatAmount(invoice.amount, subscription?.currency)}</td>
                      <td className="px-4 py-4 text-slate-600">{activePlanName} plan</td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={handlePortal}
                          disabled={actionLoading === 'portal' || !subscription?.dodo_customer_id}
                          className="text-sm font-medium text-emerald-700 disabled:opacity-60"
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-sm text-slate-500">
                      No invoices yet. They will appear here after your first paid invoice syncs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

function CheckoutNotice({ value }) {
  if (value === 'verifying') {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Verifying payment status...
      </div>
    );
  }
  if (value === 'success') {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        Payment completed successfully. Billing status is refreshing.
      </div>
    );
  }
  if (value === 'failed') {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Checkout did not complete. You can try again below.
      </div>
    );
  }
  return null;
}

function getUsageSnapshot(usage) {
  const rows = Object.entries(usage?.usage || {});
  const row = rows.find(([, value]) => Number(value?.limit) > 0) || rows[0];
  if (!row) {
    return { label: '0 of 0 usage', caption: 'No usage yet', percent: 0 };
  }
  const [key, value] = row;
  const used = Number(value?.used || 0);
  const limit = Number(value?.limit || 0);
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return {
    label: `${used} of ${limit || '∞'} ${humanizeMetric(key)}`,
    caption: limit > 0 ? `${Math.max(0, limit - used)} remaining` : 'Unlimited',
    percent,
  };
}

function humanizeMetric(key) {
  return String(key || 'usage')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .toLowerCase();
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
  return '1234';
}

function inferCardExpiry(metadata) {
  const month = metadata?.card_exp_month || metadata?.exp_month || metadata?.payment_method?.exp_month;
  const year = metadata?.card_exp_year || metadata?.exp_year || metadata?.payment_method?.exp_year;
  if (month && year) return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
  return '06/2028';
}

function inferBillingEmail(metadata) {
  return metadata?.billing_email || metadata?.email || metadata?.customer_email || 'billing@viraladlibrary.site';
}

function StatusPill({ value }) {
  const status = String(value || 'pending').toLowerCase();
  const isGood = ['paid', 'active', 'succeeded', 'successful'].includes(status);
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-1 text-xs font-medium ${isGood ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      ✓ {value || 'pending'}
    </span>
  );
}

function formatInvoiceNumber(invoice, index) {
  const id = String(invoice?.id || '').replace(/\D/g, '');
  if (id) return id.slice(-4).padStart(3, '0');
  return String(index + 1).padStart(3, '0');
}

function labelForPlan(planKey) {
  if (planKey === 'starter') return 'Starter';
  if (planKey === 'pro') return 'Pro';
  if (planKey === 'agency') return 'Agency';
  return 'Basic';
}

function formatDate(value) {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17 17 7" strokeLinecap="round" />
      <path d="M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function DownloadCloudIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 13v7" strokeLinecap="round" />
      <path d="m8 16 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16.5a4 4 0 0 0-2-7.46A6 6 0 0 0 6.1 10.5 3.5 3.5 0 0 0 7.5 17H9" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export default Billing;
