const pool = require('../db/connection');
const { normalizeWebsiteUrl, runWebsiteCrawl, crawlWebsiteForAudit } = require('../utils/websiteAudit');
const {
  scrapeWebsiteText,
  extractBrandFieldsFromWebsite,
  generateBrandVoiceDraft,
  defaultChannelsForIndustry,
} = require('../utils/onboardingWebsiteExtract');

function extractJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function toSqlJson(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

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

async function buildBrandProfileWithClaude(onboardingData, websiteContent) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY is not configured');
  }

  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

  const prompt = `You are building a compact but rich brand profile for performance creatives.
Return STRICT JSON only with this exact shape:
{
  "story": "brand story in 3-6 sentences",
  "tone_summary": "1-2 sentence description of voice and vibe",
  "value_props": ["benefit 1", "benefit 2", "benefit 3"],
  "content_pillars": ["pillar 1", "pillar 2", "pillar 3"],
  "ideal_customers": "short description of ideal customers",
  "suggested_channels": ["tiktok", "instagram", "facebook", "youtube", "google_ads", "reddit"]
}

Onboarding data (from founder/marketer):
${JSON.stringify(onboardingData || {}, null, 2)}

Website content (may be truncated):
${String(websiteContent || '').slice(0, 8000)}

Rules:
- Be specific to this brand, not generic.
- Use concise, ad-ready wording.
- value_props should be concrete benefits, max 8.
- content_pillars are themes you could create many ads around, max 8.
- Do not include markdown or extra commentary.`;

  const url = 'https://api.anthropic.com/v1/messages';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const claudeText = data?.content?.map((part) => part.text).join('\n') || '';
  const parsed = extractJson(claudeText);

  if (!parsed || !parsed.story) {
    throw new Error('Failed to parse Claude brand profile response');
  }

  return {
    story: String(parsed.story || '').trim(),
    tone_summary: String(parsed.tone_summary || '').trim(),
    value_props: Array.isArray(parsed.value_props)
      ? parsed.value_props.map((v) => String(v || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    content_pillars: Array.isArray(parsed.content_pillars)
      ? parsed.content_pillars.map((v) => String(v || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    ideal_customers: String(parsed.ideal_customers || '').trim(),
    suggested_channels: Array.isArray(parsed.suggested_channels)
      ? parsed.suggested_channels.map((v) => String(v || '').trim()).filter(Boolean).slice(0, 8)
      : [],
  };
}

async function refreshBrandProfileInBackground({ userId, onboarding }) {
  try {
    const websiteUrl = onboarding.websiteUrl || onboarding.website_url || null;

    let websiteContent = '';
    if (websiteUrl) {
      try {
        websiteContent = await runWebsiteCrawl(websiteUrl);
      } catch (crawlError) {
        console.error('Website crawl failed:', crawlError);
      }
    }

    let profile;
    try {
      profile = await buildBrandProfileWithClaude(onboarding, websiteContent);
    } catch (llmError) {
      console.error('Brand profile generation failed:', llmError);
      return;
    }

    await pool.query(
      `UPDATE brand_profiles
       SET story = ?, 
           tone = JSON_OBJECT('summary', ?),
           value_props = ?,
           content_pillars = ?,
           last_scraped_at = NOW()
       WHERE user_id = ?`,
      [
        profile.story,
        profile.tone_summary,
        JSON.stringify(profile.value_props || []),
        JSON.stringify(profile.content_pillars || []),
        userId,
      ]
    );
  } catch (error) {
    console.error('refreshBrandProfileInBackground error:', error);
  }
}

async function getBrandProfileRow(userId) {
  const [rows] = await pool.query(
    `SELECT id, user_id, brand_name, website_url, industry, brand_size, target_audience,
            goals, channels, preferences, story, tone, value_props, content_pillars,
            onboarding_step, onboarding_completed,
            created_at, updated_at, last_scraped_at
     FROM brand_profiles
     WHERE user_id = ?`,
    [userId]
  );
  return rows?.[0] || null;
}

function parsePreferences(value) {
  if (value == null) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value)) || {};
  } catch {
    return {};
  }
}

