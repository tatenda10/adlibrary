const { GoogleGenerativeAI } = require('@google/generative-ai');
const { AD_COPY_GUIDELINES } = require('../utils/adCopyGuidelines');
const { loadMarketingSkill } = require('../utils/marketingSkills');
const { crawlHomepageForBrief, crawlWebsiteForAudit } = require('../utils/websiteAudit');

const PRODUCT_TYPE_VALUES = new Set([
  'saas_app',
  'physical',
  'digital',
  'subscription',
  'service',
  'course',
  'other',
]);

const CATEGORY_VALUES = new Set([
  'ecommerce',
  'saas',
  'health',
  'beauty',
  'finance',
  'education',
  'entertainment',
  'food',
  'other',
]);

let cachedModelId = null;

async function resolveGeminiModelId() {
  if (cachedModelId) return cachedModelId;

  const preferredFromEnv = process.env.GEMINI_MODEL;
  const apiKey = process.env.GEMINI_API_KEY;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'GET',
    }
  );

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Failed to list Gemini models: ${resp.status} ${body}`);
  }

  const data = await resp.json();
  const models = Array.isArray(data.models) ? data.models : [];

  const candidates = models
    .filter((m) => {
      const methods = m.supportedGenerationMethods || [];
      return Array.isArray(methods) && methods.includes('generateContent');
    })
    .map((m) => m.name);

  console.log('[hooks] Gemini models supporting generateContent:', candidates);

  if (!candidates.length) {
    throw new Error('No Gemini models supporting generateContent were found via REST list.');
  }

  // If env model is set and present in candidates, use it.
  if (preferredFromEnv) {
    const foundExact = candidates.find((name) => name === preferredFromEnv);
    if (foundExact) {
      cachedModelId = foundExact;
      return cachedModelId;
    }
    const foundSuffix = candidates.find((name) => name.endsWith(preferredFromEnv));
    if (foundSuffix) {
      cachedModelId = foundSuffix;
      return cachedModelId;
    }
  }

  // Prefer flash variants
  const flash = candidates.find((name) => name.toLowerCase().includes('flash'));
  if (flash) {
    cachedModelId = flash;
    return cachedModelId;
  }

  // Fallback to the first available candidate
  cachedModelId = candidates[0];
  return cachedModelId;
}

async function generateHookScript(req, res) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const { hook = '', referenceUrl = '', brandContext = '', product = '' } = req.body || {};

    if (!hook.trim()) {
      return res.status(400).json({ error: 'hook is required' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelId = await resolveGeminiModelId();

    const prompt = `You are writing a short-form TikTok ad script using a proven hook.

Hook to use (adapt but keep the core idea):
"${hook}"

Reference video (optional, gives pacing and structure inspiration):
${referenceUrl || 'none provided'}

Brand / product context (optional):
${brandContext || 'Not provided'}

Product or offer (optional explicit description):
${product || 'Not provided'}

Write a complete TikTok script that:
- Uses the hook in the first 1-3 seconds.
- Is 20–35 seconds long.
- Uses clear scene-by-scene lines (1–2 sentences per line).
- Mixes VOICEOVER and ON-SCREEN TEXT notes where helpful.
- Ends with a single strong CTA.

${AD_COPY_GUIDELINES}

Return ONLY the script as plain text, no markdown, no JSON.`;

    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return res.json({
      script: text.trim(),
      model: modelId,
    });
  } catch (error) {
    console.error('generateHookScript error:', error);
    return res.status(500).json({ error: 'Failed to generate script with Gemini' });
  }
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeStringList(value, max = 12) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(list.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, max);
}

function normalizePlatformVariants(parsed) {
  const raw = parsed.platform_variants || parsed.platform_copy || parsed.by_platform;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const platform = String(row.platform || row.medium || '').trim();
      if (!platform) return null;
      return {
        platform,
        hook: String(row.hook || row.opening_hook || '').trim(),
        headline: String(row.headline || '').trim(),
        primary_text: String(row.primary_text || row.primaryText || row.body || '').trim(),
        cta: String(row.cta || row.call_to_action || '').trim(),
        description: String(row.description || row.link_description || '').trim(),
        format_notes: String(row.format_notes || row.notes || '').trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeProductBriefPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const productDescription = String(
    parsed.product_description || parsed.productDescription || parsed.description || ''
  ).trim();
  if (!productDescription) return null;

  const productType = String(parsed.product_type || parsed.productType || '').trim();
  const category = String(parsed.category || '').trim();

  return {
    product_name: String(parsed.product_name || parsed.productName || parsed.name || '').trim(),
    product_description: productDescription,
    product_type: PRODUCT_TYPE_VALUES.has(productType) ? productType : '',
    niche: String(parsed.niche || '').trim(),
    category: CATEGORY_VALUES.has(category) ? category : '',
    target_audience: String(parsed.target_audience || parsed.targetAudience || '').trim(),
    offer: String(parsed.offer || parsed.promo || '').trim(),
  };
}

async function crawlSiteForProductBrief(websiteUrl) {
  let audit = await crawlHomepageForBrief(websiteUrl);
  const excerpt = String(audit?.homepage?.text_excerpt || '');
  if (excerpt.length < 120) {
    try {
      const deep = await crawlWebsiteForAudit(websiteUrl);
      if (String(deep?.text_content || '').length > excerpt.length) {
        audit = {
          website_url: deep.website_url,
          fetched_at: deep.fetched_at,
          homepage: {
            ...audit.homepage,
            title: deep.homepage?.title || audit.homepage?.title,
            meta_description: deep.homepage?.meta_description || audit.homepage?.meta_description,
            headings: deep.homepage?.headings || audit.homepage?.headings,
            ctas: deep.homepage?.ctas || audit.homepage?.ctas,
            text_excerpt: String(deep.text_content || deep.homepage?.text_excerpt || excerpt).slice(0, 8000),
          },
        };
      }
    } catch (error) {
      console.error('Deep crawl fallback for product brief:', error?.message || error);
    }
  }
  return audit;
}

async function extractProductBriefWithGemini(audit) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelId = await resolveGeminiModelId();
  const homepage = audit?.homepage || {};

  const prompt = `You analyze marketing websites and extract a concise product brief for ad copywriters.

