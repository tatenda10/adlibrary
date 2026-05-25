const pool = require('../db/connection');
const { verifyToken } = require('@clerk/backend');
const { parseBearerToken } = require('../utils/auth');
const { getOfficialMarketingUpdates } = require('../utils/officialMarketingSources');
const { getSearchConsoleSnapshot } = require('../utils/googleSearchConsole');

async function ensureUser(user) {
  const email = user.email || `${user.id}@clerk.local`;
  const username = user.username || null;

  await pool.query(
    `INSERT INTO users (id, email, username)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), username = VALUES(username)`,
    [user.id, email, username]
  );
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function startOfDayOffset(daysAgo) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function buildEmptyTrendSeries(days = 14) {
  return Array.from({ length: days }, (_, index) => {
    const date = startOfDayOffset(days - index - 1);
    return {
      date: formatShortDate(date),
      searches: 0,
      results: 0,
    };
  });
}

async function getResearchTrendSeries(userId) {
  const [rows] = await pool.query(
    `SELECT DATE(searched_at) AS day,
            COUNT(*) AS searches,
            COALESCE(SUM(results_count), 0) AS results
     FROM search_history
     WHERE user_id = ?
       AND searched_at >= (CURDATE() - INTERVAL 13 DAY)
     GROUP BY DATE(searched_at)
     ORDER BY day ASC`,
    [userId]
  );

  const series = buildEmptyTrendSeries(14);
  const byDay = new Map(
    rows.map((row) => [
      formatShortDate(row.day),
      {
        searches: Number(row.searches || 0),
        results: Number(row.results || 0),
      },
    ])
  );

  return series.map((point) => ({
    ...point,
    searches: byDay.get(point.date)?.searches || 0,
    results: byDay.get(point.date)?.results || 0,
  }));
}

async function getTopTopics(userId) {
  const [rows] = await pool.query(
    `SELECT keyword,
            COUNT(*) AS searches,
            COALESCE(SUM(results_count), 0) AS results,
            MAX(searched_at) AS last_searched_at
     FROM search_history
     WHERE user_id = ?
       AND searched_at >= (NOW() - INTERVAL 30 DAY)
     GROUP BY keyword
     ORDER BY searches DESC, results DESC, last_searched_at DESC
     LIMIT 6`,
    [userId]
  );

  return rows.map((row) => ({
    keyword: row.keyword,
    searches: Number(row.searches || 0),
    results: Number(row.results || 0),
    last_searched_at: row.last_searched_at ? new Date(row.last_searched_at).toISOString() : '',
  }));
}

async function getActivitySnapshot(userId) {
  const [[searchStats], [bookmarkStats]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS searches_30d,
              COALESCE(SUM(results_count), 0) AS results_30d
       FROM search_history
       WHERE user_id = ?
         AND searched_at >= (NOW() - INTERVAL 30 DAY)`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*) AS bookmarks_count
       FROM bookmarks
       WHERE user_id = ?`,
      [userId]
    ),
  ]);

  return {
    searches_30d: Number(searchStats[0]?.searches_30d || 0),
    results_30d: Number(searchStats[0]?.results_30d || 0),
    bookmarks_count: Number(bookmarkStats[0]?.bookmarks_count || 0),
  };
}

async function getOverview(req, res) {
  try {
    const token = parseBearerToken(req.headers.authorization || '');
    if (!token) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const user = {
      id: payload.sub,
      email: payload.email || null,
      username: payload.username || null,
    };

    await ensureUser(user);

    const userId = user.id;
    const [trendSeries, topTopics, activitySnapshot, searchConsole, officialUpdates] = await Promise.all([
      getResearchTrendSeries(userId),
      getTopTopics(userId),
      getActivitySnapshot(userId),
      getSearchConsoleSnapshot().catch((error) => ({
        connected: false,
        message: error?.message || 'Search Console is unavailable right now.',
        points: [],
        totals: null,
        site_url: String(process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || ''),
      })),
      getOfficialMarketingUpdates(3).catch(() => ({ items: [], statuses: [] })),
    ]);

    return res.json({
      headline: {
        title: 'Marketing intelligence dashboard',
        subtitle: 'See trend movement, platform news, and what matters now in one place.',
        last_updated_at: new Date().toISOString(),
      },
      market_trends: {
        research_activity: {
          points: trendSeries,
          totals: activitySnapshot,
        },
        top_topics: topTopics,
        search_console: searchConsole,
      },
      platform_updates: officialUpdates.items,
      platform_status: officialUpdates.statuses,
    });
  } catch (error) {
    console.error('getOverview error:', error);
    return res.status(500).json({ error: 'Failed to load dashboard overview' });
  }
}

module.exports = {
  getOverview,
};
