/**
 * Lightweight Facebook link metadata (URL parse + oEmbed). No Apify scraper.
 */

function isPublicFacebookUrl(raw = '') {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const allowed =
      host === 'facebook.com' ||
      host === 'fb.com' ||
      host === 'fb.watch' ||
      host === 'm.facebook.com' ||
      host.endsWith('.facebook.com');
    if (!allowed) return false;
    const path = parsed.pathname || '';
    return path.length > 1 || Boolean(parsed.search);
  } catch {
    return false;
  }
}

function normalizeFacebookUrl(raw = '') {
  const trimmed = String(raw || '').trim();
  if (!isPublicFacebookUrl(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
}

/** Follow redirects for fb.watch / share links so embeds get a canonical video/post URL. */
async function resolveCanonicalFacebookUrl(raw = '') {
  const trimmed = normalizeFacebookUrl(raw);
  if (!trimmed) return null;

  const needsResolve = /fb\.watch|\/share\//i.test(trimmed);
  if (!needsResolve) return trimmed;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(trimmed, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    const finalUrl = response.url || trimmed;
    return normalizeFacebookUrl(finalUrl) || trimmed;
  } catch {
    return trimmed;
  } finally {
    clearTimeout(timeout);
  }
}

function isFacebookVideoPath(url = '') {
  const raw = String(url || '').trim();
  return /\/videos\/|\/reel\/|\/watch(?:\/|\?)|video\.php|fb\.watch|\/share\/v\//i.test(raw);
}

function extractFacebookContentId(url = '') {
  const raw = String(url || '').trim();
  const videoMatch = raw.match(/(?:\/videos\/|\/watch\/?\?v=|video\.php\?v=)(\d+)/i);
  if (videoMatch) return videoMatch[1];
  const postMatch = raw.match(/\/posts\/([^/?#]+)/i);
  if (postMatch) return postMatch[1];
  const reelMatch = raw.match(/\/reel\/(\d+)/i);
  if (reelMatch) return reelMatch[1];
  return '';
}

async function fetchFacebookOEmbed(url) {
  const target = String(url || '').trim();
  if (!target) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const endpoint = `https://www.facebook.com/plugins/post/oembed.json/?url=${encodeURIComponent(target)}`;
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    const data = await response.json();
    return {
      caption: String(data?.title || data?.author_name || '').trim(),
      author_name: String(data?.author_name || '').trim(),
      author_username: '',
      thumbnail_url: String(data?.thumbnail_url || '').trim(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtmlEntity(value = '') {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function extractMetaTag(html = '', keys = []) {
  const source = String(html || '');
  for (const key of keys) {
    const escaped = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        'i'
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
        'i'
      ),
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return decodeHtmlEntity(match[1].trim());
    }
  }
  return '';
}

async function fetchFacebookPageMeta(url) {
  const target = String(url || '').trim();
  if (!target) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) return null;
    const html = await response.text();
    if (!html) return null;

    return {
      caption: extractMetaTag(html, ['og:title', 'twitter:title']),
      author_name: extractMetaTag(html, ['al:android:app_name', 'application-name']),
      thumbnail_url: extractMetaTag(html, ['og:image', 'twitter:image']),
      source_video_stream_url: extractMetaTag(html, [
        'og:video',
        'og:video:url',
        'og:video:secure_url',
        'twitter:player:stream',
      ]),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveWorkspaceLinkMeta(url) {
  const oembed = await fetchFacebookOEmbed(url);
  const pageMeta = await fetchFacebookPageMeta(url);
  return {
    caption: oembed?.caption || pageMeta?.caption || '',
    author_name: oembed?.author_name || pageMeta?.author_name || '',
    author_username: oembed?.author_username || '',
    thumbnail_url: oembed?.thumbnail_url || pageMeta?.thumbnail_url || '',
    source_video_stream_url: pageMeta?.source_video_stream_url || '',
  };
}

module.exports = {
  isPublicFacebookUrl,
  normalizeFacebookUrl,
  resolveCanonicalFacebookUrl,
  isFacebookVideoPath,
  extractFacebookContentId,
  resolveWorkspaceLinkMeta,
};
