const { crawlWebsiteForAudit } = require('../utils/websiteAudit');

function stripCodeFences(text) {
  return String(text || '')
    .replace(/```json/gi, '```')
    .replace(/```[\r\n]?/g, '')
    .trim();
}

function findBalancedJsonObject(text) {
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
        return input.slice(start, i + 1);
      }
    }
  }

  return '';
}

function extractJson(text) {
  const candidate = findBalancedJsonObject(text);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

async function callClaude(prompt, maxTokens = 2200) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return {
    text: data?.content?.map((part) => part.text).join('\n') || '',
    stopReason: data?.stop_reason || '',
  };
}

async function parseAuditResponse(rawText) {
  const direct = extractJson(rawText);
  if (direct?.summary && direct?.scores) {
    return direct;
  }

  const repairPrompt = `Convert the following CRO audit response into valid JSON only.

Return only one valid JSON object with no markdown and no commentary.
Do not change the meaning of the content. If a field is missing, keep it empty but preserve the schema.

Response to repair:
${String(rawText || '').slice(0, 18000)}`;

  const repairedResponse = await callClaude(repairPrompt, 2400);
  const repaired = extractJson(repairedResponse.text);
  if (repaired?.summary && repaired?.scores) {
    return repaired;
  }

  return null;
}

const RESEARCH_SOURCES = [
  {
    id: 'baymard-trust-2025',
    title: 'Baymard: trust concerns still cause checkout abandonment',
    url: 'https://baymard.com/blog/perceived-security-of-payment-form',
    applies_to: ['trust_signals', 'friction_reduction'],
  },
  {
    id: 'baymard-form-friction',
    title: 'Baymard: long and complex flows increase abandonment',
    url: 'https://baymard.com/blog/checkout-flow-average-form-fields',
    applies_to: ['friction_reduction', 'cta_clarity'],
  },
  {
    id: 'think-google-mobile-speed',
    title: 'Think with Google: slow mobile pages sharply increase abandonment',
    url: 'https://www.thinkwithgoogle.com/intl/en-apac/marketing-strategies/app-and-mobile/mobile-need-for-speed/',
    applies_to: ['mobile_readiness', 'above_fold'],
  },
  {
    id: 'think-google-value-prop',
    title: 'Think with Google: mobile landing pages need a fast, clear value proposition',
    url: 'https://www.thinkwithgoogle.com/intl/en-apac/marketing-strategies/app-and-mobile/mobile-landing-page-design-strategy/',
    applies_to: ['above_fold', 'copy_specificity', 'cta_clarity'],
  },
  {
    id: 'google-search-central-viewport',
    title: 'Google Search Central: viewport meta is part of mobile-friendly setup',
    url: 'https://developers.google.com/search/docs/crawling-indexing/special-tags',
    applies_to: ['mobile_readiness'],
  },
  {
    id: 'think-google-product-video',
    title: 'Think with Google: buyers use video to understand products before purchase',
    url: 'https://www.thinkwithgoogle.com/intl/en-emea/consumer-insights/consumer-journey/consumer-purchase-behavior/',
    applies_to: ['product_preview'],
  },
];

function getCroAuditPrompt(crawlResult) {
  return `You are an expert conversion rate optimization (CRO) analyst with 10+ years experience auditing SaaS landing pages, ecommerce sites, and marketing pages.

You will be given the crawled content of a website. Your job is to analyze it and return a structured JSON audit that identifies conversion blockers and prioritizes fixes.

SCORING FRAMEWORK — score each category 1-10:
- social_proof: testimonials, user counts, logos, reviews, ratings
- cta_clarity: button copy, hierarchy, placement, contrast, friction reducers
- product_preview: screenshots, demos, videos, feature previews
- trust_signals: guarantees, security badges, refund policy, about/team
- copy_specificity: specific numbers/claims vs vague language, headline strength
- friction_reduction: free trial signals, "no credit card", pricing transparency
- above_fold: what's visible without scrolling — does it pass the 5-second test?
- mobile_readiness: viewport meta, touch targets, font sizes (infer from HTML)

PRIORITY LEVELS for fixes:
- critical: likely costing 20%+ in conversions. Fix this week.
- important: meaningful lift, fix this month.
- nice_to_have: small gains, fix when you have time.

Use this research source pack to calibrate scoring and priorities, but never invent page evidence:
${JSON.stringify(RESEARCH_SOURCES, null, 2)}

Return STRICT JSON only with this exact shape:
{
  "summary": {
    "overall_score": 0,
    "grade": "A",
    "headline": "",
    "verdict": "",
    "top_opportunity": ""
  },
  "scores": {
    "social_proof": { "score": 0, "reason": "", "evidence_found": [], "evidence_missing": [] },
    "cta_clarity": { "score": 0, "reason": "", "evidence_found": [], "evidence_missing": [] },
    "product_preview": { "score": 0, "reason": "", "evidence_found": [], "evidence_missing": [] },
    "trust_signals": { "score": 0, "reason": "", "evidence_found": [], "evidence_missing": [] },
    "copy_specificity": { "score": 0, "reason": "", "evidence_found": [], "evidence_missing": [] },
    "friction_reduction": { "score": 0, "reason": "", "evidence_found": [], "evidence_missing": [] },
    "above_fold": { "score": 0, "reason": "", "evidence_found": [], "evidence_missing": [] },
    "mobile_readiness": { "score": 0, "reason": "", "evidence_found": [], "evidence_missing": [] }
  },
  "priority_fixes": [
    {
      "priority": "critical",
      "category": "",
      "issue": "",
      "why_it_matters": "",
      "recommended_change": "",
      "expected_impact": "",
      "source_ids": []
    }
  ],
  "rewrite_suggestions": [
    {
      "target": "headline|subheadline|cta|trust_microcopy",
      "current": "",
      "suggested": "",
      "why": ""
    }
  ],
  "detected_elements": {
    "title": "",
    "meta_description": "",
    "h1": [],
    "primary_ctas": [],
    "forms_detected": 0,
    "inputs_detected": 0,
    "images_detected": 0,
    "video_or_iframe_detected": 0,
    "has_viewport_meta": false
  },
  "research_sources": [
    {
      "id": "",
      "title": "",
      "url": "",
      "used_for": ""
    }
  ]
}

Rules:
- Base your audit only on the supplied crawl data and HTML cues.
- Be specific and concrete, not generic.
- Include 3 to 8 priority_fixes.
- Include 2 to 6 rewrite_suggestions.
- Use source_ids only from the source pack.
- Overall score must be 0-100.
- Grade should be A, B, C, D, or F.
- If crawl evidence is weak, say so instead of guessing.

Website crawl data:
${JSON.stringify(crawlResult, null, 2)}`;
}

function sanitizeArray(value, limit = 8) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, limit)
    : [];
}

function sanitizeScoreBlock(block = {}) {
  return {
    score: Math.max(1, Math.min(10, Number(block?.score || 1))),
    reason: String(block?.reason || '').trim(),
    evidence_found: sanitizeArray(block?.evidence_found),
    evidence_missing: sanitizeArray(block?.evidence_missing),
  };
}

function buildPromptPayload(crawlResult) {
  return {
    website_url: crawlResult.website_url,
    fetched_at: crawlResult.fetched_at,
    homepage: {
      title: crawlResult.homepage?.title || '',
      meta_description: crawlResult.homepage?.meta_description || '',
      viewport: crawlResult.homepage?.viewport || '',
      has_viewport_meta: Boolean(crawlResult.homepage?.has_viewport_meta),
      headings: crawlResult.homepage?.headings || {},
      buttons: (crawlResult.homepage?.buttons || []).slice(0, 12),
      links: (crawlResult.homepage?.links || []).slice(0, 12),
      ctas: (crawlResult.homepage?.ctas || []).slice(0, 12),
      input_placeholders: (crawlResult.homepage?.input_placeholders || []).slice(0, 10),
      form_count: Number(crawlResult.homepage?.form_count || 0),
      input_count: Number(crawlResult.homepage?.input_count || 0),
      image_count: Number(crawlResult.homepage?.image_count || 0),
      video_or_iframe_count: Number(crawlResult.homepage?.video_or_iframe_count || 0),
      testimonial_mentions: Number(crawlResult.homepage?.testimonial_mentions || 0),
      trust_mentions: Number(crawlResult.homepage?.trust_mentions || 0),
      price_mentions: Number(crawlResult.homepage?.price_mentions || 0),
      text_excerpt: String(crawlResult.homepage?.text_excerpt || '').slice(0, 2500),
      html_excerpt: String(crawlResult.homepage?.html_excerpt || '').slice(0, 5000),
    },
    crawl_pages: Array.isArray(crawlResult.crawl_pages)
      ? crawlResult.crawl_pages.slice(0, 5).map((page) => ({
          url: page.url,
          title: page.title,
          text_excerpt: String(page.text_excerpt || '').slice(0, 300),
        }))
      : [],
    text_content_excerpt: String(crawlResult.text_content || '').slice(0, 6000),
  };
}

async function analyzeCroAuditCore(input = {}) {
  const websiteUrl = String(input?.websiteUrl || '').trim();
  if (!websiteUrl) {
    throw new Error('websiteUrl is required');
  }

  if (!process.env.CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY is not configured');
  }

  const crawlResult = await crawlWebsiteForAudit(websiteUrl);
  const prompt = getCroAuditPrompt(buildPromptPayload(crawlResult));
  let claudeResponse = await callClaude(prompt, 3200);

  if (claudeResponse.stopReason === 'max_tokens') {
    claudeResponse = await callClaude(`${prompt}

Important: keep each reason under 30 words, each evidence array under 5 items, and each fix concise so the full JSON fits comfortably. Return JSON only.`, 4200);
  }

  const parsed = await parseAuditResponse(claudeResponse.text);

  if (!parsed?.summary || !parsed?.scores) {
    console.error('CRO audit stop reason:', claudeResponse.stopReason);
    console.error('CRO audit raw response preview:', String(claudeResponse.text || '').slice(0, 2000));
    throw new Error('Failed to parse CRO audit response');
  }

  return {
      summary: {
        overall_score: Math.max(0, Math.min(100, Number(parsed.summary?.overall_score || 0))),
        grade: ['A', 'B', 'C', 'D', 'F'].includes(String(parsed.summary?.grade || '').trim()) ? String(parsed.summary.grade).trim() : 'C',
        headline: String(parsed.summary?.headline || '').trim(),
        verdict: String(parsed.summary?.verdict || '').trim(),
        top_opportunity: String(parsed.summary?.top_opportunity || '').trim(),
      },
      scores: {
        social_proof: sanitizeScoreBlock(parsed.scores?.social_proof),
        cta_clarity: sanitizeScoreBlock(parsed.scores?.cta_clarity),
        product_preview: sanitizeScoreBlock(parsed.scores?.product_preview),
        trust_signals: sanitizeScoreBlock(parsed.scores?.trust_signals),
        copy_specificity: sanitizeScoreBlock(parsed.scores?.copy_specificity),
        friction_reduction: sanitizeScoreBlock(parsed.scores?.friction_reduction),
        above_fold: sanitizeScoreBlock(parsed.scores?.above_fold),
        mobile_readiness: sanitizeScoreBlock(parsed.scores?.mobile_readiness),
      },
      priority_fixes: Array.isArray(parsed.priority_fixes)
        ? parsed.priority_fixes.slice(0, 8).map((item) => ({
            priority: ['critical', 'important', 'nice_to_have'].includes(String(item?.priority || '').trim()) ? String(item.priority).trim() : 'important',
            category: String(item?.category || '').trim(),
            issue: String(item?.issue || '').trim(),
            why_it_matters: String(item?.why_it_matters || '').trim(),
            recommended_change: String(item?.recommended_change || '').trim(),
            expected_impact: String(item?.expected_impact || '').trim(),
            source_ids: sanitizeArray(item?.source_ids, 4),
          }))
        : [],
      rewrite_suggestions: Array.isArray(parsed.rewrite_suggestions)
        ? parsed.rewrite_suggestions.slice(0, 6).map((item) => ({
            target: String(item?.target || '').trim(),
            current: String(item?.current || '').trim(),
            suggested: String(item?.suggested || '').trim(),
            why: String(item?.why || '').trim(),
          }))
        : [],
      detected_elements: {
        title: crawlResult.homepage?.title || '',
        meta_description: crawlResult.homepage?.meta_description || '',
        h1: crawlResult.homepage?.headings?.h1 || [],
        primary_ctas: crawlResult.homepage?.ctas || [],
        forms_detected: Number(crawlResult.homepage?.form_count || 0),
        inputs_detected: Number(crawlResult.homepage?.input_count || 0),
        images_detected: Number(crawlResult.homepage?.image_count || 0),
        video_or_iframe_detected: Number(crawlResult.homepage?.video_or_iframe_count || 0),
        has_viewport_meta: Boolean(crawlResult.homepage?.has_viewport_meta),
      },
      research_sources: RESEARCH_SOURCES.map((source) => ({
        id: source.id,
        title: source.title,
        url: source.url,
        used_for: source.applies_to.join(', '),
      })),
      crawl_snapshot: crawlResult,
    };
}

async function analyzeCroAudit(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json(await analyzeCroAuditCore(req.body || {}));
  } catch (error) {
    console.error('analyzeCroAudit error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate CRO audit' });
  }
}

module.exports = { analyzeCroAudit, analyzeCroAuditCore };
