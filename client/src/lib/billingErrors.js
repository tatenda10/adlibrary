import { isBillingOrQuotaError } from './api.js';

const METRIC_LABELS = {
  tiktok_searches: 'TikTok searches',
  tiktok_workspace_videos: 'Workspace video saves',
  facebook_searches: 'Facebook searches',
  instagram_searches: 'Instagram searches',
  ai_analyses: 'AI analyses',
  cro_audits: 'CRO audits',
};

export function metricLabel(metricKey) {
  return METRIC_LABELS[metricKey] || String(metricKey || 'usage').replace(/_/g, ' ');
}

export function getBillingLimitTitle(err) {
  const code = String(err?.code || '').toLowerCase();
  if (code === 'subscription_required') return 'Subscription required';
  if (code === 'pro_required') return 'Pro plan required';
  if (code === 'collection_limit_reached') return 'Collection limit reached';
  if (code === 'quota_exceeded') return 'Monthly limit reached';
  return 'Plan limit reached';
}

export function getBillingLimitMessage(err) {
  const code = String(err?.code || '').toLowerCase();
  const raw = String(err?.message || '').trim();
  const prompt = String(err?.upgrade_prompt || '').trim();

  if (code === 'quota_exceeded' && raw) {
    return raw;
  }
  if (raw) return raw;
  if (prompt) return prompt;
  return 'You have reached a limit on your current plan for this billing cycle.';
}

export function getUsageDetailFromError(err) {
  const metric = String(err?.metric || '').trim();
  if (!metric || !err?.usage?.usage) return null;

  const row = err.usage.usage[metric];
  if (!row) return null;

  const used = Number(row.used) || 0;
  const limit = Number(row.limit) || 0;
  const remaining = Math.max(0, Number(row.remaining) || 0);

  return {
    metric,
    label: metricLabel(metric),
    used,
    limit,
    remaining,
    percent: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0,
    planKey: err?.usage?.plan_key || err?.subscription?.plan_key || '',
  };
}

export function shouldShowBillingLimitModal(err) {
  return isBillingOrQuotaError(err);
}