function buildPreferencesPayload(body = {}, existing = {}) {
  const prefs = { ...existing };
  const incoming = body.preferences && typeof body.preferences === 'object' ? body.preferences : {};

  if (body.niche != null) prefs.niche = String(body.niche || '').trim();
  if (incoming.niche != null) prefs.niche = String(incoming.niche || '').trim();
  if (Array.isArray(body.countries)) prefs.countries = body.countries;
  if (Array.isArray(incoming.countries)) prefs.countries = incoming.countries;
  if (incoming.country != null) prefs.country = incoming.country;
  if (incoming.audienceRole != null) prefs.audienceRole = String(incoming.audienceRole || '').trim();
  if (body.audienceRole != null) prefs.audienceRole = String(body.audienceRole || '').trim();
  if (incoming.scrapeCache != null) prefs.scrapeCache = incoming.scrapeCache;
  if (body.scrapeCache != null) prefs.scrapeCache = body.scrapeCache;
  if (incoming.extracted != null) prefs.extracted = incoming.extracted;
  if (body.extracted != null) prefs.extracted = body.extracted;
  if (incoming.onboardingFlowVersion != null) prefs.onboardingFlowVersion = Number(incoming.onboardingFlowVersion) || incoming.onboardingFlowVersion;

  return prefs;
}

