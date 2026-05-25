import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getBillingLimitMessage,
  getBillingLimitTitle,
  getUsageDetailFromError,
} from '../../lib/billingErrors.js';
import { useBilling } from './BillingContext.jsx';

export default function BillingLimitModal({ open, error, onClose }) {
  const navigate = useNavigate();
  const { subscription, beginCheckout, openPortal } = useBilling();
  const [loadingAction, setLoadingAction] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const usageDetail = useMemo(() => getUsageDetailFromError(error), [error]);
  const title = getBillingLimitTitle(error);
  const message = getBillingLimitMessage(error);
  const isPro = Boolean(subscription?.is_pro);
  const isAgency = String(subscription?.current_plan || '').includes('agency');
  const code = String(error?.code || '').toLowerCase();

  if (!open) return null;

  const handleUpgrade = async () => {
    try {
      setLoadingAction('upgrade');
      if (subscription?.is_active && !isAgency) {
        await openPortal();
      } else if (!isPro) {
        await beginCheckout('pro');
      } else {
        navigate('/billing');
      }
    } catch {
      navigate('/billing');
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-limit-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 shadow-2xl"
        style={{ background: 'var(--app-panel)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 bg-gradient-to-br from-amber-500/10 via-transparent to-[#25d366]/10 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
              <LimitIcon />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Usage</p>
              <h2 id="billing-limit-title" className="mt-1 text-xl font-semibold text-white">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{message}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {usageDetail ? (
            <div className="rounded-sm border border-white/10 bg-black/20 px-4 py-3">
              <div className="flex items-center justify-between gap-2 text-xs text-white/55">
                <span>{usageDetail.label}</span>
                <span>
                  {usageDetail.used} / {usageDetail.limit} this cycle
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400"
                  style={{ width: `${usageDetail.percent}%` }}
                />
              </div>
              {isPro && code === 'quota_exceeded' ? (
                <p className="mt-2 text-[11px] text-white/45">
                  You are on Pro. Limits reset at the start of your next billing cycle, or upgrade to Agency
                  for higher volume.
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-white/45">
            {code === 'subscription_required'
              ? 'Choose a paid plan to unlock searches, workspace saves, and analysis tools.'
              : isPro
                ? 'Open billing to review usage across all tools for this month.'
                : 'Upgrade for higher monthly limits, or wait until your billing cycle resets.'}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onClose?.();
                navigate('/billing');
              }}
              className="rounded-sm bg-[#25d366] px-4 py-2.5 text-sm font-semibold text-black"
            >
              View billing & usage
            </button>
            {!isAgency ? (
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={Boolean(loadingAction)}
                className="rounded-sm border border-white/15 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loadingAction === 'upgrade'
                  ? 'Opening…'
                  : isPro
                    ? 'Manage plan'
                    : 'Upgrade plan'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm px-4 py-2.5 text-sm text-white/55 hover:text-white"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LimitIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
      <path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" strokeLinejoin="round" />
    </svg>
  );
}
