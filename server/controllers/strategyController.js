const fs = require('fs');
const path = require('path');
const pool = require('../db/connection');
const { getLimitForMetric } = require('../utils/usage');

const SKILLS_DIR = path.join(__dirname, '../skills');
const MARKETING_SKILLS_RAW_BASE = 'https://raw.githubusercontent.com/coreyhaines31/marketingskills/main/skills';
const marketingSkillCache = new Map();

/** Local filenames that differ from the fetchMarketingSkill slug. */
const LOCAL_SKILL_FILES = {
  'hook-writer': 'Hooks.md',
};

const SOCIAL_CONTENT_SKILL_FALLBACK = `# Social Content
You are an expert social media strategist.

Before creating content, use product marketing context when it exists and only ask for missing task-specific information.

Gather goals, audience, brand voice, resources, platforms, current posting frequency, existing content to repurpose, and available time.

Use 3-5 content pillars. Balance educational, behind-the-scenes, story, social proof, engagement, and light promotional content.

Create a calendar that assigns each post a platform, format, hook, topic, CTA, and concrete production task.

Prefer platform-native formats:
- LinkedIn: thought leadership, carousels, stories.
- Twitter/X: threads, hot takes, community engagement.
- Instagram: Reels, carousels, Stories.
- TikTok: short-form video, native-feeling hooks, UGC-style proof.
- Facebook: groups, native video, community posts.

Review performance weekly and adjust hooks, formats, posting times, and content pillars.`;

async function getWeeklyRecommendations(req, res) {
  try {
    const userId = req.user.id;
    const profile = await getBrandProfile(userId);
    const recentVideos = await getRecentVideos(userId, 12);
    const topHooks = extractTopHooks(recentVideos, 3);

    const recommendations = topHooks.length
      ? topHooks.map((hook, index) => ({
          id: `rec-${index + 1}`,
          title: `Launch ${hook.format} variation`,
          channel: suggestChannel(profile, index),
          funnel_stage: suggestFunnelStage(index),
          recommended_budget_usd: suggestBudget(index),
          hook: hook.hook,
          angle: suggestAngle(profile, index),
          cta: suggestCta(profile, index),
          why: `Trending pattern appears in recent market creatives and aligns with ${profile.industry || 'your selected niche'}.`,
        }))
      : buildFallbackRecommendations(profile);

    return res.json({
      profile_summary: {
        brand_name: profile.brand_name || 'Your Brand',
        industry: profile.industry || 'General',
        countries: profile.countries || [],
      },
      recommendations,
    });
  } catch (error) {
    console.error('getWeeklyRecommendations error:', error);
    return res.status(500).json({ error: 'Failed to generate weekly recommendations.' });
  }
}

async function generateCreativeTestPlanner(req, res) {
  try {
    const { hooks = [], angles = [], ctas = [], formats = [] } = req.body || {};
    const safeHooks = normalizeList(hooks, ['Problem-first hook', 'Outcome-first hook']);
    const safeAngles = normalizeList(angles, ['Before/after proof', 'Founder insight']);
    const safeCtas = normalizeList(ctas, ['Shop now', 'Try it today']);
    const safeFormats = normalizeList(formats, ['UGC testimonial', 'Demo clip']);

    const matrix = [];
    let index = 1;
    for (const hook of safeHooks.slice(0, 3)) {
      for (const angle of safeAngles.slice(0, 2)) {
        const cta = safeCtas[(index - 1) % safeCtas.length];
        const format = safeFormats[(index - 1) % safeFormats.length];
        matrix.push({
          id: `cell-${index}`,
          hook,
          angle,
          cta,
          format,
          priority_score: buildPriorityScore(index, hook, angle),
          priority_label: index <= 3 ? 'Run first' : index <= 5 ? 'Run second' : 'Backlog',
        });
        index += 1;
      }
    }

    return res.json({
      matrix,
      summary: 'Auto-generated testing matrix based on your selected hooks, angles, CTAs, and formats.',
    });
  } catch (error) {
    console.error('generateCreativeTestPlanner error:', error);
    return res.status(500).json({ error: 'Failed to generate creative test planner.' });
  }
}

async function generateMonthlySocialCalendar(req, res) {
  try {
    const userId = req.user.id;
    const month = normalizeMonthKey(req.body?.month);
    if (!month) {
      return res.status(400).json({ error: 'month must use YYYY-MM format.' });
    }

    const source = String(req.body?.source || 'brand_profile').trim() === 'questionnaire'
      ? 'questionnaire'
      : 'brand_profile';

    const brandContext = source === 'questionnaire'
      ? normalizeQuestionnaireContext(req.body?.questionnaire || {})
      : buildBrandContextFromProfile(await getBrandProfile(userId));

    if (!hasUsableBrandContext(brandContext)) {
      return res.status(400).json({
        error: source === 'brand_profile'
          ? 'Saved brand profile is missing. Fill the questionnaire to generate this month.'
          : 'Add at least a brand name, audience, or goal before generating.',
      });
    }

    const skill = await fetchMarketingSkill('social-content');
    let plan = null;

    if (process.env.CLAUDE_API_KEY) {
      try {
        plan = await generateMonthlyCalendarWithClaude({
          month,
          source,
          brandContext,
          skillText: skill.text,
          skillSourceUrl: skill.source_url,
        });
      } catch (llmError) {
        console.error('generateMonthlyCalendarWithClaude failed:', llmError);
      }
    }

    const fallback = buildFallbackMonthlyCalendar(month, brandContext, source, skill);
    const sanitizedPlan = sanitizeMonthlyPlan(plan, fallback, month, source, skill);

    return res.json(sanitizedPlan);
  } catch (error) {
    console.error('generateMonthlySocialCalendar error:', error);
    return res.status(500).json({ error: 'Failed to generate monthly social calendar.' });
  }
}