async function upsertOnboardingProfile(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[onboarding] upsert start', {
      userId: req.user.id,
      bodyKeys: Object.keys(req.body || {}),
    });

    await ensureUser(req.user);

    const {
      brandName,
      websiteUrl,
      industry,
      brandSize,
      targetAudience,
      idealCustomers,
      goals,
      channels,
      preferences,
      story,
      value_props: valueProps,
      content_pillars: contentPillars,
      tone,
      onboardingStep,
      onboardingCompleted,
      niche,
      countries,
    } = req.body;

    const existing = await getBrandProfileRow(req.user.id);
    const existingPrefs = parsePreferences(existing?.preferences);
    const mergedPrefs = buildPreferencesPayload(
      { niche, countries, preferences: preferences || {}, scrapeCache: req.body.scrapeCache, extracted: req.body.extracted },
      existingPrefs
    );

    const resolvedTargetAudience =
      String(targetAudience || idealCustomers || existing?.target_audience || '').trim() || null;
    const resolvedStep = Number.isFinite(Number(onboardingStep))
      ? Math.min(5, Math.max(1, Number(onboardingStep)))
      : Number(existing?.onboarding_step) || 1;
    const resolvedCompleted =
      onboardingCompleted === true || onboardingCompleted === 1 || onboardingCompleted === '1'
        ? 1
        : onboardingCompleted === false || onboardingCompleted === 0 || onboardingCompleted === '0'
          ? 0
          : Number(existing?.onboarding_completed) || 0;

    if (!brandName && !websiteUrl && !existing && !onboardingStep) {
      return res.status(400).json({ error: 'brandName or websiteUrl is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO brand_profiles (
        user_id, brand_name, website_url, industry, brand_size, target_audience,
        goals, channels, preferences, story, tone, value_props, content_pillars,
        onboarding_step, onboarding_completed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        brand_name = COALESCE(VALUES(brand_name), brand_name),
        website_url = COALESCE(VALUES(website_url), website_url),
        industry = COALESCE(VALUES(industry), industry),
        brand_size = COALESCE(VALUES(brand_size), brand_size),
        target_audience = COALESCE(VALUES(target_audience), target_audience),
        goals = COALESCE(VALUES(goals), goals),
        channels = COALESCE(VALUES(channels), channels),
        preferences = COALESCE(VALUES(preferences), preferences),
        story = COALESCE(VALUES(story), story),
        tone = COALESCE(VALUES(tone), tone),
        value_props = COALESCE(VALUES(value_props), value_props),
        content_pillars = COALESCE(VALUES(content_pillars), content_pillars),
        onboarding_step = COALESCE(VALUES(onboarding_step), onboarding_step),
        onboarding_completed = COALESCE(VALUES(onboarding_completed), onboarding_completed),
        updated_at = CURRENT_TIMESTAMP`,
      [
        req.user.id,
        brandName || existing?.brand_name || null,
        websiteUrl || existing?.website_url || null,
        industry || existing?.industry || null,
        brandSize || existing?.brand_size || null,
        resolvedTargetAudience,
        goals != null ? toSqlJson(goals) : toSqlJson(existing?.goals),
        channels != null ? toSqlJson(channels) : toSqlJson(existing?.channels),
        Object.keys(mergedPrefs).length ? toSqlJson(mergedPrefs) : toSqlJson(existing?.preferences),
        story !== undefined ? story || null : existing?.story || null,
        tone != null ? toSqlJson(tone) : toSqlJson(existing?.tone),
        valueProps != null ? toSqlJson(valueProps) : toSqlJson(existing?.value_props),
        contentPillars != null ? toSqlJson(contentPillars) : toSqlJson(existing?.content_pillars),
        resolvedStep,
        resolvedCompleted,
      ]
    );

    const onboarding = {
      brandName: brandName || existing?.brand_name,
      websiteUrl: websiteUrl || existing?.website_url,
      industry: industry || existing?.industry,
      brandSize,
      targetAudience: resolvedTargetAudience,
      goals,
      channels,
      preferences: mergedPrefs,
    };

    if (!story && !valueProps && !contentPillars && resolvedCompleted) {
      refreshBrandProfileInBackground({ userId: req.user.id, onboarding }).catch((error) => {
        console.error('Failed to start background brand profile refresh:', error);
      });
    }

    const [rows] = await pool.query(
      `SELECT id, user_id, brand_name, website_url, industry, brand_size, target_audience,
              goals, channels, preferences, story, tone, value_props, content_pillars,
              onboarding_step, onboarding_completed,
              created_at, updated_at, last_scraped_at
       FROM brand_profiles
       WHERE user_id = ?`,
      [req.user.id]
    );

    console.log('[onboarding] upsert done', {
      userId: req.user.id,
      created: result.affectedRows === 1,
    });

    return res.status(result.affectedRows === 1 ? 201 : 200).json(rows[0]);
  } catch (error) {
    console.error('upsertOnboardingProfile error:', error);
    return res.status(500).json({ error: 'Failed to save onboarding profile' });
  }
}

async function getBrandProfile(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[onboarding] status check', { userId: req.user.id });

    await ensureUser(req.user);

    const [rows] = await pool.query(
      `SELECT id, user_id, brand_name, website_url, industry, brand_size, target_audience,
              goals, channels, preferences, story, tone, value_props, content_pillars,
              onboarding_step, onboarding_completed,
              created_at, updated_at, last_scraped_at
       FROM brand_profiles
       WHERE user_id = ?`,
      [req.user.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Brand profile not found' });
    }

    const row = rows[0];

    function safeParseJson(value) {
      if (value == null) return null;
      if (typeof value === 'object') return value;
      const text = String(value).trim();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        // Fallback: treat comma-separated strings as simple arrays
        if (text.includes(',')) {
          return text
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
        }
        return text;
      }
    }

    const parsed = {
      ...row,
      goals: safeParseJson(row.goals),
      channels: safeParseJson(row.channels),
      preferences: safeParseJson(row.preferences),
      value_props: safeParseJson(row.value_props),
      content_pillars: safeParseJson(row.content_pillars),
      tone: safeParseJson(row.tone),
    };

    return res.json(parsed);
  } catch (error) {
    console.error('getBrandProfile error:', error);
    return res.status(500).json({ error: 'Failed to fetch brand profile' });
  }
}

async function getOnboardingStatus(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await ensureUser(req.user);

    const [rows] = await pool.query(
      `SELECT brand_name, website_url, story, onboarding_step, onboarding_completed, preferences
       FROM brand_profiles
       WHERE user_id = ?`,
      [req.user.id]
    );

    if (!rows || rows.length === 0) {
      console.log('[onboarding] status result', {
        userId: req.user.id,
        state: 'no_profile',
      });
      return res.json({
        completed: false,
        onboardingStep: 1,
        hasProfile: false,
        hasInsights: false,
      });
    }

    const row = rows[0];
    const prefs = parsePreferences(row.preferences);
    const hasBasicProfile =
      Boolean(Number(row.onboarding_completed)) ||
      (row.brand_name && String(row.brand_name).trim()) ||
      (row.website_url && String(row.website_url).trim());
    const hasInsights = row.story && String(row.story).trim();

    const status = {
      completed: Boolean(Number(row.onboarding_completed)),
      onboardingStep: Number(row.onboarding_step) || 1,
      hasProfile: Boolean(hasBasicProfile),
      hasInsights: Boolean(hasInsights),
      niche: prefs.niche || '',
      audienceRole: prefs.audienceRole || '',
      countries: Array.isArray(prefs.countries) ? prefs.countries : [],
    };

    console.log('[onboarding] status result', {
      userId: req.user.id,
      ...status,
    });

    return res.json(status);
  } catch (error) {
    console.error('getOnboardingStatus error:', error);
    return res.status(500).json({ error: 'Failed to fetch onboarding status' });
  }
}

async function extractWebsiteBrand(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await ensureUser(req.user);

    const { websiteUrl } = req.body || {};
    if (!websiteUrl || !String(websiteUrl).trim()) {
      return res.status(400).json({ error: 'websiteUrl is required' });
    }

    let normalizedUrl;
    try {
      normalizedUrl = normalizeWebsiteUrl(websiteUrl);
    } catch (e) {
      return res.status(400).json({ error: e.message || 'Invalid website URL' });
    }

    const scrape = await scrapeWebsiteText(normalizedUrl);
    const extracted = await extractBrandFieldsFromWebsite(scrape.scrapedText);
    const suggestedChannels = defaultChannelsForIndustry(extracted.industry);

    const existing = await getBrandProfileRow(req.user.id);
    const mergedPrefs = buildPreferencesPayload(
      {
        scrapeCache: {
          websiteUrl: scrape.websiteUrl,
          scrapedText: scrape.scrapedText,
          aboutUrl: scrape.aboutUrl,
        },
        extracted,
      },
      parsePreferences(existing?.preferences)
    );

    await pool.query(
      `INSERT INTO brand_profiles (user_id, website_url, preferences, onboarding_step)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         website_url = VALUES(website_url),
         preferences = VALUES(preferences),
         updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, scrape.websiteUrl, JSON.stringify(mergedPrefs)]
    );

    return res.json({
      websiteUrl: scrape.websiteUrl,
      extracted,
      suggestedChannels,
      scrapeCache: mergedPrefs.scrapeCache,
    });
  } catch (error) {
    console.error('extractWebsiteBrand error:', error);
    return res.status(500).json({ error: error.message || 'Failed to extract brand from website' });
  }
}

