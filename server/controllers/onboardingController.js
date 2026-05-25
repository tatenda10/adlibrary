const pool = require('../db/connection');
const { normalizeWebsiteUrl, runWebsiteCrawl, crawlWebsiteForAudit } = require('../utils/websiteAudit');

function extractJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
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

  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

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
      goals,
      channels,
      preferences,
      story,
      value_props: valueProps,
      content_pillars: contentPillars,
      tone,
    } = req.body;

    if (!brandName && !websiteUrl) {
      return res.status(400).json({ error: 'brandName or websiteUrl is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO brand_profiles (
        user_id, brand_name, website_url, industry, brand_size, target_audience,
        goals, channels, preferences, story, tone, value_props, content_pillars
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        brand_name = VALUES(brand_name),
        website_url = VALUES(website_url),
        industry = VALUES(industry),
        brand_size = VALUES(brand_size),
        target_audience = VALUES(target_audience),
        goals = VALUES(goals),
        channels = VALUES(channels),
        preferences = VALUES(preferences),
        story = COALESCE(VALUES(story), story),
        tone = COALESCE(VALUES(tone), tone),
        value_props = COALESCE(VALUES(value_props), value_props),
        content_pillars = COALESCE(VALUES(content_pillars), content_pillars),
        updated_at = CURRENT_TIMESTAMP`,
      [
        req.user.id,
        brandName || null,
        websiteUrl || null,
        industry || null,
        brandSize || null,
        targetAudience || null,
        goals ? JSON.stringify(goals) : null,
        channels ? JSON.stringify(channels) : null,
        preferences ? JSON.stringify(preferences) : null,
        story || null,
        tone ? JSON.stringify(tone) : null,
        valueProps ? JSON.stringify(valueProps) : null,
        contentPillars ? JSON.stringify(contentPillars) : null,
      ]
    );

    const onboarding = {
      brandName,
      websiteUrl,
      industry,
      brandSize,
      targetAudience,
      goals,
      channels,
      preferences,
    };

    if (!story && !valueProps && !contentPillars) {
      refreshBrandProfileInBackground({ userId: req.user.id, onboarding }).catch((error) => {
        console.error('Failed to start background brand profile refresh:', error);
      });
    }

    const [rows] = await pool.query(
      `SELECT id, user_id, brand_name, website_url, industry, brand_size, target_audience,
              goals, channels, preferences, story, tone, value_props, content_pillars,
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
      `SELECT brand_name, website_url, story
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
        hasProfile: false,
        hasInsights: false,
      });
    }

    const row = rows[0];
    const hasBasicProfile =
      (row.brand_name && String(row.brand_name).trim()) ||
      (row.website_url && String(row.website_url).trim());
    const hasInsights = row.story && String(row.story).trim();

    const status = {
      completed: Boolean(hasBasicProfile),
      hasProfile: Boolean(hasBasicProfile),
      hasInsights: Boolean(hasInsights),
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
  getBrandProfile,
  getOnboardingStatus,
  previewBrandProfile,
  previewLandingWebsite,
};