async function getCompetitorChangeAlerts(req, res) {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT id, alert_type, message, created_at, payload_json
       FROM competitor_alerts
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 12`,
      [userId]
    );

    const alerts = (rows || []).slice(0, 8).map((row) => {
      const payload = parseJson(row.payload_json);
      return {
        id: `alert-${row.id}`,
        competitor: payload?.competitor_name || 'Tracked competitor',
        type: row.alert_type || 'change_detected',
        message: row.message,
        occurred_at: row.created_at,
      };
    });

    return res.json({
      alerts: alerts.length ? alerts : buildFallbackAlerts(),
    });
  } catch (error) {
    console.error('getCompetitorChangeAlerts error:', error);
    return res.status(500).json({ error: 'Failed to fetch competitor change alerts.' });
  }
}

async function runCompetitorRadar(req, res) {
  try {
    const userId = req.user.id;
    const brief = String(req.body?.brief || '').trim();

    if (brief.length < 8) {
      return res.status(400).json({ error: 'Describe the competitor set you want to research.' });
    }

    if (brief.length > 2500) {
      return res.status(400).json({ error: 'Keep the competitor radar brief under 2500 characters.' });
    }

    const profile = await getBrandProfile(userId);
    const brandContext = buildBrandContextFromProfile(profile);
    let candidate = null;

    if (process.env.CLAUDE_API_KEY) {
      try {
        candidate = await generateCompetitorRadarWithClaude({ brief, brandContext });
      } catch (llmError) {
        console.error('generateCompetitorRadarWithClaude failed:', llmError);
      }
    }

    const fallback = buildFallbackCompetitorRadar(brief, brandContext);
    const radar = sanitizeCompetitorRadar(candidate, fallback, brief, brandContext);

    return res.json(radar);
  } catch (error) {
    console.error('runCompetitorRadar error:', error);
    return res.status(500).json({ error: 'Failed to run competitor radar.' });
  }
}

async function getSavedPlans(req, res) {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT id, title, plan_type, matrix_json, brief_json, meta_json, created_at, updated_at
       FROM strategy_saved_plans
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 100`,
      [userId]
    );

    const plans = (rows || []).map((row) => ({
      id: row.id,
      title: row.title,
      plan_type: row.plan_type,
      matrix: parseJson(row.matrix_json, []),
      brief: parseJson(row.brief_json, null),
      meta: parseJson(row.meta_json, {}),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return res.json({ plans });
  } catch (error) {
    console.error('getSavedPlans error:', error);
    return res.status(500).json({ error: 'Failed to fetch saved plans.' });
  }
}

async function createSavedPlan(req, res) {
  try {
    const userId = req.user.id;
    const title = String(req.body?.title || '').trim();
    const planType = String(req.body?.plan_type || 'matrix_brief').trim();
    const matrix = Array.isArray(req.body?.matrix) ? req.body.matrix : [];
    const brief = req.body?.brief && typeof req.body.brief === 'object' ? req.body.brief : null;
    const meta = req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : {};

    if (!title) {
      return res.status(400).json({ error: 'Plan title is required.' });
    }

    const [result] = await pool.query(
      `INSERT INTO strategy_saved_plans (user_id, title, plan_type, matrix_json, brief_json, meta_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        title,
        planType,
        JSON.stringify(matrix),
        JSON.stringify(brief),
        JSON.stringify(meta),
      ]
    );

    return res.status(201).json({
      id: result.insertId,
      message: 'Plan saved.',
    });
  } catch (error) {
    console.error('createSavedPlan error:', error);
    return res.status(500).json({ error: 'Failed to save plan.' });
  }
}

async function updateSavedPlan(req, res) {
  try {
    const userId = req.user.id;
    const id = Number(req.params?.id || 0);
    if (!id) return res.status(400).json({ error: 'Invalid saved plan id.' });

    const [rows] = await pool.query(
      `SELECT id, title, plan_type, matrix_json, brief_json, meta_json
       FROM strategy_saved_plans
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Saved plan not found.' });
    }

    const existing = rows[0];
    const hasMatrix = Object.prototype.hasOwnProperty.call(req.body || {}, 'matrix');
    const hasBrief = Object.prototype.hasOwnProperty.call(req.body || {}, 'brief');
    const hasMeta = Object.prototype.hasOwnProperty.call(req.body || {}, 'meta');

    const title = String(req.body?.title || '').trim() || existing.title;
    const planType = String(req.body?.plan_type || '').trim() || existing.plan_type;
    const matrix = hasMatrix && Array.isArray(req.body?.matrix)
      ? req.body.matrix
      : parseJson(existing.matrix_json, []);
    const brief = hasBrief
      ? (req.body?.brief && typeof req.body.brief === 'object' ? req.body.brief : null)
      : parseJson(existing.brief_json, null);
    const meta = hasMeta && req.body?.meta && typeof req.body.meta === 'object'
      ? req.body.meta
      : parseJson(existing.meta_json, {});

    await pool.query(
      `UPDATE strategy_saved_plans
       SET title = ?,
           plan_type = ?,
           matrix_json = ?,
           brief_json = ?,
           meta_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        title,
        planType,
        JSON.stringify(matrix),
        JSON.stringify(brief),
        JSON.stringify(meta),
        id,
        userId,
      ]
    );

    return res.json({ ok: true, id });
  } catch (error) {
    console.error('updateSavedPlan error:', error);
    return res.status(500).json({ error: 'Failed to update saved plan.' });
  }
}

async function deleteSavedPlan(req, res) {
  try {
    const userId = req.user.id;
    const id = Number(req.params?.id || 0);
    if (!id) return res.status(400).json({ error: 'Invalid saved plan id.' });

    const [result] = await pool.query(
      `DELETE FROM strategy_saved_plans
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Saved plan not found.' });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('deleteSavedPlan error:', error);
    return res.status(500).json({ error: 'Failed to delete saved plan.' });
  }
}

async function getWatchlist(req, res) {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT id, competitor_name, platform, keyword, is_active, alert_preferences_json,
              last_results_count, last_signal_score, notes, last_checked_at, created_at, updated_at
       FROM competitor_watchlist
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    );

    return res.json({
      watchlist: (rows || []).map((row) => ({
        id: row.id,
        competitor_name: row.competitor_name,
        platform: row.platform,
        keyword: row.keyword,
        is_active: Boolean(row.is_active),
        alert_preferences: parseJson(row.alert_preferences_json, {
          notify_on_spike: true,
          notify_on_drop: true,
          notify_on_new_offer: true,
        }),
        last_results_count: Number(row.last_results_count || 0),
        last_signal_score: Number(row.last_signal_score || 0),
        notes: row.notes || '',
        last_checked_at: row.last_checked_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    });
  } catch (error) {
    console.error('getWatchlist error:', error);
    return res.status(500).json({ error: 'Failed to fetch watchlist.' });
  }
}

async function createWatchlistItem(req, res) {
  try {
    const userId = req.user.id;
    const competitorName = String(req.body?.competitor_name || '').trim();
    const platform = String(req.body?.platform || 'tiktok').trim().toLowerCase();
    const keyword = String(req.body?.keyword || '').trim();

    if (!competitorName || !keyword) {
      return res.status(400).json({ error: 'Competitor name and keyword are required.' });
    }

    const activeLimit = getLimitForMetric(req.subscription, 'active_watchlist');
    const [[activeRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM competitor_watchlist
       WHERE user_id = ? AND is_active = 1`,
      [userId]
    );
    if (Number(activeRow?.total || 0) >= activeLimit) {
      return res.status(429).json({
        error: 'You have reached your active competitor watchlist limit.',
        code: 'watchlist_limit_reached',
      });
    }

    const alertPreferences = req.body?.alert_preferences && typeof req.body.alert_preferences === 'object'
      ? req.body.alert_preferences
      : { notify_on_spike: true, notify_on_drop: true, notify_on_new_offer: true };
    const notes = String(req.body?.notes || '').trim();

    const [result] = await pool.query(
      `INSERT INTO competitor_watchlist (
        user_id, competitor_name, platform, keyword, is_active, alert_preferences_json, notes
      ) VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [userId, competitorName, platform, keyword, JSON.stringify(alertPreferences), notes]
    );

    return res.status(201).json({
      id: result.insertId,
      message: 'Watchlist item created.',
    });
  } catch (error) {
    console.error('createWatchlistItem error:', error);
    return res.status(500).json({ error: 'Failed to create watchlist item.' });
  }
}

async function updateWatchlistItem(req, res) {
  try {
    const userId = req.user.id;
    const id = Number(req.params?.id || 0);
    if (!id) return res.status(400).json({ error: 'Invalid watchlist id.' });

    const competitorName = String(req.body?.competitor_name || '').trim();
    const platform = String(req.body?.platform || '').trim().toLowerCase();
    const keyword = String(req.body?.keyword || '').trim();
    const isActive = typeof req.body?.is_active === 'boolean' ? Number(req.body.is_active) : null;
    const alertPreferences = req.body?.alert_preferences && typeof req.body.alert_preferences === 'object'
      ? JSON.stringify(req.body.alert_preferences)
      : null;
    const notes = Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')
      ? String(req.body?.notes || '').trim()
      : null;

    const [existingRows] = await pool.query(
      `SELECT id FROM competitor_watchlist WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, userId]
    );
    if (!existingRows.length) return res.status(404).json({ error: 'Watchlist item not found.' });

    if (isActive === 1) {
      const activeLimit = getLimitForMetric(req.subscription, 'active_watchlist');
      const [[activeRow]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM competitor_watchlist
         WHERE user_id = ? AND is_active = 1 AND id <> ?`,
        [userId, id]
      );
      if (Number(activeRow?.total || 0) >= activeLimit) {
        return res.status(429).json({
          error: 'You have reached your active competitor watchlist limit.',
          code: 'watchlist_limit_reached',
        });
      }
    }

    await pool.query(
      `UPDATE competitor_watchlist
       SET competitor_name = COALESCE(NULLIF(?, ''), competitor_name),
           platform = COALESCE(NULLIF(?, ''), platform),
           keyword = COALESCE(NULLIF(?, ''), keyword),
           is_active = COALESCE(?, is_active),
           alert_preferences_json = COALESCE(?, alert_preferences_json),
           notes = COALESCE(?, notes)
       WHERE id = ? AND user_id = ?`,
      [competitorName, platform, keyword, isActive, alertPreferences, notes, id, userId]
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error('updateWatchlistItem error:', error);
    return res.status(500).json({ error: 'Failed to update watchlist item.' });
  }
}

async function deleteWatchlistItem(req, res) {
  try {
    const userId = req.user.id;
    const id = Number(req.params?.id || 0);
    if (!id) return res.status(400).json({ error: 'Invalid watchlist id.' });

    const [result] = await pool.query(
      `DELETE FROM competitor_watchlist WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Watchlist item not found.' });

    return res.json({ ok: true });
  } catch (error) {
    console.error('deleteWatchlistItem error:', error);
    return res.status(500).json({ error: 'Failed to delete watchlist item.' });
  }
}

async function getWinningPatterns(req, res) {
  try {
    const userId = req.user.id;
    const recentVideos = await getRecentVideos(userId, 30);
    const patternCounts = countPatternKeywords(recentVideos);
    const patterns = Object.entries(patternCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, count], index) => ({
        id: `pattern-${index + 1}`,
        pattern,
        rising_score: 90 - index * 4,
        frequency: count,
        recommendation: `Use "${pattern}" in one test this week with a direct response CTA.`,
      }));

    return res.json({
      patterns: patterns.length ? patterns : buildFallbackPatterns(),
    });
  } catch (error) {
    console.error('getWinningPatterns error:', error);
    return res.status(500).json({ error: 'Failed to fetch winning patterns.' });
  }
}

async function generateCreativeBrief(req, res) {
  try {
    const {
      objective = 'Drive conversions',
      audience = 'Performance-focused shoppers',
      hook = 'Stop scrolling if this sounds like you',
      angle = 'Problem-solution demo',
      cta = 'Try it now',
      format = 'UGC testimonial',
    } = req.body || {};

    return res.json({
      brief: {
        objective,
        audience,
        key_message: `${angle} with a clear promise and urgency.`,
        opening_hook: hook,
        format,
        cta,
        shot_list: [
          'Hook in first 2 seconds with pain point or bold statement',
          'Show product/service proof in use',
          'Add social proof/testimonial overlay',
          `Close with CTA: ${cta}`,
        ],
        editor_notes: 'Keep cuts fast (1.2s-2.0s average), captions always on, and feature one clear benefit per scene.',
      },
    });
  } catch (error) {
    console.error('generateCreativeBrief error:', error);
    return res.status(500).json({ error: 'Failed to generate creative brief.' });
  }
}

async function getAudiencePersonaLens(req, res) {
  try {
    const userId = req.user.id;
    const profile = await getBrandProfile(userId);

    return res.json({
      personas: [
        {
          id: 'persona-1',
          name: 'High intent buyer',
          summary: 'Ready to buy now, responds to proof and speed.',
          best_angles: ['Before/after', 'Fast outcome demo'],
        },
        {
          id: 'persona-2',
          name: 'Skeptical researcher',
          summary: 'Needs trust and comparison before committing.',
          best_angles: ['Founder authority', 'Transparent comparison'],
        },
        {
          id: 'persona-3',
          name: 'Value-focused shopper',
          summary: 'Responds to bundled value and practical utility.',
          best_angles: ['Offer stack', 'Savings framing'],
        },
      ],
      applied_context: {
        industry: profile.industry || 'General',
        countries: profile.countries || [],
      },
    });
  } catch (error) {
    console.error('getAudiencePersonaLens error:', error);
    return res.status(500).json({ error: 'Failed to fetch persona lens.' });
  }
}

async function getPerformanceBenchmarks(req, res) {
  try {
    const userId = req.user.id;
    const profile = await getBrandProfile(userId);

    return res.json({
      niche: profile.industry || 'General',
      benchmarks: [
        { metric: 'Hook hold rate proxy', value: '64%', note: 'Top quartile >= 70%' },
        { metric: 'CTA intent signal', value: '41%', note: 'Top quartile >= 48%' },
        { metric: 'Creative iteration speed', value: 'Weekly', note: 'Best teams ship 2x/week' },
        { metric: 'Test-to-winner ratio', value: '1 in 5', note: 'Healthy range: 1 in 4 to 1 in 6' },
      ],
    });
  } catch (error) {
    console.error('getPerformanceBenchmarks error:', error);
    return res.status(500).json({ error: 'Failed to fetch performance benchmarks.' });
  }
}

async function getLandingAdMatchScore(req, res) {
  try {
    const { landingHeadline = '', adHook = '', adCta = '' } = req.body || {};
    const score = computeMatchScore(landingHeadline, adHook, adCta);

    return res.json({
      score,
      grade: score >= 80 ? 'Strong' : score >= 60 ? 'Moderate' : 'Weak',
      recommendations: buildMatchRecommendations(score, landingHeadline, adHook, adCta),
    });
  } catch (error) {
    console.error('getLandingAdMatchScore error:', error);
    return res.status(500).json({ error: 'Failed to calculate landing/ad match score.' });
  }
}

async function getBrandProfile(userId) {
  const [rows] = await pool.query(
    `SELECT brand_name, website_url, industry, brand_size, target_audience,
            goals, channels, preferences, story, tone, value_props, content_pillars
     FROM brand_profiles
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );

  const row = rows[0] || {};
  const preferences = parseJson(row.preferences, {});
  const goals = parseJson(row.goals, []);
  const channels = parseJson(row.channels, []);
  const tone = parseJson(row.tone, {});
  const valueProps = parseJson(row.value_props, []);
  const contentPillars = parseJson(row.content_pillars, []);
  const countries = Array.isArray(preferences?.countries) ? preferences.countries : [];

  return {
    brand_name: row.brand_name || '',
    website_url: row.website_url || '',
    industry: row.industry || '',
    brand_size: row.brand_size || '',
    target_audience: row.target_audience || '',
    goals,
    channels,
    preferences,
    story: row.story || '',
    tone,
    value_props: valueProps,
    content_pillars: contentPillars,
    countries,
  };
}

async function getRecentVideos(userId, limit = 10) {
  const [rows] = await pool.query(
    `SELECT video_json
     FROM recent_tiktok_videos
     WHERE user_id = ?
     ORDER BY updated_at DESC
     LIMIT ?`,
    [userId, Number(limit || 10)]
  );

  return (rows || [])
    .map((row) => {
      try {
        return typeof row.video_json === 'string' ? JSON.parse(row.video_json) : row.video_json;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function extractTopHooks(videos = [], limit = 3) {
  return videos
    .map((video) => String(video.caption || video.desc || video.text || '').trim())
    .filter(Boolean)
    .map((caption) => {
      const hook = caption.split(/[.!?]/)[0].slice(0, 110).trim();
      return {
        hook: hook || caption.slice(0, 110),
        format: inferFormatFromText(caption),
      };
    })
    .slice(0, limit);
}

function inferFormatFromText(text = '') {
  const value = String(text).toLowerCase();
  if (value.includes('before') || value.includes('after')) return 'before/after UGC';
  if (value.includes('founder')) return 'founder story';
  if (value.includes('demo') || value.includes('how to')) return 'product demo';
  return 'short-form UGC';
}

function suggestChannel(profile, index) {
  const channels = ['TikTok', 'Instagram Reels', 'Facebook'];
  if (profile.industry && String(profile.industry).toLowerCase().includes('saas')) {
    channels[2] = 'LinkedIn';
  }
  return channels[index % channels.length];
}

function suggestFunnelStage(index) {
  const stages = ['Top of Funnel', 'Middle of Funnel', 'Bottom of Funnel'];
  return stages[index % stages.length];
}

function suggestBudget(index) {
  return [60, 90, 120][index % 3];
}

function suggestAngle(profile, index) {
  const industry = String(profile.industry || '').toLowerCase();
  if (industry.includes('beauty') || industry.includes('skincare')) {
    return ['Transformation proof', 'Routine simplification', 'Ingredient authority'][index % 3];
  }
  if (industry.includes('saas')) {
    return ['Time-saving workflow', 'Cost reduction', 'Team efficiency'][index % 3];
  }
  return ['Problem-solution', 'Social proof', 'Offer clarity'][index % 3];
}

function suggestCta(profile, index) {
  const countries = profile.countries || [];
  if (countries.includes('United States')) {
    return ['Try it now', 'Claim your offer', 'See it in action'][index % 3];
  }
  return ['Get started', 'See how it works', 'Try now'][index % 3];
}

function buildFallbackRecommendations(profile) {
  return [
    {
      id: 'rec-fallback-1',
      title: 'Launch UGC proof angle',
      channel: 'TikTok',
      funnel_stage: 'Top of Funnel',
      recommended_budget_usd: 75,
      hook: 'If you are still doing it this way, watch this first',
      angle: suggestAngle(profile, 0),
      cta: suggestCta(profile, 0),
      why: 'Consistently strong across fast-growing DTC niches.',
    },
    {
      id: 'rec-fallback-2',
      title: 'Run offer-led conversion creative',
      channel: 'Instagram Reels',
      funnel_stage: 'Bottom of Funnel',
      recommended_budget_usd: 110,
      hook: 'This is what changed after 7 days',
      angle: suggestAngle(profile, 1),
      cta: suggestCta(profile, 1),
      why: 'Strong purchase-intent signal for warm audiences.',
    },
    {
      id: 'rec-fallback-3',
      title: 'Test founder story clip',
      channel: 'Facebook',
      funnel_stage: 'Middle of Funnel',
      recommended_budget_usd: 90,
      hook: 'Why we built this in the first place',
      angle: suggestAngle(profile, 2),
      cta: suggestCta(profile, 2),
      why: 'Improves trust before conversion asks.',
    },
  ];
}

function normalizeMonthKey(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return '';

  return `${year}-${String(month).padStart(2, '0')}`;
}

function getMonthDays(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const monthIndex = month - 1;
  const totalDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekday = new Date(Date.UTC(year, monthIndex, day)).toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    });

    return { date, day, weekday };
  });
}

function normalizeStringList(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return fallback;
}

function normalizeQuestionnaireContext(input = {}) {
  const goals = normalizeStringList(input.goals || input.goal);
  const platforms = normalizeStringList(input.platforms || input.channels);

  return {
    brand_name: String(input.brandName || input.brand_name || '').trim(),
    website_url: String(input.websiteUrl || input.website_url || '').trim(),
    industry: String(input.industry || '').trim(),
    brand_size: String(input.brandSize || input.brand_size || '').trim(),
    target_audience: String(input.audience || input.targetAudience || input.target_audience || '').trim(),
    goals,
    channels: platforms,
    story: String(input.positioning || input.story || '').trim(),
    tone_summary: String(input.tone || input.brandVoice || '').trim(),
    value_props: normalizeStringList(input.valueProps || input.value_props || input.offer),
    content_pillars: normalizeStringList(input.contentPillars || input.content_pillars),
    constraints: String(input.constraints || '').trim(),
    weekly_hours: String(input.weeklyHours || input.weekly_hours || '').trim(),
    existing_assets: String(input.existingAssets || input.existing_assets || '').trim(),
  };
}

function buildBrandContextFromProfile(profile = {}) {
  const tone = profile.tone && typeof profile.tone === 'object' ? profile.tone : {};

  return {
    brand_name: profile.brand_name || '',
    website_url: profile.website_url || '',
    industry: profile.industry || '',
    brand_size: profile.brand_size || '',
    target_audience: profile.target_audience || '',
    goals: normalizeStringList(profile.goals),
    channels: normalizeStringList(profile.channels),
    story: profile.story || '',
    tone_summary: tone.summary || tone.tone_summary || tone.style || '',
    value_props: normalizeStringList(profile.value_props),
    content_pillars: normalizeStringList(profile.content_pillars),
    countries: normalizeStringList(profile.countries),
  };
}

function hasUsableBrandContext(context = {}) {
  return Boolean(
    context.brand_name ||
      context.target_audience ||
      context.story ||
      normalizeStringList(context.goals).length ||
      normalizeStringList(context.value_props).length
  );
}

function cleanPlatform(value) {
  const key = String(value || '').trim().toLowerCase().replace(/_/g, ' ');
  if (!key) return '';
  if (key.includes('tiktok')) return 'TikTok';
  if (key.includes('instagram') || key.includes('reel')) return 'Instagram';
  if (key.includes('linkedin')) return 'LinkedIn';
  if (key.includes('twitter') || key === 'x') return 'Twitter/X';
  if (key.includes('facebook') || key.includes('meta')) return 'Facebook';
  if (key.includes('youtube')) return 'YouTube Shorts';
  return String(value).trim();
}

function getPreferredPlatforms(context = {}) {
  const platforms = normalizeStringList(context.channels)
    .map(cleanPlatform)
    .filter(Boolean)
    .filter((item) => !/google|reddit|newsletter|email/i.test(item));

  const unique = Array.from(new Set(platforms));
  return unique.length ? unique : ['TikTok', 'Instagram', 'LinkedIn', 'Facebook'];
}

function readLocalMarketingSkill(safeName) {
  const candidates = [
    LOCAL_SKILL_FILES[safeName] && path.join(SKILLS_DIR, LOCAL_SKILL_FILES[safeName]),
    path.join(SKILLS_DIR, `${safeName}.md`),
    path.join(SKILLS_DIR, safeName, 'SKILL.md'),
  ].filter(Boolean);

  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const text = fs.readFileSync(filePath, 'utf8');
      if (text && text.trim().length > 200) {
        return { filePath, text };
      }
    } catch (error) {
      console.error(`Local marketing skill read failed (${filePath}):`, error);
    }
  }
  return null;
}

async function fetchMarketingSkill(skillName) {
  const safeName = String(skillName || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!safeName) throw new Error('Invalid skill name.');
  if (marketingSkillCache.has(safeName)) {
    return { ...marketingSkillCache.get(safeName), from_cache: true };
  }

  const local = readLocalMarketingSkill(safeName);
  if (local) {
    const skill = {
      name: safeName,
      source_url: local.filePath,
      text: local.text,
      fetched: true,
      from_local: true,
    };
    marketingSkillCache.set(safeName, skill);
    return skill;
  }

  const sourceUrl = `${MARKETING_SKILLS_RAW_BASE}/${safeName}/SKILL.md`;

  try {
    const response = await fetch(sourceUrl, {
      headers: { 'user-agent': 'viraladlibrary-monthly-planner' },
    });

    if (response.ok) {
      const text = await response.text();
      if (text && text.trim().length > 200) {
        const skill = {
          name: safeName,
          source_url: sourceUrl,
          text,
          fetched: true,
          from_local: false,
        };
        marketingSkillCache.set(safeName, skill);
        return skill;
      }
    }

    console.error(`Marketing skill fetch failed: ${response.status} ${await response.text()}`);
  } catch (error) {
    console.error('Marketing skill fetch error:', error);
  }

  const fallback = {
    name: safeName,
    source_url: sourceUrl,
    text: safeName === 'social-content' ? SOCIAL_CONTENT_SKILL_FALLBACK : '',
    fetched: false,
    from_local: false,
  };
  marketingSkillCache.set(safeName, fallback);
  return fallback;
}

async function generateMonthlyCalendarWithClaude({
  month,
  source,
  brandContext,
  skillText,
  skillSourceUrl,
}) {
  const days = getMonthDays(month);
  const prompt = `You are creating a month-long social media content calendar.

Use the Marketing Skills social-content skill below as the operating playbook. It comes from:
${skillSourceUrl}

SOCIAL-CONTENT SKILL:
${String(skillText || '').slice(0, 12000)}

Brand context source: ${source}
Brand context:
${JSON.stringify(brandContext, null, 2)}

Month days:
${JSON.stringify(days, null, 2)}

Return STRICT JSON only with this exact shape:
{
  "summary": "short strategy summary",
  "pillars": ["pillar 1", "pillar 2", "pillar 3"],
  "calendar": [
    {
      "date": "YYYY-MM-DD",
      "platform": "TikTok",
      "format": "Short video",
      "pillar": "content pillar",
      "topic": "specific topic",
      "hook": "opening hook",
      "caption_prompt": "caption or post prompt",
      "task": "what the user should do that day",
      "cta": "call to action"
    }
  ]
}

Rules:
- Include exactly ${days.length} calendar entries, one for every date supplied.
- Keep each field concise enough to fit in a calendar cell.
- Use a healthy monthly mix: education, story, proof, behind-the-scenes, engagement, and light promotion.
- Rotate platforms and formats based on the supplied context.
- The task field must tell the user exactly what to make, publish, review, or prepare that day.
- Do not include markdown, commentary, or code fences.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 7000,
      temperature: 0.35,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data?.content?.map((part) => part.text).join('\n') || '';
  const parsed = extractJsonObject(text);
  if (!parsed || !Array.isArray(parsed.calendar)) {
    throw new Error('Failed to parse monthly calendar JSON.');
  }

  return parsed;
}

async function generateCompetitorRadarWithClaude({ brief, brandContext }) {
  const prompt = `You are building a competitor research radar for a marketing team.

The user writes in plain English. Convert that into a structured competitor set.

Saved brand profile:
${JSON.stringify(brandContext, null, 2)}

User brief:
${brief}

Return STRICT JSON only with this exact shape:
{
  "summary": "short summary of what this radar is looking for",
  "search_brief": {
    "category": "market category or niche",
    "geo": ["country or region"],
    "buyer": "target buyer or audience",
    "channels": ["web", "facebook", "instagram", "tiktok", "linkedin"],
    "signals": ["signal to inspect"]
  },
  "competitors": [
    {
      "name": "competitor name",
      "website": "https://example.com or empty string",
      "category": "direct, indirect, aspirational, local, substitute, or marketplace",
      "operating_since": "year, date range, or Not verified",
      "operating_age_note": "how to verify or why this is uncertain",
      "audience": "who they appear to serve",
      "positioning": "how they position themselves",
      "offer": "main offer or product line",
      "channels": ["website", "instagram"],
      "why_relevant": "why this belongs in the radar",
      "confidence": "high, medium, or low",
      "next_verification_steps": ["step 1", "step 2"]
    }
  ],
  "queries": ["search query to verify the list"],
  "data_note": "short note about verification limits"
}

Rules:
- Include 5 to 8 competitors when the brief is specific enough.
- If a website, founding year, launch year, or operating age is not confidently known, use "Not verified".
- Do not fabricate exact dates. Prefer verification steps over guessing.
- Use high confidence only for widely known facts.
- Prefer brands that match the user's category, geography, audience, and price point.
- Keep every field concise enough for an operations dashboard.
- Do not include markdown, commentary, or code fences.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 5000,
      temperature: 0.25,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data?.content?.map((part) => part.text).join('\n') || '';
  const parsed = extractJsonObject(text);
  if (!parsed || !Array.isArray(parsed.competitors)) {
    throw new Error('Failed to parse competitor radar JSON.');
  }

  return parsed;
}

function buildFallbackMonthlyCalendar(month, brandContext, source, skill) {
  const days = getMonthDays(month);
  const platforms = getPreferredPlatforms(brandContext);
  const pillars = normalizeStringList(brandContext.content_pillars, []).slice(0, 5);
  const safePillars = pillars.length
    ? pillars
    : ['Education', 'Proof', 'Behind the scenes', 'Founder story', 'Offer'];
  const goalList = normalizeStringList(brandContext.goals);
  const goals = goalList.length ? goalList : ['awareness'];
  const valuePropList = normalizeStringList(brandContext.value_props);
  const valueProps = valuePropList.length ? valuePropList : ['the main customer outcome'];
  const formats = ['Short video', 'Carousel', 'Story', 'Text post', 'UGC proof clip', 'Founder note', 'How-to post'];
  const ctas = ['Learn more', 'Save this', 'Comment with your question', 'Try it today', 'See how it works'];
  const brandName = brandContext.brand_name || 'the brand';

  return {
    month,
    source,
    summary: `Daily social calendar for ${brandName}, built around ${safePillars.slice(0, 3).join(', ')}.`,
    pillars: safePillars,
    calendar: days.map((day, index) => {
      const pillar = safePillars[index % safePillars.length];
      const platform = platforms[index % platforms.length];
      const format = formats[index % formats.length];
      const goal = goals[index % goals.length];
      const valueProp = valueProps[index % valueProps.length];
      const hook = buildFallbackHook(pillar, valueProp, index);
      const cta = ctas[index % ctas.length];

      return {
        id: day.date,
        date: day.date,
        day: day.day,
        weekday: day.weekday,
        platform,
        format,
        pillar,
        topic: `${pillar}: ${valueProp}`,
        hook,
        caption_prompt: `Write a ${platform} ${format.toLowerCase()} that connects ${valueProp} to ${goal}.`,
        task: `Publish a ${format.toLowerCase()} on ${platform}. Lead with "${hook}" and close with "${cta}".`,
        cta,
        status: 'planned',
      };
    }),
    skill: {
      name: skill.name,
      source_url: skill.source_url,
      fetched: Boolean(skill.fetched),
    },
    generation_mode: 'fallback',
  };
}

function buildFallbackHook(pillar, valueProp, index) {
  const hooks = [
    `Stop doing this if you want ${valueProp}`,
    `The simple way to get ${valueProp}`,
    `What most people miss about ${pillar.toLowerCase()}`,
    `Behind the scenes of ${valueProp}`,
    `One proof point that changes the decision`,
    `Before you try this, watch this first`,
  ];

  return hooks[index % hooks.length];
}

function sanitizeMonthlyPlan(candidate, fallback, month, source, skill) {
  const days = getMonthDays(month);
  const fallbackByDate = new Map((fallback.calendar || []).map((item) => [item.date, item]));
  const rawByDate = new Map();

  if (candidate && Array.isArray(candidate.calendar)) {
    candidate.calendar.forEach((item) => {
      const date = String(item?.date || '').trim();
      if (date.startsWith(`${month}-`) && !rawByDate.has(date)) {
        rawByDate.set(date, item);
      }
    });
  }

  const calendar = days.map((day) => {
    const raw = rawByDate.get(day.date) || {};
    const fallbackItem = fallbackByDate.get(day.date) || {};

    return {
      id: day.date,
      date: day.date,
      day: day.day,
      weekday: day.weekday,
      platform: cleanText(raw.platform, fallbackItem.platform),
      format: cleanText(raw.format, fallbackItem.format),
      pillar: cleanText(raw.pillar, fallbackItem.pillar),
      topic: cleanText(raw.topic, fallbackItem.topic),
      hook: cleanText(raw.hook, fallbackItem.hook),
      caption_prompt: cleanText(raw.caption_prompt, fallbackItem.caption_prompt),
      task: cleanText(raw.task, fallbackItem.task),
      cta: cleanText(raw.cta, fallbackItem.cta),
      status: 'planned',
    };
  });
  const candidatePillars = normalizeStringList(candidate?.pillars);

  return {
    month,
    source,
    source_label: source === 'questionnaire' ? 'Questionnaire' : 'Saved brand profile',
    summary: cleanText(candidate?.summary, fallback.summary),
    pillars: (candidatePillars.length ? candidatePillars : fallback.pillars).slice(0, 6),
    calendar,
    skill: {
      name: skill.name || 'social-content',
      source_url: skill.source_url,
      fetched: Boolean(skill.fetched),
    },
    generation_mode: candidate ? 'ai' : 'fallback',
  };
}

function buildFallbackCompetitorRadar(brief, brandContext = {}) {
  const industry = cleanText(brandContext.industry, 'your market');
  const audience = cleanText(brandContext.target_audience, 'your target audience');
  const brandName = cleanText(brandContext.brand_name, 'your brand');
  const countries = normalizeStringList(brandContext.countries);
  const geo = countries.length ? countries : ['Not specified'];
  const channels = getPreferredPlatforms(brandContext).map((platform) => platform.toLowerCase());
  const signals = extractRadarSignals(brief);
  const category = inferRadarCategory(brief, industry);
  const queryBase = [category, audience].filter(Boolean).join(' ').trim() || brief.slice(0, 90);

  return {
    summary: `Radar for ${brandName}: find competitors in ${category} serving ${audience}.`,
    search_brief: {
      category,
      geo,
      buyer: audience,
      channels: ['web', ...channels].slice(0, 5),
      signals,
    },
    competitors: buildFallbackCompetitorCandidates(category, audience, geo),
    queries: [
      `${queryBase} competitors`,
      `${queryBase} alternatives`,
      `${queryBase} brands operating since`,
      `${queryBase} audience positioning`,
      `${queryBase} reviews pricing`,
    ],
    data_note:
      'Compiled from your brief and saved brand profile. Add a live search provider to verify websites, dates, traffic, and audience evidence automatically.',
    generation_mode: 'fallback',
  };
}

function buildFallbackCompetitorCandidates(category, audience, geo = []) {
  const place = Array.isArray(geo) && geo.length ? geo[0] : 'your target market';
  return [
    {
      name: `${category} category leaders`,
      website: '',
      category: 'direct',
      operating_since: 'Not verified',
      operating_age_note: 'Verify through the brand website footer, LinkedIn company page, domain records, or Crunchbase.',
      audience,
      positioning: `Established brands already serving ${audience}.`,
      offer: `Comparable ${category} offer.`,
      channels: ['website', 'social'],
      why_relevant: 'They define the buyer expectations and messaging norms for this market.',
      confidence: 'low',
      next_verification_steps: [
        `Search "${category} competitors ${place}"`,
        'Open each official website and record founding or launch evidence.',
      ],
    },
    {
      name: `${category} fast movers`,
      website: '',
      category: 'aspirational',
      operating_since: 'Not verified',
      operating_age_note: 'Check recent ad activity, social posting cadence, funding announcements, and press coverage.',
      audience,
      positioning: `Newer challengers trying to win attention from ${audience}.`,
      offer: `Modern or niche-specific ${category} offer.`,
      channels: ['instagram', 'tiktok', 'facebook'],
      why_relevant: 'They are useful for spotting fresh hooks, offers, and audience language.',
      confidence: 'low',
      next_verification_steps: [
        `Search "${category} new brand ${place}"`,
        'Compare ad hooks, landing page claims, pricing, and reviews.',
      ],
    },
    {
      name: `${place} local alternatives`,
      website: '',
      category: 'local',
      operating_since: 'Not verified',
      operating_age_note: 'Verify business age through local directories, Google Business Profile, company registries, or review history.',
      audience,
      positioning: `Local providers competing for the same audience and intent.`,
      offer: `Location-specific ${category} offer.`,
      channels: ['website', 'google', 'facebook'],
      why_relevant: 'Local alternatives often reveal pricing, trust signals, and service language buyers already understand.',
      confidence: 'low',
      next_verification_steps: [
        `Search "${category} near ${place}"`,
        'Record websites, review count, review age, and repeated audience pain points.',
      ],
    },
  ];
}

function sanitizeCompetitorRadar(candidate, fallback, brief, brandContext = {}) {
  const rawCompetitors = Array.isArray(candidate?.competitors) && candidate.competitors.length
    ? candidate.competitors
    : fallback.competitors;
  const competitors = rawCompetitors.slice(0, 10).map((item, index) => sanitizeCompetitorItem(item, index));
  const rawBrief = candidate?.search_brief && typeof candidate.search_brief === 'object'
    ? candidate.search_brief
    : fallback.search_brief;

  return {
    summary: cleanText(candidate?.summary, fallback.summary),
    search_brief: {
      category: cleanText(rawBrief?.category, fallback.search_brief.category),
      geo: normalizeStringList(rawBrief?.geo, fallback.search_brief.geo).slice(0, 5),
      buyer: cleanText(rawBrief?.buyer, fallback.search_brief.buyer),
      channels: normalizeStringList(rawBrief?.channels, fallback.search_brief.channels).slice(0, 8),
      signals: normalizeStringList(rawBrief?.signals, fallback.search_brief.signals).slice(0, 8),
    },
    competitors,
    queries: normalizeStringList(candidate?.queries, fallback.queries).slice(0, 10),
    data_note: cleanText(candidate?.data_note, fallback.data_note),
    generation_mode: candidate ? 'ai' : 'fallback',
    source: {
      brief,
      brand_name: brandContext.brand_name || '',
      website_url: brandContext.website_url || '',
      industry: brandContext.industry || '',
    },
    generated_at: new Date().toISOString(),
  };
}

function sanitizeCompetitorItem(item = {}, index = 0) {
  const confidence = String(item.confidence || '').trim().toLowerCase();
  const allowedConfidence = ['high', 'medium', 'low'].includes(confidence) ? confidence : 'low';
  const name = cleanText(item.name, `Competitor candidate ${index + 1}`);

  return {
    id: `competitor-${index + 1}`,
    name,
    website: normalizeCompetitorWebsite(item.website),
    category: cleanText(item.category, 'direct'),
    operating_since: cleanText(item.operating_since, 'Not verified'),
    operating_age_note: cleanText(
      item.operating_age_note,
      'Verify through official website, company profile, domain records, or reputable directories.'
    ),
    audience: cleanText(item.audience, 'Not verified'),
    positioning: cleanText(item.positioning, 'Not verified'),
    offer: cleanText(item.offer, 'Not verified'),
    channels: normalizeStringList(item.channels, ['website']).slice(0, 6),
    why_relevant: cleanText(item.why_relevant, 'Matches the radar brief.'),
    confidence: allowedConfidence,
    next_verification_steps: normalizeStringList(item.next_verification_steps, [
      `Search the official website for ${name}.`,
      'Verify operating age and audience evidence from reliable sources.',
    ]).slice(0, 5),
  };
}

function normalizeCompetitorWebsite(value) {
  const text = String(value || '').trim();
  if (!text || /^not verified$/i.test(text)) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(text)) return `https://${text}`;
  return '';
}

function extractRadarSignals(brief = '') {
  const text = String(brief || '').toLowerCase();
  const signals = [];
  if (/website|site|landing/.test(text)) signals.push('websites');
  if (/audience|buyer|persona|customer/.test(text)) signals.push('audience');
  if (/price|pricing|offer|package/.test(text)) signals.push('offers');
  if (/ad|creative|hook|facebook|tiktok|instagram/.test(text)) signals.push('ad and social activity');
  if (/how long|operating|founded|founded|launch|age/.test(text)) signals.push('operating age');
  if (/review|trust|rating/.test(text)) signals.push('reviews and trust signals');
  return signals.length ? signals : ['competitor websites', 'audience', 'offers', 'operating age'];
}

function inferRadarCategory(brief = '', industry = '') {
  const text = String(brief || '').trim();
  if (!text) return industry || 'your market';
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/^find\s+/i, '')
    .replace(/^show\s+me\s+/i, '')
    .trim();
  const short = cleaned.split(/[.?!]/)[0].slice(0, 90).trim();
  return short || industry || 'your market';
}

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || String(fallback || '').trim();
}

