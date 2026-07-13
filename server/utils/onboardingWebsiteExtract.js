const { normalizeWebsiteUrl, crawlHomepageForBrief } = require('./websiteAudit');

const INDUSTRY_OPTIONS = [
  'AI & Machine Learning',
  'Automotive',
  'B2B Services',
  'Beauty & Skincare',
  'Construction & Trades',
  'Consumer Apps',
  'Crypto & Web3',
  'Dating & Relationships',
  'E-commerce',
  'Education',
  'Entertainment & Media',
  'Fashion & Apparel',
  'Finance',
  'Fitness & Sports',
  'Food & Beverage',
  'Gaming',
  'Health & Wellness',
  'Home & Garden',
  'HR & Recruiting',
  'Insurance',
  'Legal Services',
  'Manufacturing',
  'Marketing & Advertising',
  'Nonprofit',
  'Pets & Animals',
  'Professional Services',
  'Real Estate',
  'SaaS',
  'Telecom',
  'Travel & Hospitality',
  'Other',
];

const LLM_INDUSTRY_MAP = {
  saas: 'SaaS',
  'e-commerce': 'E-commerce',
  ecommerce: 'E-commerce',
  fintech: 'Finance',
  finance: 'Finance',
  'health/wellness': 'Health & Wellness',
  'health & wellness': 'Health & Wellness',
  education: 'Education',
  'e-learning': 'Education',
  'marketing/advertising': 'Marketing & Advertising',
  'marketing / advertising': 'Marketing & Advertising',
  'marketing & advertising': 'Marketing & Advertising',
  advertising: 'Marketing & Advertising',
  dating: 'Dating & Relationships',
  relationships: 'Dating & Relationships',
  'social/dating': 'Dating & Relationships',
  'consumer app': 'Consumer Apps',
  'mobile app': 'Consumer Apps',
  'mobile apps': 'Consumer Apps',
  ai: 'AI & Machine Learning',
  'artificial intelligence': 'AI & Machine Learning',
  'machine learning': 'AI & Machine Learning',
  gaming: 'Gaming',
  games: 'Gaming',
  entertainment: 'Entertainment & Media',
  media: 'Entertainment & Media',
  fitness: 'Fitness & Sports',
  sports: 'Fitness & Sports',
  crypto: 'Crypto & Web3',
  web3: 'Crypto & Web3',
  blockchain: 'Crypto & Web3',
  b2b: 'B2B Services',
  'real estate': 'Real Estate',
  travel: 'Travel & Hospitality',
  hospitality: 'Travel & Hospitality',
  food: 'Food & Beverage',
  beverage: 'Food & Beverage',
  restaurant: 'Food & Beverage',
  beauty: 'Beauty & Skincare',
  skincare: 'Beauty & Skincare',
  fashion: 'Fashion & Apparel',
  apparel: 'Fashion & Apparel',
  pets: 'Pets & Animals',
  automotive: 'Automotive',
  insurance: 'Insurance',
  legal: 'Legal Services',
  nonprofit: 'Nonprofit',
  'non-profit': 'Nonprofit',
  manufacturing: 'Manufacturing',
  construction: 'Construction & Trades',
  telecom: 'Telecom',
  telecommunications: 'Telecom',
  recruiting: 'HR & Recruiting',
  hr: 'HR & Recruiting',
  other: 'Other',
};

const PARTIAL_INDUSTRY_KEYWORDS = [
  ['dating', 'Dating & Relationships'],
  ['relationship', 'Dating & Relationships'],
  ['companion', 'Dating & Relationships'],
  ['matchmaking', 'Dating & Relationships'],
  ['artificial intelligence', 'AI & Machine Learning'],
  ['machine learning', 'AI & Machine Learning'],
  ['generative ai', 'AI & Machine Learning'],
  ['mobile app', 'Consumer Apps'],
  ['consumer app', 'Consumer Apps'],
  ['video game', 'Gaming'],
  ['esports', 'Gaming'],
  ['cryptocurrency', 'Crypto & Web3'],
  ['blockchain', 'Crypto & Web3'],
  ['influencer', 'Marketing & Advertising'],
  ['advertising', 'Marketing & Advertising'],
  ['ecommerce', 'E-commerce'],
  ['e-commerce', 'E-commerce'],
  ['skincare', 'Beauty & Skincare'],
  ['supplement', 'Health & Wellness'],
  ['wellness', 'Health & Wellness'],
  ['fintech', 'Finance'],
  ['insurance', 'Insurance'],
  ['recruiting', 'HR & Recruiting'],
  ['staffing', 'HR & Recruiting'],
];

function extractJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPageHtml(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; ViralAdLibraryBot/1.0)',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch page (${response.status})`);
  }
  return response.text();
}

function findAboutPageUrl(html, baseUrl) {
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const base = new URL(baseUrl);
  while ((match = regex.exec(String(html || '')))) {
    const href = String(match[1] || '').trim();
    const label = cleanText(match[2]).toLowerCase();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (!/(about|who we are|our story|company)/i.test(`${href} ${label}`)) continue;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) continue;
      return resolved.toString();
    } catch {
      // ignore bad URLs
    }
  }
  return '';
}