WEBSITE: ${audit?.website_url || ''}

PAGE DATA:
${JSON.stringify(
  {
    title: homepage.title,
    meta_description: homepage.meta_description,
    og_title: homepage.og_title,
    og_description: homepage.og_description,
    headings: homepage.headings,
    ctas: homepage.ctas,
    text_excerpt: homepage.text_excerpt,
  },
  null,
  2
)}

Return STRICT JSON only:
{
  "product_name": "brand or product name",
  "product_description": "2-4 sentences: what it is, who it helps, main benefits, proof if visible. Write for an ad brief, not SEO.",
  "product_type": "one of: saas_app, physical, digital, subscription, service, course, other",
  "niche": "short niche label e.g. AI companions, skincare",
  "category": "one of: ecommerce, saas, health, beauty, finance, education, entertainment, food, other",
  "target_audience": "who it is for, or empty string",
  "offer": "visible promo/pricing hook or empty string"
}`;

  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(prompt);
  const parsed = normalizeProductBriefPayload(extractJsonObject(result.response.text()));
  if (!parsed) {
    throw new Error('Could not understand this website. Add a short description manually.');
  }
  return { brief: parsed, model: modelId };
}

async function extractProductFromWebsite(req, res) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const websiteUrl = String(req.body?.websiteUrl || '').trim();
    if (!websiteUrl) {
      return res.status(400).json({ error: 'Website URL is required.' });
    }

    const audit = await crawlSiteForProductBrief(websiteUrl);
    const { brief, model } = await extractProductBriefWithGemini(audit);

    return res.json({
      website_url: audit.website_url,
      brief,
      model,
    });
  } catch (error) {
    console.error('extractProductFromWebsite error:', error);
    return res.status(500).json({ error: error.message || 'Failed to read product from website.' });
  }
}

function normalizeFacebookAdCopyPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const hooks = Array.isArray(parsed.hooks)
    ? parsed.hooks.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8)
    : [];
  const headline = String(parsed.headline || parsed.ad_headline || '').trim();
  const cta = String(parsed.cta || parsed.call_to_action || '').trim();
  const primaryText = String(parsed.primary_text || parsed.primaryText || parsed.body || '').trim();
  const description = String(parsed.description || parsed.link_description || '').trim();
  const platformVariants = normalizePlatformVariants(parsed);
  if (!hooks.length && !headline && !primaryText && !platformVariants.length) return null;
  return {
    hooks: hooks.length ? hooks : headline ? [headline] : [],
    headline,
    cta,
    primary_text: primaryText,
    description,
    platforms_targeted: normalizeStringList(parsed.platforms_targeted || parsed.mediums, 8),
    platform_variants: platformVariants,
    angles_used: Array.isArray(parsed.angles_used)
      ? parsed.angles_used.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
      : [],
    notes: String(parsed.notes || '').trim(),
  };
}

async function generateFacebookAdCopy(req, res) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const {
      productName = '',
      productDescription = '',
      websiteUrl = '',
      productType = '',
      niche = '',
      category = '',
      mediums = [],
      targetAudience = '',
      offer = '',
      goal = '',
      angle = '',
      tone = '',
      brandContext = '',
    } = req.body || {};

    const selectedMediums = normalizeStringList(mediums, 8);
    if (!selectedMediums.length) {
      return res.status(400).json({ error: 'Select at least one platform / medium.' });
    }

    let resolvedName = String(productName || '').trim();
    let resolvedDescription = String(productDescription || '').trim();
    let resolvedType = String(productType || '').trim();
    let resolvedNiche = String(niche || '').trim();
    let resolvedCategory = String(category || '').trim();
    let resolvedAudience = String(targetAudience || '').trim();
    let resolvedOffer = String(offer || '').trim();

    if (!resolvedDescription && !resolvedName && String(websiteUrl || '').trim()) {
      const audit = await crawlSiteForProductBrief(websiteUrl);
      const extracted = await extractProductBriefWithGemini(audit);
      const fromSite = extracted.brief;
      resolvedName = resolvedName || fromSite.product_name;
      resolvedDescription = fromSite.product_description;
      resolvedType = resolvedType || fromSite.product_type;
      resolvedNiche = resolvedNiche || fromSite.niche;
      resolvedCategory = resolvedCategory || fromSite.category;
      resolvedAudience = resolvedAudience || fromSite.target_audience;
      resolvedOffer = resolvedOffer || fromSite.offer;
    }

    const brief = {
      product_name: resolvedName,
      product_description: resolvedDescription,
      product_type: resolvedType,
      niche: resolvedNiche,
      category: resolvedCategory,
      mediums: selectedMediums,
      target_audience: resolvedAudience,
      offer: resolvedOffer,
      goal: String(goal || '').trim(),
      angle: String(angle || '').trim(),
      tone: String(tone || '').trim(),
      brand_context: String(brandContext || '').trim(),
    };

    if (!brief.product_description && !brief.product_name) {
      return res.status(400).json({ error: 'Product name or description is required.' });
    }

    const [hookSkill, adCreativeSkill] = await Promise.all([
      loadMarketingSkill('hook-writer'),
      loadMarketingSkill('ad-creative'),
    ]);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelId = await resolveGeminiModelId();

    const prompt = `You are a performance ad copywriter.