function normalizeList(input, fallback) {
  return Array.isArray(input) && input.length
    ? input.map((value) => String(value).trim()).filter(Boolean)
    : fallback;
}

function buildPriorityScore(index, hook, angle) {
  const base = 88 - index * 5;
  const hookBoost = /stop|before|after|why|how/i.test(hook) ? 4 : 0;
  const angleBoost = /proof|demo|authority|offer/i.test(angle) ? 3 : 0;
  return Math.max(55, Math.min(99, base + hookBoost + angleBoost));
}

function buildFallbackAlerts() {
  return [
    {
      id: 'alert-fallback-1',
      competitor: 'Market Watch',
      type: 'new_offer_detected',
      message: 'A tracked competitor launched a new promotional offer.',
      occurred_at: new Date().toISOString(),
    },
    {
      id: 'alert-fallback-2',
      competitor: 'Market Watch',
      type: 'hook_shift_detected',
      message: 'Hook style shifted from feature-led to outcome-led.',
      occurred_at: new Date().toISOString(),
    },
  ];
}

function countPatternKeywords(videos = []) {
  const bucket = {
    'before/after proof': 0,
    'problem-solution hook': 0,
    'founder-led trust': 0,
    'offer urgency CTA': 0,
    'comment-reply social proof': 0,
  };

  for (const video of videos) {
    const text = String(video.caption || video.desc || video.text || '').toLowerCase();
    if (!text) continue;
    if (text.includes('before') || text.includes('after')) bucket['before/after proof'] += 1;
    if (text.includes('problem') || text.includes('fix')) bucket['problem-solution hook'] += 1;
    if (text.includes('founder') || text.includes('built')) bucket['founder-led trust'] += 1;
    if (text.includes('today') || text.includes('now') || text.includes('offer')) bucket['offer urgency CTA'] += 1;
    if (text.includes('comment') || text.includes('reply')) bucket['comment-reply social proof'] += 1;
  }
  return bucket;
}

