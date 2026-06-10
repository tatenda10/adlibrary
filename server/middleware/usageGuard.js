const {
  buildQuotaErrorPayload,
  getLimitForMetric,
  getUsageSummaryByUserId,
  incrementUsage,
} = require('../utils/usage');

function createUsageGuard(metricKey, options = {}) {
  return async function usageGuard(req, res, next) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const amount = Math.max(1, Number(options.amount || 1));
      const summary = await getUsageSummaryByUserId(req.user.id, req.subscription);
      const metricUsage = summary?.usage?.[metricKey] || {
        used: 0,
        limit: getLimitForMetric(req.subscription, metricKey),
        remaining: getLimitForMetric(req.subscription, metricKey),
      };

      if (!Number(metricUsage.limit) || Number(metricUsage.used) + amount > Number(metricUsage.limit)) {
        return res.status(402).json(
          buildQuotaErrorPayload(req.subscription, metricKey, summary, {
            message: options.message,
            upgrade_prompt: options.upgradePrompt,
          })
        );
      }

      let handled = false;
      res.once('finish', () => {
        if (handled || res.statusCode >= 400) return;
        handled = true;
        void incrementUsage(req.user.id, req.subscription, metricKey, amount).catch((error) => {
          console.error(`usageGuard increment failed for ${metricKey}:`, error);
        });
      });

      return next();
    } catch (error) {
      console.error(`usageGuard error for ${metricKey}:`, error);
      return res.status(500).json({ error: 'Failed to validate usage limits.' });
    }
  };
}

module.exports = { createUsageGuard };
