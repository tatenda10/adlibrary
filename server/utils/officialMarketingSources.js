const CACHE_TTL_MS = 30 * 60 * 1000;

const sourceCache = new Map();

const SOURCES = [
  {
    id: 'google-ads',
    name: 'Google Ads & Commerce',
    url: 'https://blog.google/products/ads/',
    articlePatterns: [/blog\.google\/products\/ads\//i],
  },
  {
    id: 'tiktok-business',
    name: 'TikTok for Business',
    url: 'https://ads.tiktok.com/business/en-US/blog/',
    articlePatterns: [/ads\.tiktok\.com\/business\/en(?:-US)?\/blog\//i],
  },
  {
    id: 'meta-newsroom',
    name: 'Meta Newsroom',
    url: 'https://about.fb.com/news/',
    articlePatterns: [/about\.fb\.com\/news\//i],
  },
  {
    id: 'tiktok-newsroom',
    name: 'TikTok Newsroom',
    url: 'https://newsroom.tiktok.com/en-us/?lang=en',
    articlePatterns: [/newsroom\.tiktok\.com\/en[-/]us/i],
  },
];

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripTags(value) {
  return decodeHtmlEntities(String(value || ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(baseUrl, value) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return '';
  }
}

function firstMatch(text, regex) {
  const match = String(text || '').match(regex);
  return match?.[1] || '';
}

function extractXmlValue(block, tagNames) {
  for (const tagName of tagNames) {
    const value = firstMatch(block, new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
    if (value) return value;
  }
  return '';
}

function extractFeedUrl(html, pageUrl) {
  const regex = /<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
  const reverseRegex = /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi;
  const match = regex.exec(html) || reverseRegex.exec(html);
  return absoluteUrl(pageUrl, match?.[1] || '');
}

function parseRssItems(xml, source, limit = 4) {
  const items = [];
  const itemRegex = /<(item|entry)\b[\s\S]*?<\/\1>/gi;
  let match;

  while ((match = itemRegex.exec(String(xml || ''))) && items.length < limit) {
    const block = match[0];
    const title = stripTags(extractXmlValue(block, ['title']));
    const rawLink =
      extractXmlValue(block, ['link']) ||
      firstMatch(block, /<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
    const url = absoluteUrl(source.url, stripTags(rawLink));
    const excerpt = stripTags(extractXmlValue(block, ['description', 'summary', 'content:encoded']));
    const publishedAt = stripTags(extractXmlValue(block, ['pubDate', 'published', 'updated']));

    if (!title || !url) continue;
    items.push({
      source: source.name,
      source_id: source.id,
      title,
      excerpt: excerpt.slice(0, 220),
      url,
      published_at: normalizeDate(publishedAt),
    });
  }

  return items;
}

function normalizeDate(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function extractJsonLdArticles(html, source, limit = 4) {
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  let match;
  while ((match = regex.exec(String(html || '')))) {
    scripts.push(match[1]);
  }

  const articles = [];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.trim());
      collectArticlesFromJsonLd(parsed, articles, source);
    } catch {
      // Ignore malformed blocks.
    }
    if (articles.length >= limit) break;
  }

  return dedupeArticles(articles).slice(0, limit);
}

function collectArticlesFromJsonLd(value, target, source) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectArticlesFromJsonLd(item, target, source));
    return;
  }
  if (typeof value !== 'object') return;

  const type = Array.isArray(value['@type']) ? value['@type'].join(' ') : String(value['@type'] || '');
  if (/(Article|NewsArticle|BlogPosting)/i.test(type)) {
    const title = stripTags(value.headline || value.name || '');
    const url = absoluteUrl(source.url, value.url || value.mainEntityOfPage || '');
    const excerpt = stripTags(value.description || '');
    const publishedAt = normalizeDate(value.datePublished || value.dateCreated || value.dateModified || '');
    if (title && url) {
      target.push({
        source: source.name,
        source_id: source.id,
        title,
        excerpt: excerpt.slice(0, 220),
        url,
        published_at: publishedAt,
      });
    }
  }

  for (const nested of Object.values(value)) {
    collectArticlesFromJsonLd(nested, target, source);
  }
}

function extractAnchorArticles(html, source, limit = 4) {
  const items = [];
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(String(html || ''))) && items.length < limit * 4) {
    const url = absoluteUrl(source.url, match[1]);
    const title = stripTags(match[2]);
    if (!url || !title) continue;
    if (title.length < 20 || title.length > 180) continue;
    if (!source.articlePatterns.some((pattern) => pattern.test(url))) continue;
    items.push({
      source: source.name,
      source_id: source.id,
      title,
      excerpt: '',
      url,
      published_at: '',
    });
  }
  return dedupeArticles(items).slice(0, limit);
}

function dedupeArticles(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.url || item.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; ViralAdLibraryBot/1.0; +https://viraladlibrary.local)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }

  return response.text();
}

async function fetchSourceArticles(source, limit = 4) {
  const cacheEntry = sourceCache.get(source.id);
  if (cacheEntry && cacheEntry.expiresAt > Date.now()) {
    return cacheEntry.items;
  }

  const pageHtml = await fetchText(source.url);
  const feedUrl = extractFeedUrl(pageHtml, source.url);

  let items = [];
  if (feedUrl) {
    try {
      const feedXml = await fetchText(feedUrl);
      items = parseRssItems(feedXml, source, limit);
    } catch {
      items = [];
    }
  }

  if (!items.length) {
    items = extractJsonLdArticles(pageHtml, source, limit);
  }
  if (!items.length) {
    items = extractAnchorArticles(pageHtml, source, limit);
  }

  sourceCache.set(source.id, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    items,
  });

  return items;
}

async function getOfficialMarketingUpdates(limitPerSource = 3) {
  const settled = await Promise.allSettled(SOURCES.map((source) => fetchSourceArticles(source, limitPerSource)));
  const items = [];
  const statuses = [];

  settled.forEach((result, index) => {
    const source = SOURCES[index];
    if (result.status === 'fulfilled') {
      items.push(...result.value);
      statuses.push({ source: source.name, ok: true, count: result.value.length });
    } else {
      statuses.push({ source: source.name, ok: false, count: 0 });
    }
  });

  items.sort((a, b) => {
    const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
    return bTime - aTime;
  });

  return {
    items: items.slice(0, 12),
    statuses,
  };
}

module.exports = {
  getOfficialMarketingUpdates,
};
