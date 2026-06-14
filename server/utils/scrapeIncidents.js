const { recordApiIncident } = require('./observabilityStore');

const UNHEALTHY_RUN_STATUSES = new Set(['FAILED', 'ABORTED', 'TIMED-OUT']);

function classifyScrapeFailure({ error = null, runStatus = '', itemCount = 0 } = {}) {
  const count = Number(itemCount) || 0;
  const status = String(runStatus || '').toUpperCase();
  const thrown = error instanceof Error ? error : error ? new Error(String(error)) : null;

  if (thrown) {
    return {
      shouldRecord: true,
      failureType: 'api_error',
      severity: 'error',
      message: thrown.message || 'Scrape request failed',
    };
  }

  if (UNHEALTHY_RUN_STATUSES.has(status)) {
    return {
      shouldRecord: true,
      failureType: 'apify_run_failed',
      severity: 'error',
      message: `Apify run unhealthy: ${status}`,
    };
  }

  if (count === 0) {
    return {
      shouldRecord: true,
      failureType: 'zero_items',
      severity: status === 'SUCCEEDED' ? 'warn' : 'error',
      message: `Scrape returned 0 items (run ${status || 'UNKNOWN'})`,
    };
  }

  return { shouldRecord: false };
}

async function recordScrapeFailure({
  userId = null,
  source,
  endpoint = null,
  error = null,
  runStatus = '',
  itemCount = 0,
  actor = null,
  runId = null,
  input = null,
  extraMeta = null,
} = {}) {
  const failure = classifyScrapeFailure({ error, runStatus, itemCount });
  if (!failure.shouldRecord) return false;

  await recordApiIncident({
    userId,
    severity: failure.severity,
    source: String(source || 'scrape').slice(0, 128),
    endpoint,
    message: failure.message,
    meta: {
      failure_type: failure.failureType,
      runStatus: String(runStatus || '').toUpperCase() || null,
      itemCount: Number(itemCount) || 0,
      actor,
      runId,
      input,
      error: error instanceof Error ? error.message : error ? String(error) : null,
      ...(extraMeta && typeof extraMeta === 'object' ? extraMeta : {}),
    },
  });

  return true;
}

module.exports = {
  UNHEALTHY_RUN_STATUSES,
  classifyScrapeFailure,
  recordScrapeFailure,
};
