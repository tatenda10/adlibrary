function createUsageGuard(metricKey, options = {}) {
  return async function usageGuard(req, res, next) {
    return next();
  };
}

module.exports = { createUsageGuard };