async function scrapeWebsiteText(websiteUrl) {
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
  const brief = await crawlHomepageForBrief(normalizedUrl);
  const homepageHtml = await fetchPageHtml(normalizedUrl);
  const aboutUrl = findAboutPageUrl(homepageHtml, normalizedUrl);

  let aboutExcerpt = '';
  if (aboutUrl) {
    try {
      const aboutHtml = await fetchPageHtml(aboutUrl);
      aboutExcerpt = cleanText(aboutHtml.replace(/<script[\s\S]*?<\/script>/gi, ' ')).slice(0, 500);
    } catch {
      // homepage only
    }
  }

  const title = brief?.homepage?.title || '';
  const meta = brief?.homepage?.meta_description || '';
  const body = String(brief?.homepage?.text_excerpt || '').slice(0, 500);

  const scrapedText = [title, meta, body, aboutExcerpt].filter(Boolean).join('\n\n').slice(0, 2500);

  return {
    websiteUrl: normalizedUrl,
    scrapedText,
    aboutUrl: aboutUrl || null,
  };
}

function mapIndustryToOption(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (INDUSTRY_OPTIONS.includes(raw)) return raw;
  const key = raw.toLowerCase();
  if (LLM_INDUSTRY_MAP[key]) return LLM_INDUSTRY_MAP[key];
  for (const option of INDUSTRY_OPTIONS) {
    if (option.toLowerCase() === key) return option;
  }
  for (const [needle, option] of PARTIAL_INDUSTRY_KEYWORDS) {
    if (key.includes(needle)) return option;
  }
  return 'Other';
}

async function callClaude({ systemHint, userContent, maxTokens = 600 }) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY is not configured');
  }
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data?.content?.map((part) => part.text).join('\n') || '';
}

async function extractBrandFieldsFromWebsite(scrapedText) {
  const prompt = `You are extracting brand information for an onboarding form. Based on the website content below, return ONLY valid JSON with these fields:

{
  "brandName": "string or null",
  "industry": "one of: ${INDUSTRY_OPTIONS.filter((item) => item !== 'Other').join(', ')}, Other",
  "niche": "short phrase, max 8 words or null",
  "confidence": "high | medium | low"
}

If you cannot confidently determine a field from the content, set it to null and confidence to "low".

Website content:
${scrapedText}`;

  const text = await callClaude({ userContent: prompt, maxTokens: 400 });
  const parsed = extractJson(text) || {};

  const confidence = ['high', 'medium', 'low'].includes(String(parsed.confidence || '').toLowerCase())
    ? String(parsed.confidence).toLowerCase()
    : 'low';

  return {
    brandName: parsed.brandName ? String(parsed.brandName).trim() : '',
    industry: mapIndustryToOption(parsed.industry),
    niche: parsed.niche ? String(parsed.niche).trim().slice(0, 120) : '',
    confidence,
  };
}

async function generateBrandVoiceDraft(scrapedText) {
  const prompt = `You are helping a business owner write their brand story and ideal customer description. Based on the website content below, generate:

1. A 2-3 sentence brand story and positioning statement, first person plural ("we help...").
2. A short description of their likely ideal customer — role, company size or type, and the problem this brand solves for them.

Keep both specific to what's on the site — don't invent unsupported claims. If the site is thin on detail, make reasonable inferences from industry/niche.

Website content:
${scrapedText}

Respond in this exact format, nothing else:
STORY: ...
IDEAL_CUSTOMER: ...`;

  const text = await callClaude({ userContent: prompt, maxTokens: 700 });
  const storyMatch = text.match(/STORY:\s*([\s\S]*?)(?=IDEAL_CUSTOMER:|$)/i);
  const idealMatch = text.match(/IDEAL_CUSTOMER:\s*([\s\S]*)/i);

  return {
    story: storyMatch ? storyMatch[1].trim() : '',
    idealCustomers: idealMatch ? idealMatch[1].trim() : '',
  };
}

function defaultChannelsForIndustry(industry) {
  const key = String(industry || '').toLowerCase();
  if (key === 'saas' || key.includes('b2b')) return ['Google Search Ads', 'LinkedIn Ads'];
  if (key === 'e-commerce' || key.includes('commerce')) return ['TikTok Ads', 'Facebook Feed Ads'];
  if (key.includes('beauty') || key.includes('fashion')) return ['TikTok Ads', 'Instagram Reels'];
  if (key.includes('dating') || key.includes('consumer app') || key.includes('social')) {
    return ['TikTok Ads', 'Instagram Reels'];
  }
  if (key.includes('gaming') || key.includes('entertainment')) return ['TikTok Ads', 'YouTube Shorts'];
  if (key.includes('finance') || key.includes('insurance') || key.includes('legal')) {
    return ['Google Search Ads', 'Facebook Feed Ads'];
  }
  if (key.includes('fitness') || key.includes('health') || key.includes('wellness')) {
    return ['Instagram Reels', 'TikTok Ads'];
  }
  if (key.includes('marketing') || key.includes('advertising')) return ['Facebook Feed Ads', 'Instagram Reels'];
  return ['Facebook Feed Ads', 'Instagram Reels'];
}

module.exports = {
  INDUSTRY_OPTIONS,
  scrapeWebsiteText,
  extractBrandFieldsFromWebsite,
  generateBrandVoiceDraft,
  defaultChannelsForIndustry,
  mapIndustryToOption,
};
