import { CubeLoaderOverlay } from '../CubeLoader.jsx';
import UpgradePrompt from './UpgradePrompt.jsx';
import { useBilling } from './BillingContext.jsx';

const BILLING_GUARD_DEBUG = true;

function hasProAccess(subscription) {
  if (!subscription) return false;
  if (subscription.is_pro) return true;
  const plan = String(subscription.current_plan || '').toLowerCase();
  const key = String(subscription.plan_key || '').toLowerCase();
  return plan.includes('pro') || key.includes('pro');
}

export function RequirePaidAccess({ children }) {
  const { loading, subscription } = useBilling();

  if (loading) {
    return <CubeLoaderOverlay label="Loading billing status…" minHeight="52vh" />;
  }

  if (!subscription?.is_active) {
    if (BILLING_GUARD_DEBUG) {
      console.log('[BillingGuard] RequirePaidAccess blocked route:', window.location.pathname, subscription);
    }
    return <UpgradePrompt />;
  }

  return children;
}

export function RequireProAccess({ children }) {
  const { loading, subscription } = useBilling();

  if (loading) {
    return <CubeLoaderOverlay label="Loading billing status…" minHeight="52vh" />;
  }

  if (!subscription?.is_active) {
    if (BILLING_GUARD_DEBUG) {
      console.log('[BillingGuard] RequireProAccess blocked inactive route:', window.location.pathname, subscription);
    }
    return <UpgradePrompt />;
  }

  if (!hasProAccess(subscription)) {
    if (BILLING_GUARD_DEBUG) {
      console.log('[BillingGuard] RequireProAccess blocked non-pro route:', window.location.pathname, subscription);
    }
    return (
      <UpgradePrompt
        title="Upgrade to Pro"
        description="This feature is available on Pro. Upgrade to unlock advanced AI search, CRO audits, and premium workflows."
        requirePro
      />
    );
  }

  return children;
}
