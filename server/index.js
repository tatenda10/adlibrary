require('dotenv').config();
const express = require('express');
const cors = require('cors');

const searchRoutes = require('./routes/search');
const tiktokRoutes = require('./routes/tiktok');
const analyzeRoutes = require('./routes/analyze');
const bookmarkRoutes = require('./routes/bookmarks');
const onboardingRoutes = require('./routes/onboarding');
const dashboardRoutes = require('./routes/dashboard');
const hooksRoutes = require('./routes/hooks');
const billingRoutes = require('./routes/billing');
const collectionsRoutes = require('./routes/collections');
const facebookRoutes = require('./routes/facebook');
const instagramRoutes = require('./routes/instagram');
const croAuditRoutes = require('./routes/croAudit');
const croAuditsRoutes = require('./routes/croAudits');
const articlesRoutes = require('./routes/articles');
const adminRoutes = require('./routes/admin');
const supportRoutes = require('./routes/support');
const strategyRoutes = require('./routes/strategy');
const jobsRoutes = require('./routes/jobs');
const { handleBillingWebhook } = require('./controllers/billingController');
const { startCompetitorAlertsJob } = require('./jobs/competitorAlertsJob');
const { startTikTokTrendingMusicJob } = require('./jobs/tiktokTrendingMusicJob');
const { ensureRuntimeTables } = require('./db/bootstrap');
const { registerJobHandler, startAsyncJobLoop } = require('./utils/asyncJobs');
const { analyzeTikTokCore } = require('./controllers/analyzeController');
const { analyzeCroAuditCore } = require('./controllers/croAuditController');
const pool = require('./db/connection');

const defaultCorsOrigins = [
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://localhost:5174',
];
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : defaultCorsOrigins;

const app = express();

app.use(
  cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  })
);
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleBillingWebhook);
app.use(express.json({ limit: '2mb' }));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch {
    res.status(500).json({ ok: false, db: 'disconnected' });
  }
});

app.use('/api/search', searchRoutes);
app.use('/api/tiktok', tiktokRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/hooks', hooksRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/cro-audit', croAuditRoutes);
app.use('/api/cro-audits', croAuditsRoutes);
app.use('/api/articles', articlesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/strategy', strategyRoutes);
app.use('/api/jobs', jobsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const port = Number(process.env.PORT || 5000);

registerJobHandler('tiktok_analysis', async ({ payload }) => analyzeTikTokCore(payload || {}));
registerJobHandler('cro_audit', async ({ payload }) => analyzeCroAuditCore(payload || {}));

async function startServer() {
  await ensureRuntimeTables();
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    startCompetitorAlertsJob();
    startTikTokTrendingMusicJob();
    startAsyncJobLoop();
  });
}

startServer().catch((error) => {
  console.error('Server bootstrap failed:', error);
  process.exit(1);
});