async function generateVoiceDraft(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await ensureUser(req.user);

    const { websiteUrl, scrapeCache } = req.body || {};
    const existing = await getBrandProfileRow(req.user.id);
    const prefs = parsePreferences(existing?.preferences);
    const cached = scrapeCache || prefs.scrapeCache || null;

    let scrapedText = String(cached?.scrapedText || '').trim();
    const url = websiteUrl || cached?.websiteUrl || existing?.website_url || '';

    if (!scrapedText && url) {
      const scrape = await scrapeWebsiteText(url);
      scrapedText = scrape.scrapedText;
    }

    if (!scrapedText) {
      return res.status(400).json({ error: 'No website content available to generate a draft' });
    }

    const draft = await generateBrandVoiceDraft(scrapedText);
    return res.json(draft);
  } catch (error) {
    console.error('generateVoiceDraft error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate brand voice draft' });
  }
}

async function patchOnboardingProfile(req, res) {
  req.body = { ...(req.body || {}) };
  return upsertOnboardingProfile(req, res);
}

async function previewBrandProfile(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await ensureUser(req.user);

    const {
      brandName,
      websiteUrl,
      industry,
      brandSize,
      niche,
      country,
      goals,
      channels,
      whatsappNumber,
      newsletterOptIn,
    } = req.body;

    if (!websiteUrl || !String(websiteUrl).trim()) {
      return res.status(400).json({ error: 'websiteUrl is required' });
    }

    let normalizedUrl;
    try {
      normalizedUrl = normalizeWebsiteUrl(websiteUrl);
    } catch (e) {
      return res.status(400).json({ error: e.message || 'Invalid website URL' });
    }

    const onboardingData = {
      brandName,
      websiteUrl: normalizedUrl,
      industry,
      brandSize,
      niche,
      country,
      goals,
      channels,
      whatsappNumber,
      newsletterOptIn: Boolean(newsletterOptIn),
    };

    const websiteContent = await runWebsiteCrawl(normalizedUrl);
    const profile = await buildBrandProfileWithClaude(onboardingData, websiteContent);

    return res.json({
      onboarding: onboardingData,
      profile,
    });
  } catch (error) {
    console.error('previewBrandProfile error:', error);
    return res.status(500).json({ error: 'Failed to generate brand profile preview' });
  }
}

