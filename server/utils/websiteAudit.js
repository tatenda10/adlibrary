const { ApifyClient } = require('apify-client');

function normalizeWebsiteUrl(raw) {
  const input = String(raw || '').trim();
  if (!input) throw new Error('Website URL is required');
  return /^https?:\/\//i.test(input) ? input : `https://${input}`;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cleanText(value) {
  return decodeHtmlEntities(String(value || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripNonContent(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
}

function pickMarkup(item = {}) {
  return (
    item.html ||
    item.renderedHtml ||
    item.pageHtml ||
    item.outerHTML ||
    item.body ||
    item.content ||
    item.pageContent ||
    ''
  );
}

function extractTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match?.[1] || '');
}

function extractMetaContent(html, name) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`, 'i');
  const reverse = new RegExp(`<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i');
  const match = String(html || '').match(pattern) || String(html || '').match(reverse);
  return cleanText(match?.[1] || '');
}

function extractTagTexts(html, tagName, limit = 12) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const results = [];
  let match;
  while ((match = regex.exec(String(html || ''))) && results.length < limit) {
    const text = cleanText(match[1]);
    if (text) results.push(text);
  }
  return results;
}

function extractAnchorTexts(html, limit = 24) {
  const regex = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  const results = [];
  let match;
  while ((match = regex.exec(String(html || ''))) && results.length < limit) {
    const text = cleanText(match[1]);
    if (text) results.push(text);
  }
  return results;
}

function extractInputPlaceholders(html, limit = 20) {
  const regex = /<input\b[^>]*placeholder=["']([\s\S]*?)["'][^>]*>/gi;
  const results = [];
  let match;
  while ((match = regex.exec(String(html || ''))) && results.length < limit) {
    const text = cleanText(match[1]);
    if (text) results.push(text);
  }
  return results;
}

function countMatches(html, pattern) {
  const matches = String(html || '').match(pattern);
  return matches ? matches.length : 0;
}

function extractImageUrls(html, limit = 24) {
  const regex = /<(?:img|source)\b[^>]*(?:src|srcset)=["']([\s\S]*?)["'][^>]*>/gi;
  const results = [];
  let match;
  while ((match = regex.exec(String(html || ''))) && results.length < limit) {
    const value = String(match[1] || '')
      .split(',')
      .map((part) => part.trim().split(' ')[0])
      .find(Boolean);
    if (value) results.push(value);
  }
  return [...new Set(results)];
}

function summarizeMarkup(html) {
  const sanitizedHtml = stripNonContent(html);
  const text = cleanText(sanitizedHtml);
  return {
    html: sanitizedHtml,
    text,
    headings: {
      h1: extractTagTexts(sanitizedHtml, 'h1', 6),
      h2: extractTagTexts(sanitizedHtml, 'h2', 10),
      h3: extractTagTexts(sanitizedHtml, 'h3', 10),
    },
    buttons: extractTagTexts(sanitizedHtml, 'button', 20),
    links: extractAnchorTexts(sanitizedHtml, 30),
    input_placeholders: extractInputPlaceholders(sanitizedHtml, 16),
    form_count: countMatches(sanitizedHtml, /<form\b/gi),
    input_count: countMatches(sanitizedHtml, /<(input|select|textarea)\b/gi),
    image_count: countMatches(sanitizedHtml, /<(img|picture|source)\b/gi),
    video_or_iframe_count: countMatches(sanitizedHtml, /<(video|iframe)\b/gi),
    image_urls: extractImageUrls(sanitizedHtml, 24),
  };
}

function pickCtas(buttons = [], links = []) {
  const candidates = [...buttons, ...links];
  const ctaRegex = /(start|try|get|book|request|schedule|contact|join|buy|shop|subscribe|talk|watch|see|demo|free|sign up|sign in|login|log in)/i;
  return candidates.filter((item) => item && ctaRegex.test(item)).slice(0, 12);
}

async function fetchHomepageHtml(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; ViralAdLibraryBot/1.0; +https://viraladlibrary.local)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch website (${response.status})`);
  }

  return response.text();
}

async function fetchApifyText(normalizedUrl) {
  if (!process.env.APIFY_TOKEN) {
    return { text: '', pages: [] };
  }

  const actorId = process.env.APIFY_BRAND_ACTOR_ID || process.env.APIFY_WEBSITE_ACTOR || 'aYG0l9s7dbB7j3gbS';
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const input = {
    websiteUrl: normalizedUrl,
    startUrls: [{ url: normalizedUrl }],
    maxRequestRetries: 1,
    maxCrawlDepth: 2,
    maxPagesPerCrawl: 20,
    maxResults: 200,
  };

  const run = await client.actor(actorId).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 200 });
  const safeItems = Array.isArray(items) ? items : [];
  const markupSummaries = safeItems.map((item) => summarizeMarkup(pickMarkup(item)));

  return {
    text: safeItems
      .map((item, index) => {
        const direct = cleanText(item?.text || item?.plainText || item?.content || item?.body || item?.pageContent || '');
        return direct || markupSummaries[index]?.text || '';
      })
      .filter(Boolean)
      .join('\n\n'),
    rendered_summary: markupSummaries[0] || summarizeMarkup(''),
    pages: safeItems.slice(0, 10).map((item, index) => ({
      url: String(item?.url || item?.pageUrl || item?.requestUrl || item?.loadedUrl || `${normalizedUrl}#${index + 1}`),
      title: cleanText(item?.title || item?.pageTitle || ''),
      text_excerpt: (cleanText(item?.text || item?.plainText || item?.content || item?.body || item?.pageContent || '') || markupSummaries[index]?.text || '').slice(0, 500),
      image_count: markupSummaries[index]?.image_count || 0,
      image_urls: (markupSummaries[index]?.image_urls || []).slice(0, 6),
    })),
  };
}