function buildFallbackPatterns() {
  return [
    {
      id: 'pattern-fallback-1',
      pattern: 'before/after proof',
      rising_score: 92,
      frequency: 12,
      recommendation: 'Use transformation framing with measurable outcomes.',
    },
    {
      id: 'pattern-fallback-2',
      pattern: 'problem-solution hook',
      rising_score: 89,
      frequency: 10,
      recommendation: 'Lead with pain point in first 2 seconds.',
    },
    {
      id: 'pattern-fallback-3',
      pattern: 'offer urgency CTA',
      rising_score: 85,
      frequency: 8,
      recommendation: 'Add time-bound CTA to improve action intent.',
    },
  ];
}

function computeMatchScore(landingHeadline, adHook, adCta) {
  const headline = String(landingHeadline || '').toLowerCase();
  const hook = String(adHook || '').toLowerCase();
  const cta = String(adCta || '').toLowerCase();

  let score = 42;
  if (headline && hook) {
    const overlap = headline.split(' ').filter((word) => word.length > 3 && hook.includes(word)).length;
    score += Math.min(28, overlap * 7);
  }
  if (cta && headline.includes(cta.split(' ')[0])) score += 15;
  if (/free|save|discount|offer|proof|results/.test(`${headline} ${hook}`)) score += 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildMatchRecommendations(score, headline, hook, cta) {
  const recommendations = [];
  if (score < 70) {
    recommendations.push('Align your landing headline with the same core promise in the ad hook.');
  }
  if (!String(cta || '').trim()) {
    recommendations.push('Add a direct CTA phrase in the ad and repeat it on the landing hero section.');
  }
  if (!/proof|testimonial|review|results/i.test(`${headline} ${hook}`)) {
    recommendations.push('Add proof language to reduce skepticism between ad click and landing view.');
  }
  if (!recommendations.length) {
    recommendations.push('Strong alignment. Test one bolder CTA variant for incremental lift.');
  }
  return recommendations;
}

function stripCodeFences(text) {
  return String(text || '')
    .replace(/```json/gi, '```')
    .replace(/```[\r\n]?/g, '')
    .trim();
}

function extractJsonObject(text) {
  const input = stripCodeFences(text);
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        try {
          return JSON.parse(input.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = {
  getWeeklyRecommendations,
  generateCreativeTestPlanner,
  generateMonthlySocialCalendar,
  runCompetitorRadar,
  getCompetitorChangeAlerts,
  getWinningPatterns,
  generateCreativeBrief,
  getAudiencePersonaLens,
  getPerformanceBenchmarks,
  getLandingAdMatchScore,
  getSavedPlans,
  createSavedPlan,
  updateSavedPlan,
  deleteSavedPlan,
  getWatchlist,
  createWatchlistItem,
  updateWatchlistItem,
  deleteWatchlistItem,
};