function clampScore(value, min = 32, max = 96) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function pickFirst(items = [], fallback = '') {
  return Array.isArray(items) ? String(items.find(Boolean) || fallback || '').trim() : String(fallback || '').trim();
}

function buildLandingPreviewReport(audit) {
  const homepage = audit?.homepage || {};
  const title = String(homepage.title || '').trim();
  const metaDescription = String(homepage.meta_description || '').trim();
  const heroHeadline = pickFirst(homepage.headings?.h1);
  const supportingHeadline = pickFirst(homepage.headings?.h2);
  const ctas = Array.isArray(homepage.ctas) ? homepage.ctas.filter(Boolean).slice(0, 4) : [];
  const formCount = Number(homepage.form_count || 0);
  const inputCount = Number(homepage.input_count || 0);
  const testimonialMentions = Number(homepage.testimonial_mentions || 0);
  const trustMentions = Number(homepage.trust_mentions || 0);
  const priceMentions = Number(homepage.price_mentions || 0);

  const clarity = clampScore(
    46 +
      (title ? 10 : 0) +
      (metaDescription ? 8 : 0) +
      (heroHeadline ? 14 : 0) +
      (supportingHeadline ? 6 : 0) +
      (ctas.length >= 1 ? 7 : 0) -
      (heroHeadline && heroHeadline.length > 90 ? 5 : 0)
  );

  const trust = clampScore(
    40 +
      Math.min(16, testimonialMentions * 4) +
      Math.min(16, trustMentions * 2) +
      (homepage.image_count ? 4 : 0) +
      (homepage.has_viewport_meta ? 4 : 0)
  );

  const conversion = clampScore(
    42 +
      Math.min(18, ctas.length * 6) +
      Math.min(10, formCount * 5) +
      Math.min(8, inputCount * 2) +
      (priceMentions ? 8 : 0)
  );

  const whatsWorking = [];
  const toImprove = [];
  const actionPoints = [];

  if (heroHeadline) {
    whatsWorking.push(`Your homepage already leads with a visible primary headline: "${heroHeadline}".`);
  } else {
    toImprove.push('We could not detect a clear H1 headline on the homepage, which makes the first message less obvious.');
    actionPoints.push('Add one strong above-the-fold headline that says what you do, who it is for, and the outcome.');
  }

  if (metaDescription) {
    whatsWorking.push(`Your meta description gives search visitors extra context: "${metaDescription}".`);
  } else {
    toImprove.push('There is no clear meta description coming through, so search traffic may see weaker messaging before landing.');
    actionPoints.push('Write a tighter meta description that mirrors your homepage promise and main offer.');
  }

  if (ctas.length) {
    whatsWorking.push(`We found clear CTA text on the page, including ${ctas.map((item) => `"${item}"`).join(', ')}.`);
  } else {
    toImprove.push('We did not find a strong clickable CTA phrase early enough on the page.');
    actionPoints.push('Make your first CTA more explicit, outcome-led, and visible above the fold.');
  }

  if (testimonialMentions > 0 || trustMentions > 0) {
    whatsWorking.push(`The page includes trust-oriented language, with ${testimonialMentions} testimonial mention(s) and ${trustMentions} trust signal mention(s).`);
  } else {
    toImprove.push('There are very few visible trust or testimonial signals in the homepage copy.');
    actionPoints.push('Bring reviews, client logos, proof, guarantees, or trust badges closer to the hero and CTA.');
  }

  if (!priceMentions) {
    toImprove.push('Pricing or offer transparency is not obvious from the homepage text we captured.');
    actionPoints.push('If you want faster qualification, mention pricing, plans, or at least the starting offer earlier on the page.');
  }

  if (formCount === 0 && inputCount === 0) {
    toImprove.push('We did not detect a visible form or input on the homepage, which may slow down direct conversions.');
    actionPoints.push('Consider an email capture, demo request, or lead form section if conversion depends on direct contact.');
  }

  if (supportingHeadline) {
    whatsWorking.push(`You also support the main message with secondary copy such as "${supportingHeadline}".`);
  }

  if (!actionPoints.length) {
    actionPoints.push('Tighten the hero copy so the value proposition, proof, and next step sit closer together.');
  }

  return {
    title: audit?.website_url ? `${audit.website_url.replace(/^https?:\/\//, '')} conversion snapshot` : 'Website conversion snapshot',
    subtitle: 'This preview uses real homepage copy and visible page structure to highlight what is already working and where conversions could improve.',
    metrics: [
      { label: 'Clarity', value: clarity, tone: clarity >= 80 ? 'good' : clarity >= 65 ? 'medium' : 'warn' },
      { label: 'Trust', value: trust, tone: trust >= 80 ? 'good' : trust >= 65 ? 'medium' : 'warn' },
      { label: 'Conversion', value: conversion, tone: conversion >= 80 ? 'good' : conversion >= 65 ? 'medium' : 'warn' },
    ],
    whats_working: whatsWorking.slice(0, 4),
    to_improve: toImprove.slice(0, 4),
    action_points: actionPoints.slice(0, 4),
    captured_copy: {
      title,
      meta_description: metaDescription,
      hero_headline: heroHeadline,
      supporting_headline: supportingHeadline,
      ctas,
    },
  };
}

async function previewLandingWebsite(req, res) {
  try {
    const { websiteUrl } = req.body || {};
    if (!websiteUrl || !String(websiteUrl).trim()) {
      return res.status(400).json({ error: 'websiteUrl is required' });
    }

    const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
    const audit = await crawlWebsiteForAudit(normalizedUrl);
    const report = buildLandingPreviewReport(audit);

    return res.json({
      report,
      website: {
        url: audit.website_url,
      },
    });
  } catch (error) {
    console.error('previewLandingWebsite error:', error);
    return res.status(500).json({ error: error.message || 'Failed to analyze website preview' });
  }
}

module.exports = {
  upsertOnboardingProfile,
  patchOnboardingProfile,
  getBrandProfile,
  getOnboardingStatus,
  extractWebsiteBrand,
  generateVoiceDraft,
  previewBrandProfile,
  previewLandingWebsite,
};
