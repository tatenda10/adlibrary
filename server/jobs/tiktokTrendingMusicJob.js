const { refreshTrendingMusicForCountry } = require('../controllers/tiktokTrendingMusicController');
const {
  DEFAULT_COUNTRY,
  cacheNeedsDailyRefresh,
} = require('../utils/tiktokTrendingMusicStore');

const INTERVAL_MS = Number(process.env.TIKTOK_TRENDING_MUSIC_INTERVAL_MS || 24 * 60 * 60 * 1000);

async function runTrendingMusicDailyCycle() {
  const countries = String(process.env.TIKTOK_TRENDING_MUSIC_DAILY_COUNTRIES || DEFAULT_COUNTRY)
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  for (const country of countries) {
    try {
      const needsRefresh = await cacheNeedsDailyRefresh(country);
      if (!needsRefresh) {
        console.log(`[tiktok-trending-music] ${country} cache is fresh for today, skipping.`);
        continue;
      }

      await refreshTrendingMusicForCountry(country, {
        source: 'daily_job',
        limit: Number(process.env.TIKTOK_TRENDING_MUSIC_LIMIT || 48),
      });
      console.log(`[tiktok-trending-music] Refreshed ${country} cache.`);
    } catch (error) {
      console.error(`[tiktok-trending-music] ${country} refresh failed:`, error?.message || error);
    }
  }
}

function startTikTokTrendingMusicJob() {
  const run = async () => {
    try {
      await runTrendingMusicDailyCycle();
    } catch (error) {
      console.error('tiktokTrendingMusicJob cycle failed:', error?.message || error);
    }
  };

  run();
  return setInterval(run, INTERVAL_MS);
}

module.exports = { startTikTokTrendingMusicJob, runTrendingMusicDailyCycle };