async function crawlWebsiteForAudit(websiteUrl) {
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
  const html = await fetchHomepageHtml(normalizedUrl);
  const rawSummary = summarizeMarkup(html);

  let apifyResult = { text: '', pages: [], rendered_summary: summarizeMarkup('') };
  try {
    apifyResult = await fetchApifyText(normalizedUrl);
  } catch (error) {
    console.error('Apify crawl unavailable for CRO audit:', error?.message || error);
  }

  const renderedSummary = apifyResult.rendered_summary || summarizeMarkup('');
  const preferredSummary =
    renderedSummary.text.length > rawSummary.text.length / 2 && renderedSummary.text.length > 120
      ? renderedSummary
      : rawSummary;
  const combinedButtons = [...new Set([...(preferredSummary.buttons || []), ...(rawSummary.buttons || [])])].slice(0, 20);
  const combinedLinks = [...new Set([...(preferredSummary.links || []), ...(rawSummary.links || [])])].slice(0, 20);
  const combinedCtas = pickCtas(combinedButtons, combinedLinks);
  const combinedImageUrls = [...new Set([...(preferredSummary.image_urls || []), ...(rawSummary.image_urls || [])])].slice(0, 24);
  const homepageText = preferredSummary.text || rawSummary.text;

  return {
    website_url: normalizedUrl,
    fetched_at: new Date().toISOString(),
    homepage: {
      title: extractTitle(html),
      meta_description: extractMetaContent(html, 'description'),
      viewport: extractMetaContent(html, 'viewport'),
      has_viewport_meta: Boolean(extractMetaContent(html, 'viewport')),
      headings: preferredSummary.headings || rawSummary.headings,
      buttons: combinedButtons,
      links: combinedLinks,
      ctas: combinedCtas,
      input_placeholders: [...new Set([...(preferredSummary.input_placeholders || []), ...(rawSummary.input_placeholders || [])])].slice(0, 16),
      form_count: Math.max(Number(preferredSummary.form_count || 0), Number(rawSummary.form_count || 0)),
      input_count: Math.max(Number(preferredSummary.input_count || 0), Number(rawSummary.input_count || 0)),
      image_count: Math.max(Number(preferredSummary.image_count || 0), Number(rawSummary.image_count || 0)),
      image_urls: combinedImageUrls,
      video_or_iframe_count: Math.max(Number(preferredSummary.video_or_iframe_count || 0), Number(rawSummary.video_or_iframe_count || 0)),
      testimonial_mentions: countMatches(homepageText, /\b(testimonial|review|reviews|rating|trusted by|customers?|companies use|used by|case stud(y|ies))\b/gi),
      trust_mentions: countMatches(homepageText, /\b(secure|security|privacy|refund|guarantee|money-back|trusted|compliance|ssl|encrypted|about us|our team)\b/gi),
      price_mentions: countMatches(homepageText, /\b(pricing|plans|free trial|free plan|no credit card|book demo|request demo|\$\d+)\b/gi),
      html_excerpt: (preferredSummary.html || rawSummary.html || '').slice(0, 12000),
      text_excerpt: homepageText.slice(0, 5000),
    },
    crawl_pages: apifyResult.pages,
    text_content: [homepageText, apifyResult.text].filter(Boolean).join('\n\n').slice(0, 30000),
  };
}

async function runWebsiteCrawl(websiteUrl) {
  const result = await crawlWebsiteForAudit(websiteUrl);
  return result.text_content || '';
}

async function crawlHomepageForBrief(websiteUrl) {
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
  const html = await fetchHomepageHtml(normalizedUrl);
  const summary = summarizeMarkup(html);
  const ctas = pickCtas(summary.buttons || [], summary.links || []);

  return {
    website_url: normalizedUrl,
    fetched_at: new Date().toISOString(),
    homepage: {
      title: extractTitle(html),
      meta_description: extractMetaContent(html, 'description'),
      og_title: extractMetaContent(html, 'og:title'),
      og_description: extractMetaContent(html, 'og:description'),
      headings: summary.headings,
      ctas,
      text_excerpt: summary.text.slice(0, 5000),
    },
  };
}

module.exports = {
  normalizeWebsiteUrl,
  crawlWebsiteForAudit,
  crawlHomepageForBrief,
  runWebsiteCrawl,
};
