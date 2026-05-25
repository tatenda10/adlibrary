const pool = require('../db/connection');

const DEFAULT_INTERVAL_MS = Number(process.env.COMPETITOR_ALERT_INTERVAL_MS || 15 * 60 * 1000);
const ALERT_COOLDOWN_HOURS = Number(process.env.COMPETITOR_ALERT_COOLDOWN_HOURS || 6);

async function runCompetitorAlertsCycle() {
  const [watchlistRows] = await pool.query(
    `SELECT id, user_id, competitor_name, platform, keyword, alert_preferences_json,
            last_results_count, last_signal_score
     FROM competitor_watchlist
     WHERE is_active = 1`
  );

  for (const item of watchlistRows || []) {
    const [recentAlertRows] = await pool.query(
      `SELECT id
       FROM competitor_alerts
       WHERE user_id = ? AND watchlist_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       LIMIT 1`,
      [item.user_id, item.id, ALERT_COOLDOWN_HOURS]
    );
    if (recentAlertRows.length) continue;

    const [searchRows] = await pool.query(
      `SELECT results_count
       FROM search_history
       WHERE user_id = ? AND keyword LIKE ?
       ORDER BY searched_at DESC
       LIMIT 1`,
      [item.user_id, `%${item.keyword}%`]
    );
    const latestCount = Number(searchRows[0]?.results_count || 0);
    const previousCount = Number(item.last_results_count || 0);
    const preferences = parseJson(item.alert_preferences_json, {
      notify_on_spike: true,
      notify_on_drop: true,
      notify_on_new_offer: true,
    });
    const signal = buildSignal(item.keyword, latestCount, previousCount, preferences);

    await pool.query(
      `UPDATE competitor_watchlist
       SET last_checked_at = NOW(),
           last_results_count = ?,
           last_signal_score = ?
       WHERE id = ?`,
      [latestCount, signal.score, item.id]
    );

    if (!signal.shouldAlert) continue;

    await pool.query(
      `INSERT INTO competitor_alerts (user_id, watchlist_id, alert_type, message, payload_json, is_read)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [
        item.user_id,
        item.id,
        signal.type,
        signal.message,
        JSON.stringify({
          competitor_name: item.competitor_name,
          platform: item.platform,
          keyword: item.keyword,
          previous_results_count: previousCount,
          results_count: latestCount,
          signal_score: signal.score,
        }),
      ]
    );
  }
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildSignal(keyword, count, previousCount, preferences = {}) {
  const delta = count - previousCount;
  const ratio = previousCount > 0 ? delta / previousCount : count > 0 ? 1 : 0;

  if (count <= 0) {
    return {
      type: 'low_activity',
      score: 25,
      shouldAlert: Boolean(preferences.notify_on_drop),
      message: `No fresh ad activity seen for "${keyword}" recently. Consider broadening your competitor query.`,
    };
  }

  if (delta >= 10 || ratio >= 0.75) {
    return {
      type: 'new_offer_detected',
      score: 88,
      shouldAlert: Boolean(preferences.notify_on_new_offer),
      message: `Spike detected for "${keyword}" with ${count} matching results. Review for new offers, creatives, or launches.`,
    };
  }

  if (delta <= -8 || ratio <= -0.5) {
    return {
      type: 'activity_drop_detected',
      score: 62,
      shouldAlert: Boolean(preferences.notify_on_drop),
      message: `Activity dropped for "${keyword}" from ${previousCount} to ${count}. Recheck competitor momentum and angle rotation.`,
    };
  }

  return {
    type: 'hook_shift_detected',
    score: 54,
    shouldAlert: Boolean(preferences.notify_on_spike),
    message: `Pattern shift detected around "${keyword}" with ${count} recent results. Check hooks, offers, and messaging changes.`,
  };
}

function startCompetitorAlertsJob() {
  const run = async () => {
    try {
      await runCompetitorAlertsCycle();
    } catch (error) {
      console.error('competitorAlertsJob cycle failed:', error?.message || error);
    }
  };

  run();
  return setInterval(run, DEFAULT_INTERVAL_MS);
}

module.exports = { startCompetitorAlertsJob };