Use these playbooks:

HOOK WRITER SKILL (opening lines, scroll-stopping hooks):
${String(hookSkill.text || '').slice(0, 6000)}

AD CREATIVE SKILL (headlines, primary text, CTAs, platform specs):
${String(adCreativeSkill.text || '').slice(0, 8000)}

CLIENT BRIEF:
${JSON.stringify(brief, null, 2)}

Instructions:
- Use product_type, niche, and category to choose language, proof, and angles (e.g. SaaS vs physical goods vs subscription app).
- Tailor hooks and copy to EVERY medium in brief.mediums — each platform has different pacing and limits.
- hooks[] should work across selected platforms but feel native to the niche.
- platform_variants[] must include one object per medium in brief.mediums (same order is fine).

${AD_COPY_GUIDELINES}

- Apply the copy rules above to hooks[], headline, primary_text, description, cta, and every platform_variants[] field.
- Prefer soft CTAs ("Learn More", "See How It Works") unless the brief goal is hard conversions and the offer is explicit.

Platform limits (respect character counts; note counts in format_notes when tight):
- Facebook / Instagram (Meta): primary text hook in first 125 visible chars; headline ~40; description ~30
- TikTok: ad text ~80–100 chars recommended; punchy native tone
- YouTube: can build slower; clear value promise in first line
- LinkedIn: intro ~150 chars recommended; professional tone if B2B
- Pinterest / Snapchat: visual-first; short overlay-style hooks

Return STRICT JSON only:
{
  "platforms_targeted": ["echo brief.mediums"],
  "hooks": ["5 distinct opening hooks suited to the niche and selected mediums"],
  "headline": "best default headline (Meta-style, under 40 chars)",
  "cta": "default CTA label",
  "primary_text": "default full primary text with line breaks",
  "description": "default link description under 30 chars",
  "platform_variants": [
    {
      "platform": "Facebook",
      "hook": "opening line for this platform",
      "headline": "platform-specific headline",
      "primary_text": "platform-specific body copy",
      "cta": "platform CTA",
      "description": "if applicable else empty string",
      "format_notes": "1 short note on length/format for this platform"
    }
  ],
  "angles_used": ["angle names you applied"],
  "notes": "1-2 sentences on what to test next across the selected mediums"
}`;

    const model = genAI.getGenerativeModel({
      model: modelId,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = normalizeFacebookAdCopyPayload(extractJsonObject(text));

    if (!parsed) {
      console.error('generateFacebookAdCopy parse failed:', String(text || '').slice(0, 1500));
      return res.status(500).json({ error: 'Failed to parse generated ad copy. Try again.' });
    }

    return res.json({
      copy: parsed,
      model: modelId,
      skills: {
        hook_writer: hookSkill.source_url,
        ad_creative: adCreativeSkill.source_url,
      },
    });
  } catch (error) {
    console.error('generateFacebookAdCopy error:', error);
    return res.status(500).json({ error: 'Failed to generate Facebook ad copy.' });
  }
}

module.exports = {
  generateHookScript,
  generateFacebookAdCopy,
  extractProductFromWebsite,
};

